package com.prowise.work;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.domain.DependencyGraph;
import com.prowise.domain.DependencyGraph.Link;
import com.prowise.domain.DependencyGraph.Problem;
import com.prowise.domain.WorkBreakdown;
import com.prowise.project.ProjectService;
import com.prowise.project.ProjectService.ProjectResponse;

/**
 * Task 3.4: Finish-to-Start links between tasks of one project. Graph changes are serialized per project (the project
 * row is locked), so two simultaneous reverse links cannot form a loop. Every change returns the affected successors.
 * A reopened accepted predecessor flags its successors for review; nothing is reversed and no date moves.
 */
@Service
public class DependencyService {

    private final JdbcTemplate jdbc;
    private final ProjectService projects;
    private final PermissionService permissions;
    private final ChangeRecorder changes;
    private final WorkService work;

    public DependencyService(JdbcTemplate jdbc, ProjectService projects, PermissionService permissions, ChangeRecorder changes,
            WorkService work) {
        this.jdbc = jdbc;
        this.projects = projects;
        this.permissions = permissions;
        this.changes = changes;
        this.work = work;
    }

    public record ItemRef(String id, String key, String title, String state) {}

    public record LinkView(UUID id, String predecessorId, String successorId, Instant createdAt) {}

    public record Flag(String workItemId, String reason, Instant flaggedAt) {}

    public record Board(List<LinkView> links, List<Flag> flags, List<BlockerService.Blocker> blockers) {}

    public record Change(LinkView link, List<ItemRef> affected) {}

    public record LinkRequest(String predecessorId, Long expectedVersion) {}

    public record ReleaseRequest(String treatment, Long expectedVersion) {}

    public record VersionRequest(Long expectedVersion) {}

    /* ================================================================== reads */

