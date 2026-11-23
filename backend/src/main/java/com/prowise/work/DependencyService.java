package com.prowise.work;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;

/**
 * Task 3.4: Finish-to-Start dependencies inside one project (FR-021, docs/domain-rules.md "Dependencies and blockers").
 *
 * <ul>
 *   <li>Only planners ({@code task.create} or {@code task.assign}) link or unlink work. Self-links, duplicates, links
 *       to another project and cycles are refused. Graph changes serialize on the project row, so two simultaneous
 *       reverse links cannot both succeed.</li>
 *   <li>A successor cannot start while any prerequisite is unfinished (409 BLOCKED_BY_DEPENDENCY).</li>
 *   <li>When accepted work is reopened, every downstream item that is active or done is FLAGGED for review; states and
 *       dates never change automatically. Flags clear once all prerequisites are accepted again.</li>
 *   <li>Credit suspension (a done item whose prerequisite is not accepted earns nothing) is applied by the progress
 *       calculation (task 3.5) using {@link #hasUnacceptedPrerequisite}.</li>
 * </ul>
 */
@Service
public class DependencyService implements WorkItemStateListener {

    private final JdbcTemplate jdbc;
    private final WorkItemService workItems;
    private final ChangeRecorder changes;

    public DependencyService(JdbcTemplate jdbc, WorkItemService workItems, ChangeRecorder changes) {
        this.jdbc = jdbc;
        this.workItems = workItems;
        this.changes = changes;
    }

    /* ================================================================== link / unlink */

    @Transactional
    public LinkResult link(Authentication authentication, String successorId, LinkRequest request) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        WorkItemService.Item successor = workItems.visible(caller, successorId);
        requirePlanner(caller, successor.projectId());
        String predecessorId = request.predecessorId() == null ? "" : request.predecessorId().trim();

