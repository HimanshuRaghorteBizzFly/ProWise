package com.prowise.work;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.common.change.ChangeRecorder;

/**
 * Task 3.4: blockers (FR-024, T21). "Blocked" is a separate flag with reason, owner, severity and timestamps; raising
 * or clearing it never changes the workflow state. The primary assignee or a planner raises a blocker; the owner, the
 * reporter, the assignee or a planner resolves it. Uses the existing {@code task_blockers} table.
 */
@Service
public class BlockerService {

    private static final Set<String> SEVERITIES = Set.of("NORMAL", "CRITICAL");

    private final JdbcTemplate jdbc;
    private final WorkItemService workItems;
    private final ChangeRecorder changes;

    public BlockerService(JdbcTemplate jdbc, WorkItemService workItems, ChangeRecorder changes) {
        this.jdbc = jdbc;
        this.workItems = workItems;
        this.changes = changes;
    }

    @Transactional
    public BlockerView raise(Authentication authentication, String workItemId, RaiseRequest request) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        WorkItemService.Item item = workItems.visible(caller, workItemId);
        boolean assignee = caller.userId().toString().equals(item.primaryAssigneeId())
                && workItems.can(caller, item.projectId(), PermissionKey.TASK_UPDATE);
        if (!assignee && !planner(caller, item.projectId())) throw PermissionService.forbidden();
        String reason = text(request.reason(), 2000);
        if (reason == null) throw WorkItemService.validation("reason", "describe what is blocking the work");
        String severity = request.severity() == null || request.severity().isBlank() ? "NORMAL"
                : request.severity().trim().toUpperCase(Locale.ROOT);
        if (!SEVERITIES.contains(severity)) throw WorkItemService.validation("severity", "must be NORMAL or CRITICAL");
        UUID owner = request.ownerMembershipId() == null ? caller.userId()
                : workItems.projectMember(caller.orgId(), item.projectId(), request.ownerMembershipId(), "owner_membership_id");