    /** Links, review flags and open blockers of a project (for the Breakdown tab: "Blocked by" / "Blocks"). */
    @Transactional(readOnly = true)
    public Board board(UUID orgId, String projectId, Authentication auth, BlockerService blockers) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        List<Flag> flags = jdbc.query("""
                SELECT id, dependency_flag_reason, dependency_flagged_at FROM work_items
                WHERE org_id = ? AND project_id = ? AND dependency_flagged_at IS NOT NULL AND retired_at IS NULL
                ORDER BY dependency_flagged_at
                """, (rs, n) -> new Flag(rs.getString(1), rs.getString(2), rs.getTimestamp(3).toInstant()), orgId, project.id());
        return new Board(linkViews(orgId, project.id()), flags, blockers.openInProject(orgId, project.id()));
    }

    /* ================================================================== link changes */

    @Transactional
    public Change link(UUID orgId, String projectId, String successorId, Authentication auth, LinkRequest request) {
        ProjectResponse project = work.editableStructured(orgId, projectId, auth);
        if (request.expectedVersion() == null) throw WorkService.validation("expected_version", "is required");
        if (request.predecessorId() == null || request.predecessorId().isBlank()) throw WorkService.validation("predecessor_id", "is required");
        work.lockProject(orgId, project.id()); // serializes graph changes of this project
        Map<String, WorkService.ItemRow> rows = work.rows(orgId, project.id());
        WorkService.ItemRow successor = linkable(orgId, rows, successorId);
        WorkService.ItemRow predecessor = linkable(orgId, rows, request.predecessorId());
        ExpectedVersion.check(successor.version(), request.expectedVersion());
        List<Link> links = links(orgId, project.id());
        Optional<Problem> problem = DependencyGraph.canLink(links, predecessor.id(), successor.id());
        if (problem.isPresent()) {
            throw switch (problem.get()) {
                case SELF_LINK -> WorkService.validation("predecessor_id", "A task cannot depend on itself.");
                case DUPLICATE -> conflict("DUPLICATE_DEPENDENCY", "This link already exists.");
                case CYCLE -> conflict("DEPENDENCY_CYCLE", "This link would make a loop: " + successor.key() + " already comes before "
                        + predecessor.key() + ".");
            };
        }
        UUID userId = permissions.principal(auth).userId();
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO work_item_dependencies (id, org_id, project_id, predecessor_id, successor_id, created_by) VALUES (?, ?, ?, ?, ?, ?)",
                id, orgId, project.id(), predecessor.id(), successor.id(), userId);
        bump(orgId, successor.id(), request.expectedVersion());
        List<Link> after = links(orgId, project.id());
        List<ItemRef> affected = refs(orgId, withFirst(successor.id(), DependencyGraph.affected(after, successor.id())));
        record(orgId, userId, project, "dependency.linked", successor.id(), null,
                payload(predecessor.id(), successor.id(), affected), "DependencyLinked");
        return new Change(view(orgId, id), affected);
    }

    @Transactional
    public Change unlink(UUID orgId, String projectId, String successorId, UUID linkId, Authentication auth, VersionRequest request) {
        ProjectResponse project = work.editableStructured(orgId, projectId, auth);
        if (request.expectedVersion() == null) throw WorkService.validation("expected_version", "is required");
        work.lockProject(orgId, project.id());
        LinkView link = jdbc.query("SELECT id, predecessor_id, successor_id, created_at FROM work_item_dependencies WHERE id = ? AND org_id = ? AND project_id = ? AND successor_id = ?",
                (rs, n) -> linkView(rs), linkId, orgId, project.id(), successorId).stream().findFirst().orElseThrow(PermissionService::notFound);
        WorkService.ItemRow successor = work.rows(orgId, project.id()).get(successorId);
        if (successor == null) throw PermissionService.notFound();
        ExpectedVersion.check(successor.version(), request.expectedVersion());
        List<ItemRef> affected = refs(orgId, withFirst(successorId, DependencyGraph.affected(links(orgId, project.id()), successorId)));
        jdbc.update("DELETE FROM work_item_dependencies WHERE id = ? AND org_id = ?", linkId, orgId);
        bump(orgId, successorId, request.expectedVersion());
        UUID userId = permissions.principal(auth).userId();
        record(orgId, userId, project, "dependency.removed", successorId, null,
                payload(link.predecessorId(), link.successorId(), affected), "DependencyRemoved");
        return new Change(link, affected);
    }

    /**
     * Explicit treatment of an item's links before it is removed or cancelled: DROP removes them; BRIDGE also links each of
     * its predecessors to each of its successors so the successors keep waiting on the same earlier work.
     */
    @Transactional
    public Change release(UUID orgId, String projectId, String itemId, Authentication auth, ReleaseRequest request) {
        ProjectResponse project = work.editableStructured(orgId, projectId, auth);
        if (request.expectedVersion() == null) throw WorkService.validation("expected_version", "is required");
        String treatment = request.treatment() == null ? "" : request.treatment().trim().toUpperCase();
        if (!List.of("DROP", "BRIDGE").contains(treatment)) throw WorkService.validation("treatment", "must be DROP or BRIDGE");
        work.lockProject(orgId, project.id());
        WorkService.ItemRow item = work.rows(orgId, project.id()).get(itemId);
        if (item == null) throw PermissionService.notFound();
        ExpectedVersion.check(item.version(), request.expectedVersion());
        List<Link> links = links(orgId, project.id());
        List<ItemRef> affected = refs(orgId, DependencyGraph.affected(links, itemId));
        UUID userId = permissions.principal(auth).userId();
        List<Link> bridged = "BRIDGE".equals(treatment) ? DependencyGraph.bridge(links, itemId) : List.of();
        jdbc.update("DELETE FROM work_item_dependencies WHERE org_id = ? AND project_id = ? AND (predecessor_id = ? OR successor_id = ?)",
                orgId, project.id(), itemId, itemId);
        for (Link link : bridged) {
            jdbc.update("INSERT INTO work_item_dependencies (id, org_id, project_id, predecessor_id, successor_id, created_by) VALUES (?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID(), orgId, project.id(), link.predecessor(), link.successor(), userId);
        }
        bump(orgId, itemId, request.expectedVersion());
        Map<String, Object> next = new LinkedHashMap<>();
        next.put("treatment", treatment);
        next.put("bridged", bridged.stream().map(l -> l.predecessor() + "->" + l.successor()).toList());
        next.put("affected", affected.stream().map(ItemRef::id).toList());
        record(orgId, userId, project, "dependency.links_released", itemId, Map.of("links", links.size()), next, "DependencyLinksReleased");
        return new Change(null, affected);
    }

    /** The project manager or the assignee confirms a flagged successor was reviewed after its predecessor reopened. */
    @Transactional
    public ItemRef clearFlag(UUID orgId, String projectId, String itemId, Authentication auth, VersionRequest request) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        if (request.expectedVersion() == null) throw WorkService.validation("expected_version", "is required");
        work.lockProject(orgId, project.id());
        WorkService.ItemRow item = work.rows(orgId, project.id()).get(itemId);
        if (item == null) throw PermissionService.notFound();
        UUID membershipId = permissions.requireMembership(auth, orgId);
        boolean assignee = membershipId.equals(item.assignee());
        if (!assignee && !permissions.canOnProject(auth, orgId, project.id(), PermissionKey.PROJECT_EDIT.value())) throw PermissionService.forbidden();
        ExpectedVersion.check(item.version(), request.expectedVersion());
        String reason = jdbc.queryForObject("SELECT dependency_flag_reason FROM work_items WHERE id = ? AND org_id = ?", String.class, itemId, orgId);
        if (reason == null) throw conflict("NOT_FLAGGED", "This task is not flagged for review.");
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE work_items SET dependency_flagged_at = NULL, dependency_flag_reason = NULL, version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, itemId, orgId, request.expectedVersion()));
        record(orgId, permissions.principal(auth).userId(), project, "dependency.flag_cleared", itemId, Map.of("reason", reason),
                Map.of("work_item_id", itemId), "DependencyFlagCleared");
        return refs(orgId, List.of(itemId)).get(0);
    }

    /* ================================================================== used by other services */

    /** Predecessors of a task that are not accepted yet (Done with an approved revision). Empty = the task may start. */
    List<ItemRef> unfinishedPredecessors(UUID orgId, String itemId) {
        return jdbc.query("""
                SELECT p.id, p.key, p.title, p.state FROM work_item_dependencies d
                JOIN work_items p ON p.id = d.predecessor_id AND p.org_id = d.org_id
                WHERE d.org_id = ? AND d.successor_id = ? AND NOT (p.state = 'DONE' AND p.accepted_revision IS NOT NULL)
                ORDER BY p.key
                """, (rs, n) -> new ItemRef(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4)), orgId, itemId);
    }

    /** Flags every successor (direct or further down) of a reopened task for review; returns them. */
    @Transactional(propagation = Propagation.MANDATORY)
    List<ItemRef> flagSuccessors(UUID orgId, String projectId, String itemId, String itemKey) {
        List<String> affected = DependencyGraph.affected(links(orgId, projectId), itemId);
        for (String id : affected) {
            jdbc.update("""
                    UPDATE work_items SET dependency_flagged_at = now(), dependency_flag_reason = ?, version = version + 1, updated_at = now()
                    WHERE id = ? AND org_id = ? AND retired_at IS NULL
                    """, "Predecessor " + itemKey + " was reopened. Check this work still holds.", id, orgId);
        }
        return refs(orgId, affected);
    }

    /** Refuses removing or cancelling a task that still has links: they need explicit treatment first (release). */
    static void requireNoLinks(JdbcTemplate jdbc, UUID orgId, String itemId, String key) {
        Integer count = jdbc.queryForObject(
                "SELECT count(*) FROM work_item_dependencies WHERE org_id = ? AND (predecessor_id = ? OR successor_id = ?)",
                Integer.class, orgId, itemId, itemId);
        if (count != null && count > 0) {
            throw conflict("LINKS_NEED_TREATMENT", (key == null ? "This task" : key)
                    + " has dependency links. Drop them or bridge them to the surrounding tasks first.");
        }
    }

    /* ================================================================== helpers */

    private WorkService.ItemRow linkable(UUID orgId, Map<String, WorkService.ItemRow> rows, String itemId) {
        WorkService.ItemRow row = rows.get(itemId);
        if (row == null) throw PermissionService.notFound(); // unknown, foreign, other project, retired or proposed
        boolean leaf = WorkBreakdown.measurable(row.level()) && rows.values().stream().noneMatch(r -> itemId.equals(r.parentId()));
        if (!leaf) throw conflict("NOT_A_LEAF", "Only tasks and subtasks without children are linked.");
        Boolean cancelled = jdbc.queryForObject("SELECT cancelled_at IS NOT NULL FROM work_items WHERE id = ? AND org_id = ?", Boolean.class, itemId, orgId);
        if (Boolean.TRUE.equals(cancelled)) throw conflict("TASK_CANCELLED", "Cancelled tasks are not linked.");
        return row;
    }

    List<Link> links(UUID orgId, String projectId) {
        return jdbc.query("SELECT predecessor_id, successor_id FROM work_item_dependencies WHERE org_id = ? AND project_id = ? ORDER BY created_at, id",
                (rs, n) -> new Link(rs.getString(1), rs.getString(2)), orgId, projectId);
    }

    private List<LinkView> linkViews(UUID orgId, String projectId) {
        return jdbc.query("SELECT id, predecessor_id, successor_id, created_at FROM work_item_dependencies WHERE org_id = ? AND project_id = ? ORDER BY created_at, id",
                (rs, n) -> linkView(rs), orgId, projectId);
    }

    private LinkView view(UUID orgId, UUID id) {
        return jdbc.queryForObject("SELECT id, predecessor_id, successor_id, created_at FROM work_item_dependencies WHERE id = ? AND org_id = ?",
                (rs, n) -> linkView(rs), id, orgId);
    }

    private static LinkView linkView(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new LinkView(rs.getObject("id", UUID.class), rs.getString("predecessor_id"), rs.getString("successor_id"),
                rs.getTimestamp("created_at").toInstant());
    }

    private List<ItemRef> refs(UUID orgId, List<String> ids) {
        if (ids.isEmpty()) return List.of();
        Map<String, ItemRef> byId = new HashMap<>();
        jdbc.query("SELECT id, key, title, state FROM work_items WHERE org_id = ? AND id = ANY (?)",
                (org.springframework.jdbc.core.RowCallbackHandler) rs -> byId.put(rs.getString(1),
                        new ItemRef(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4))),
                orgId, ids.toArray(String[]::new));
        List<ItemRef> ordered = new ArrayList<>();
        for (String id : ids) if (byId.containsKey(id)) ordered.add(byId.get(id));
        return ordered;
    }

    private static List<String> withFirst(String first, List<String> rest) {
        List<String> all = new ArrayList<>(List.of(first));
        rest.stream().filter(id -> !id.equals(first)).forEach(all::add);
        return all;
    }

    private void bump(UUID orgId, String itemId, long expectedVersion) {
        ExpectedVersion.requireUpdated(jdbc.update("UPDATE work_items SET version = version + 1, updated_at = now() WHERE id = ? AND org_id = ? AND version = ?",
                itemId, orgId, expectedVersion));
    }

    private static Map<String, Object> payload(String predecessorId, String successorId, List<ItemRef> affected) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("predecessor_id", predecessorId);
        p.put("successor_id", successorId);
        p.put("affected", affected.stream().map(ItemRef::id).toList());
        return p;
    }

    private void record(UUID orgId, UUID userId, ProjectResponse project, String action, String itemId, Map<String, ?> previous,
            Map<String, Object> next, String eventType) {
        Map<String, Object> payload = new LinkedHashMap<>(next);
        payload.put("project_id", project.id());
        payload.put("work_item_id", itemId);
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, userId, action, "WORK_ITEM", UUID.fromString(itemId), null, previous, payload),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(project.id()), project.version(), eventType, payload));
    }

    private static ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }
}