        jdbc.queryForList("SELECT id FROM projects WHERE id = ? AND org_id = ? FOR UPDATE", successor.projectId(), caller.orgId());
        WorkItemService.Item predecessor = predecessorId.isEmpty() ? null : workItems.find(caller.orgId(), predecessorId);
        if (predecessor == null || !predecessor.projectId().equals(successor.projectId())
                || predecessor.id().equals(successor.id()) || "RETIRED".equals(predecessor.planStatus())
                || "RETIRED".equals(successor.planStatus())) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_DEPENDENCY",
                    "A prerequisite must be other active work in the same project.",
                    List.of(new ApiError.FieldError("predecessor_id", "is not other active work in this project")));
        }
        // A cycle would appear if the predecessor already (transitively) depends on the successor.
        Boolean cycle = jdbc.queryForObject("""
                WITH RECURSIVE down(id, n) AS (
                    SELECT successor_id, 1 FROM work_item_dependencies WHERE predecessor_id = ?
                    UNION
                    SELECT d.successor_id, down.n + 1 FROM work_item_dependencies d JOIN down ON d.predecessor_id = down.id
                    WHERE down.n < 500)
                SELECT EXISTS (SELECT 1 FROM down WHERE id = ?)
                """, Boolean.class, successor.id(), predecessor.id());
        if (Boolean.TRUE.equals(cycle)) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "DEPENDENCY_CYCLE",
                    "This link would make the work wait for itself.",
                    List.of(new ApiError.FieldError("predecessor_id", "would create a loop")));
        }
        UUID id = UUID.randomUUID();
        try {
            jdbc.update("""
                    INSERT INTO work_item_dependencies (id, org_id, project_id, predecessor_id, successor_id, created_by)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, id, caller.orgId(), successor.projectId(), predecessor.id(), successor.id(), caller.userId());
        } catch (DuplicateKeyException duplicate) {
            throw WorkItemService.conflict("DUPLICATE_DEPENDENCY", "These items are already linked.");
        }
        Map<String, Object> data = Map.of("predecessor_id", predecessor.id(), "successor_id", successor.id(),
                "project_id", successor.projectId());
        changes.record(
                new ChangeRecorder.AuditEntry(caller.orgId(), caller.userId(), "dependency.added", "DEPENDENCY", id, null,
                        null, data),
                new ChangeRecorder.DomainEvent(caller.orgId(), "DEPENDENCY", id, 0L, "DependencyAdded", data));
        return new LinkResult(dependency(id), affected(caller.orgId(), predecessor.id()));
    }

    @Transactional
    public void unlink(Authentication authentication, UUID dependencyId) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT project_id, predecessor_id, successor_id FROM work_item_dependencies WHERE id = ? AND org_id = ?",
                dependencyId, caller.orgId());
        if (rows.isEmpty()) throw PermissionService.notFound();
        String projectId = (String) rows.get(0).get("project_id");
        workItems.readableProject(caller, projectId);
        requirePlanner(caller, projectId);
        jdbc.queryForList("SELECT id FROM projects WHERE id = ? AND org_id = ? FOR UPDATE", projectId, caller.orgId());
        jdbc.update("DELETE FROM work_item_dependencies WHERE id = ?", dependencyId);
        Map<String, Object> data = Map.of("predecessor_id", rows.get(0).get("predecessor_id"),
                "successor_id", rows.get(0).get("successor_id"), "project_id", projectId);
        changes.record(
                new ChangeRecorder.AuditEntry(caller.orgId(), caller.userId(), "dependency.removed", "DEPENDENCY",
                        dependencyId, null, data, null),
                new ChangeRecorder.DomainEvent(caller.orgId(), "DEPENDENCY", dependencyId, 1L, "DependencyRemoved", data));
    }

    @Transactional(readOnly = true)
    public DependencyView view(Authentication authentication, String workItemId) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        WorkItemService.Item item = workItems.visible(caller, workItemId);
        List<Link> blockedBy = jdbc.query(LINK_SELECT + " WHERE d.successor_id = ? AND d.org_id = ? ORDER BY p.key",
                (rs, n) -> link(rs), item.id(), caller.orgId());
        List<Link> blocks = jdbc.query(LINK_SELECT + " WHERE d.predecessor_id = ? AND d.org_id = ? ORDER BY s.key",
                (rs, n) -> link(rs), item.id(), caller.orgId());
        return new DependencyView(blockedBy, blocks, affected(caller.orgId(), item.id()));
    }

    /* ================================================================== workflow hooks (same transaction) */

    @Override
    public void beforeStart(UUID orgId, String workItemId) {
        List<String> unfinished = jdbc.queryForList("""
                SELECT p.key FROM work_item_dependencies d JOIN work_items p ON p.id = d.predecessor_id
                WHERE d.successor_id = ? AND d.org_id = ? AND p.state NOT IN ('DONE', 'CANCELLED')
                ORDER BY p.key
                """, String.class, workItemId, orgId);
        if (!unfinished.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "BLOCKED_BY_DEPENDENCY",
                    "This work waits for " + String.join(", ", unfinished) + " to be finished first.");
        }
    }

    @Override
    public void afterReopen(UUID orgId, String workItemId, UUID actorId) {
        String key = jdbc.queryForObject("SELECT key FROM work_items WHERE id = ?", String.class, workItemId);
        jdbc.update("""
                WITH RECURSIVE down(id, n) AS (
                    SELECT successor_id, 1 FROM work_item_dependencies WHERE predecessor_id = ? AND org_id = ?
                    UNION
                    SELECT d.successor_id, down.n + 1 FROM work_item_dependencies d JOIN down ON d.predecessor_id = down.id
                    WHERE down.n < 500)
                UPDATE work_items SET dependency_flag = ?, dependency_flagged_at = now(), updated_at = now()
                WHERE id IN (SELECT id FROM down) AND org_id = ? AND state IN ('IN_PROGRESS', 'IN_REVIEW', 'DONE')
                """, workItemId, orgId, "Prerequisite " + key + " was reopened: review whether this work is still valid.",
                orgId);
    }

    @Override
    public void creditChanged(UUID orgId, String workItemId, String cause, UUID actorId) {
        if (!"WORK_ACCEPTED".equals(cause)) return;
        // Downstream flags clear once every prerequisite in their chain is accepted again.
        jdbc.update("""
                WITH RECURSIVE down(id, n) AS (
                    SELECT successor_id, 1 FROM work_item_dependencies WHERE predecessor_id = ? AND org_id = ?
                    UNION
                    SELECT d.successor_id, down.n + 1 FROM work_item_dependencies d JOIN down ON d.predecessor_id = down.id
                    WHERE down.n < 500)
                UPDATE work_items w SET dependency_flag = NULL, dependency_flagged_at = NULL, updated_at = now()
                WHERE w.id IN (SELECT id FROM down) AND w.org_id = ? AND w.dependency_flag IS NOT NULL
                  AND NOT EXISTS (
                      WITH RECURSIVE up(id, n) AS (
                          SELECT predecessor_id, 1 FROM work_item_dependencies WHERE successor_id = w.id
                          UNION
                          SELECT d.predecessor_id, up.n + 1 FROM work_item_dependencies d JOIN up ON d.successor_id = up.id
                          WHERE up.n < 500)
                      SELECT 1 FROM up JOIN work_items p ON p.id = up.id WHERE p.state <> 'DONE')
                """, workItemId, orgId, orgId);
    }

    /** True when any prerequisite in the item's chain is not accepted: its own credit is suspended (task 3.5). */
    public boolean hasUnacceptedPrerequisite(String workItemId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                WITH RECURSIVE up(id, n) AS (
                    SELECT predecessor_id, 1 FROM work_item_dependencies WHERE successor_id = ?
                    UNION
                    SELECT d.predecessor_id, up.n + 1 FROM work_item_dependencies d JOIN up ON d.successor_id = up.id
                    WHERE up.n < 500)
                SELECT EXISTS (SELECT 1 FROM up JOIN work_items p ON p.id = up.id WHERE p.state <> 'DONE')
                """, Boolean.class, workItemId));
    }

    /** Links the item takes part in as a prerequisite: removing it needs explicit treatment of these first. */
    static void requireNoSuccessorLinks(JdbcTemplate jdbc, String workItemId) {
        List<String> successors = jdbc.queryForList("""
                SELECT s.key FROM work_item_dependencies d JOIN work_items s ON s.id = d.successor_id
                WHERE d.predecessor_id = ? ORDER BY s.key
                """, String.class, workItemId);
        if (!successors.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "DEPENDENCIES_EXIST",
                    "Other work depends on this item (" + String.join(", ", successors)
                            + "). Remove or replace those links first.");
        }
    }

    /* ================================================================== helpers */

    private List<Affected> affected(UUID orgId, String workItemId) {
        return jdbc.query("""
                WITH RECURSIVE down(id, n) AS (
                    SELECT successor_id, 1 FROM work_item_dependencies WHERE predecessor_id = ? AND org_id = ?
                    UNION
                    SELECT d.successor_id, down.n + 1 FROM work_item_dependencies d JOIN down ON d.predecessor_id = down.id
                    WHERE down.n < 500)
                SELECT w.id, w.key, w.title, w.state, min(down.n) AS distance
                FROM down JOIN work_items w ON w.id = down.id
                GROUP BY w.id, w.key, w.title, w.state ORDER BY min(down.n), w.key
                """, (rs, n) -> new Affected(rs.getString("id"), rs.getString("key"), rs.getString("title"),
                        rs.getString("state"), rs.getInt("distance")), workItemId, orgId);
    }

    private static final String LINK_SELECT = """
            SELECT d.id, d.predecessor_id, p.key AS p_key, p.title AS p_title, p.state AS p_state,
                   d.successor_id, s.key AS s_key, s.title AS s_title, s.state AS s_state, d.created_at
            FROM work_item_dependencies d
            JOIN work_items p ON p.id = d.predecessor_id
            JOIN work_items s ON s.id = d.successor_id
            """;

    private Link dependency(UUID id) {
        return jdbc.queryForObject(LINK_SELECT + " WHERE d.id = ?", (rs, n) -> link(rs), id);
    }

    private static Link link(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new Link(rs.getObject("id", UUID.class), rs.getString("predecessor_id"), rs.getString("p_key"),
                rs.getString("p_title"), rs.getString("p_state"), rs.getString("successor_id"), rs.getString("s_key"),
                rs.getString("s_title"), rs.getString("s_state"), rs.getTimestamp("created_at").toInstant());
    }

    private void requirePlanner(WorkItemService.Caller caller, String projectId) {
        if (!workItems.can(caller, projectId, PermissionKey.TASK_CREATE)
                && !workItems.can(caller, projectId, PermissionKey.TASK_ASSIGN)) {
            throw PermissionService.forbidden();
        }
    }

    /* ================================================================== API records */

    public record LinkRequest(String predecessorId) {}

    public record Link(UUID id, String predecessorId, String predecessorKey, String predecessorTitle, String predecessorState,
            String successorId, String successorKey, String successorTitle, String successorState, Instant createdAt) {}

    public record Affected(String workItemId, String key, String title, String state, int distance) {}

    public record LinkResult(Link dependency, List<Affected> affectedSuccessors) {}

    public record DependencyView(List<Link> blockedBy, List<Link> blocks, List<Affected> affected) {}
}