        jdbc.queryForList("SELECT id FROM work_items WHERE id = ? FOR UPDATE", item.id());
        WorkItemService.Item locked = workItems.find(caller.orgId(), item.id());
        if ("DONE".equals(locked.state()) || "CANCELLED".equals(locked.state()) || "RETIRED".equals(locked.planStatus())) {
            throw WorkItemService.conflict("INVALID_TRANSITION", "Finished, cancelled or retired work cannot be blocked.");
        }
        String id = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO task_blockers (id, task_id, org_id, reason, severity, owner_id, opened_by, resolved, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, now())
                """, id, item.id(), caller.orgId(), reason, severity, owner.toString(), caller.userId());
        jdbc.update("UPDATE work_items SET is_blocked = TRUE, version = version + 1, updated_at = now() WHERE id = ?", item.id());
        Map<String, Object> data = Map.of("work_item_id", item.id(), "project_id", item.projectId(), "severity", severity,
                "owner_id", owner.toString());
        changes.record(
                new ChangeRecorder.AuditEntry(caller.orgId(), caller.userId(), "blocker.raised", "BLOCKER",
                        UUID.fromString(id), reason, null, data),
                new ChangeRecorder.DomainEvent(caller.orgId(), "BLOCKER", UUID.fromString(id), 0L, "BlockerRaised", data));
        return view(caller.orgId(), id);
    }

    @Transactional
    public BlockerView resolve(Authentication authentication, String blockerId, ResolveRequest request) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        List<Map<String, Object>> rows = blockerId == null ? List.of() : jdbc.queryForList(
                "SELECT task_id, owner_id, opened_by, resolved FROM task_blockers WHERE id = ? AND org_id = ?",
                blockerId, caller.orgId());
        if (rows.isEmpty()) throw PermissionService.notFound();
        Map<String, Object> row = rows.get(0);
        WorkItemService.Item item = workItems.visible(caller, (String) row.get("task_id"));
        String me = caller.userId().toString();
        boolean involved = me.equals(row.get("owner_id")) || caller.userId().equals(row.get("opened_by"))
                || me.equals(item.primaryAssigneeId()) || planner(caller, item.projectId());
        if (!involved) throw PermissionService.forbidden();
        if (Boolean.TRUE.equals(row.get("resolved"))) throw WorkItemService.conflict("ALREADY_RESOLVED", "This blocker is already cleared.");

        jdbc.queryForList("SELECT id FROM work_items WHERE id = ? FOR UPDATE", item.id());
        String resolution = text(request == null ? null : request.resolution(), 1000);
        int updated = jdbc.update("""
                UPDATE task_blockers SET resolved = TRUE, resolved_at = now(), resolved_by = ?, resolution = ?
                WHERE id = ? AND NOT resolved
                """, caller.userId(), resolution, blockerId);
        if (updated == 0) throw WorkItemService.conflict("ALREADY_RESOLVED", "This blocker is already cleared.");
        // The flag stays while other blockers are open; the workflow state never changes here.
        jdbc.update("""
                UPDATE work_items SET is_blocked = EXISTS (SELECT 1 FROM task_blockers b WHERE b.task_id = work_items.id
                    AND NOT b.resolved), version = version + 1, updated_at = now()
                WHERE id = ?
                """, item.id());
        Map<String, Object> data = Map.of("work_item_id", item.id(), "project_id", item.projectId());
        changes.record(
                new ChangeRecorder.AuditEntry(caller.orgId(), caller.userId(), "blocker.resolved", "BLOCKER",
                        uuid(blockerId), resolution, Map.of("resolved", false), Map.of("resolved", true)),
                new ChangeRecorder.DomainEvent(caller.orgId(), "BLOCKER", uuid(blockerId), 1L, "BlockerResolved", data));
        return view(caller.orgId(), blockerId);
    }

    @Transactional(readOnly = true)
    public List<BlockerView> forWorkItem(Authentication authentication, String workItemId) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        WorkItemService.Item item = workItems.visible(caller, workItemId);
        return jdbc.query(SELECT + " WHERE b.task_id = ? AND b.org_id = ? ORDER BY b.resolved, b.created_at DESC",
                (rs, n) -> view(rs), item.id(), caller.orgId());
    }

    /** Blockers on the caller's own work or owned by the caller, newest first, on projects they can read. */
    @Transactional(readOnly = true)
    public List<BlockerView> mine(Authentication authentication) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        Map<String, Boolean> readable = new java.util.HashMap<>();
        List<BlockerView> result = new java.util.ArrayList<>();
        jdbc.query(SELECT + """
                 WHERE b.org_id = ? AND (w.primary_assignee_id = ? OR b.owner_id = ?)
                 ORDER BY b.resolved, (b.severity = 'CRITICAL') DESC, b.created_at DESC
                """, rs -> {
            String projectId = rs.getString("project_id");
            // Projects the caller can no longer read are skipped quietly (one check per project, no denial evidence).
            if (readable.computeIfAbsent(projectId, id -> workItems.readableQuietly(caller, id))) result.add(view(rs));
        }, caller.orgId(), caller.userId().toString(), caller.userId().toString());
        return result;
    }

    @Transactional(readOnly = true)
    public List<BlockerView> openForProject(Authentication authentication, String projectId) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        workItems.readableProject(caller, projectId);
        return jdbc.query(SELECT + " WHERE w.project_id = ? AND b.org_id = ? AND NOT b.resolved "
                        + "ORDER BY (b.severity = 'CRITICAL') DESC, b.created_at",
                (rs, n) -> view(rs), projectId, caller.orgId());
    }

    /* ================================================================== helpers */

    private static final String SELECT = """
            SELECT b.id, b.task_id, w.project_id, w.key, w.title, b.reason, b.severity, b.owner_id, ou.email AS owner_email,
                   b.opened_by, b.resolved, b.resolution, b.created_at, b.resolved_at
            FROM task_blockers b
            JOIN work_items w ON w.id = b.task_id
            LEFT JOIN users ou ON CAST(ou.id AS text) = b.owner_id
            """;

    private BlockerView view(UUID orgId, String id) {
        return jdbc.queryForObject(SELECT + " WHERE b.id = ? AND b.org_id = ?", (rs, n) -> view(rs), id, orgId);
    }

    private static BlockerView view(java.sql.ResultSet rs) throws java.sql.SQLException {
        Instant opened = rs.getTimestamp("created_at").toInstant();
        Instant resolvedAt = rs.getTimestamp("resolved_at") == null ? null : rs.getTimestamp("resolved_at").toInstant();
        long ageHours = Duration.between(opened, resolvedAt == null ? Instant.now() : resolvedAt).toHours();
        String ownerId = rs.getString("owner_id");
        return new BlockerView(rs.getString("id"), rs.getString("task_id"), rs.getString("key"), rs.getString("title"),
                rs.getString("reason"), rs.getString("severity"),
                ownerId == null ? null : new WorkItemService.PersonSummary(ownerId, rs.getString("owner_email")),
                rs.getObject("opened_by", UUID.class), rs.getBoolean("resolved"), rs.getString("resolution"), opened,
                resolvedAt, ageHours);
    }

    private boolean planner(WorkItemService.Caller caller, String projectId) {
        return workItems.can(caller, projectId, PermissionKey.TASK_CREATE)
                || workItems.can(caller, projectId, PermissionKey.TASK_ASSIGN);
    }

    private static UUID uuid(String id) {
        return WorkItemService.uuidOf(id);
    }

    private static String text(String value, int max) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return null;
        if (trimmed.length() > max) throw WorkItemService.validation("text", "is longer than " + max + " characters");
        return trimmed;
    }

    /* ================================================================== API records */

    public record RaiseRequest(String reason, String severity, UUID ownerMembershipId) {}

    public record ResolveRequest(String resolution) {}

    public record BlockerView(String id, String workItemId, String workItemKey, String workItemTitle, String reason,
            String severity, WorkItemService.PersonSummary owner, UUID openedBy, boolean resolved, String resolution,
            Instant openedAt, Instant resolvedAt, long ageHours) {}
}
