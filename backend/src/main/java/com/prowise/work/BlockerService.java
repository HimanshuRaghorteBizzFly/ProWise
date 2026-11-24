package com.prowise.work;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.domain.DependencyGraph;
import com.prowise.project.ProjectService;
import com.prowise.project.ProjectService.ProjectResponse;
import com.prowise.work.DependencyService.ItemRef;
import com.prowise.work.WorkDTOs.PersonRef;

/**
 * Task 3.4: blockers on tasks of a Structured project (reason, owner, severity, timestamps, resolution). "Blocked" is a
 * separate flag (work_items.is_blocked): raising or clearing a blocker never changes the task's workflow state.
 */
@Service
public class BlockerService {

    private static final List<String> SEVERITIES = List.of("NORMAL", "CRITICAL");

    private final JdbcTemplate jdbc;
    private final ProjectService projects;
    private final PermissionService permissions;
    private final ChangeRecorder changes;
    private final WorkService work;
    private final DependencyService dependencies;

    public BlockerService(JdbcTemplate jdbc, ProjectService projects, PermissionService permissions, ChangeRecorder changes,
            WorkService work, DependencyService dependencies) {
        this.jdbc = jdbc;
        this.projects = projects;
        this.permissions = permissions;
        this.changes = changes;
        this.work = work;
        this.dependencies = dependencies;
    }

    public record Blocker(String id, String workItemId, String workItemKey, String reason, String severity, PersonRef owner,
            String openedByEmail, Instant openedAt, Instant resolvedAt, String resolution, String resolvedByEmail, long version) {}

    public record Raised(Blocker blocker, List<ItemRef> affected) {}

    public record BlockerRequest(String reason, String severity, UUID ownerMembershipId, Long expectedVersion) {}

    public record ResolveRequest(String resolution, Long expectedVersion) {}

    private static final String SELECT = """
            SELECT b.id, b.task_id, w.key, b.reason, b.severity, b.owner_membership_id, ou.email AS owner_email, opener.email AS opened_by_email,
                   b.created_at, b.resolved_at, b.resolution, resolver.email AS resolved_by_email, b.version
            FROM task_blockers b
            JOIN work_items w ON w.id = b.task_id AND w.org_id = b.org_id
            LEFT JOIN memberships om ON om.id = b.owner_membership_id AND om.org_id = b.org_id
            LEFT JOIN users ou ON ou.id = om.user_id
            LEFT JOIN users opener ON opener.id = b.opened_by
            LEFT JOIN users resolver ON resolver.id = b.resolved_by_user
            """;

    /* ================================================================== reads */

    @Transactional(readOnly = true)
    public List<Blocker> list(UUID orgId, String projectId, String itemId, Authentication auth) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        if (!work.rows(orgId, project.id()).containsKey(itemId)) throw PermissionService.notFound();
        return jdbc.query(SELECT + " WHERE b.org_id = ? AND b.task_id = ? AND b.opened_by IS NOT NULL ORDER BY b.created_at DESC, b.id",
                (rs, n) -> map(rs), orgId, itemId);
    }

    /** A blocker with its project and the work it holds up. */
    public record ProjectBlocker(String projectId, String projectKey, String projectName, Blocker blocker, List<ItemRef> affected,
            boolean canResolve) {}

    /** Open blockers of every Structured project the caller may read, critical first, then oldest. */
    @Transactional(readOnly = true)
    public List<ProjectBlocker> orgOpen(UUID orgId, Authentication auth) {
        UUID me = permissions.requireMembership(auth, orgId);
        UUID userId = permissions.principal(auth).userId();
        List<ProjectBlocker> result = new java.util.ArrayList<>();
        for (ProjectResponse project : projects.readable(orgId, auth, "STRUCTURED")) {
            for (Blocker b : openInProject(orgId, project.id())) {
                result.add(new ProjectBlocker(project.id(), project.key(), project.name(), b, affected(orgId, project.id(), b.workItemId()),
                        mayResolve(auth, orgId, project, b, me, userId)));
            }
        }
        result.sort((a, b) -> {
            int severity = Boolean.compare("CRITICAL".equals(b.blocker().severity()), "CRITICAL".equals(a.blocker().severity()));
            return severity != 0 ? severity : a.blocker().openedAt().compareTo(b.blocker().openedAt());
        });
        return result;
    }

    /** One blocker (open or cleared) when its project is readable; otherwise 404 with no metadata. */
    @Transactional(readOnly = true)
    public ProjectBlocker orgBlocker(UUID orgId, String blockerId, Authentication auth) {
        String projectId = jdbc.query("""
                SELECT w.project_id FROM task_blockers b JOIN work_items w ON w.id = b.task_id AND w.org_id = b.org_id
                WHERE b.id = ? AND b.org_id = ? AND b.opened_by IS NOT NULL AND w.retired_at IS NULL
                """, (rs, n) -> rs.getString(1), blockerId, orgId).stream().findFirst().orElseThrow(PermissionService::notFound);
        ProjectResponse project = projects.get(orgId, projectId, auth);
        Blocker b = one(orgId, blockerId);
        UUID me = permissions.requireMembership(auth, orgId);
        return new ProjectBlocker(project.id(), project.key(), project.name(), b, affected(orgId, project.id(), b.workItemId()),
                b.resolvedAt() == null && mayResolve(auth, orgId, project, b, me, permissions.principal(auth).userId()));
    }

    private boolean mayResolve(Authentication auth, UUID orgId, ProjectResponse project, Blocker b, UUID me, UUID userId) {
        if (project.archived()) return false;
        if (b.owner() != null && me.equals(b.owner().membershipId())) return true;
        Boolean opener = jdbc.queryForObject("SELECT opened_by = ? FROM task_blockers WHERE id = ? AND org_id = ?", Boolean.class, userId, b.id(), orgId);
        return Boolean.TRUE.equals(opener) || permissions.canOnProject(auth, orgId, project.id(), PermissionKey.PROJECT_EDIT.value());
    }

    /** Open blockers of a project, oldest first (age feeds health in 5.1). */
    List<Blocker> openInProject(UUID orgId, String projectId) {
        return jdbc.query(SELECT + """
                 WHERE b.org_id = ? AND w.project_id = ? AND b.opened_by IS NOT NULL AND b.resolved = false AND w.retired_at IS NULL
                 ORDER BY b.created_at, b.id
                """, (rs, n) -> map(rs), orgId, projectId);
    }

    /* ================================================================== changes */

    @Transactional
    public Raised raise(UUID orgId, String projectId, String itemId, Authentication auth, BlockerRequest request) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        if (!"STRUCTURED".equals(project.mode())) throw conflict("PROJECT_NOT_STRUCTURED", "Only Structured projects have tasks.");
        if (project.archived()) throw conflict("PROJECT_ARCHIVED", "Archived projects are read-only.");
        if (!permissions.canOnProject(auth, orgId, project.id(), PermissionKey.TASK_UPDATE.value())) throw PermissionService.forbidden();
        if (request.expectedVersion() == null) throw WorkService.validation("expected_version", "is required");
        String reason = request.reason() == null ? "" : request.reason().trim();
        if (reason.isEmpty() || reason.length() > 2000) throw WorkService.validation("reason", "Say what blocks the work (up to 2000 characters).");
        String severity = request.severity() == null ? "NORMAL" : request.severity().trim().toUpperCase();
        if (!SEVERITIES.contains(severity)) throw WorkService.validation("severity", "must be NORMAL or CRITICAL");
        if (request.ownerMembershipId() == null) throw WorkService.validation("owner_membership_id", "Name who will clear the blocker.");
        work.activeMember(orgId, request.ownerMembershipId(), "owner_membership_id");
        work.lockProject(orgId, project.id());
        WorkService.ItemRow item = work.rows(orgId, project.id()).get(itemId);
        if (item == null) throw PermissionService.notFound();
        ExpectedVersion.check(item.version(), request.expectedVersion());
        String state = jdbc.queryForObject("SELECT state FROM work_items WHERE id = ? AND org_id = ?", String.class, itemId, orgId);
        if ("DONE".equals(state)) throw conflict("TASK_DONE", "A Done task cannot be blocked. Reopen it first.");
        UUID userId = permissions.principal(auth).userId();
        // The owner must be able to see the task to clear the blocker (same rule as assignment).
        work.ensureProjectMember(orgId, project.id(), request.ownerMembershipId(), userId);
        String id = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO task_blockers (id, org_id, task_id, reason, severity, owner_membership_id, opened_by, resolved, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, false, now())
                """, id, orgId, itemId, reason, severity, request.ownerMembershipId(), userId);
        // Only the separate flag changes; the workflow state stays as it was.
        ExpectedVersion.requireUpdated(jdbc.update(
                "UPDATE work_items SET is_blocked = true, version = version + 1, updated_at = now() WHERE id = ? AND org_id = ? AND version = ?",
                itemId, orgId, request.expectedVersion()));
        Blocker blocker = one(orgId, id);
        List<ItemRef> affected = affected(orgId, project.id(), itemId);
        Map<String, Object> next = snapshot(blocker);
        next.put("affected", affected.stream().map(ItemRef::id).toList());
        record(orgId, userId, project, "blocker.raised", itemId, null, next, "BlockerRaised");
        return new Raised(blocker, affected);
    }

    @Transactional
    public Raised resolve(UUID orgId, String projectId, String itemId, String blockerId, Authentication auth, ResolveRequest request) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        if (project.archived()) throw conflict("PROJECT_ARCHIVED", "Archived projects are read-only.");
        if (request.expectedVersion() == null) throw WorkService.validation("expected_version", "is required");
        String resolution = request.resolution() == null ? "" : request.resolution().trim();
        if (resolution.isEmpty() || resolution.length() > 2000) throw WorkService.validation("resolution", "Say how the blocker was cleared.");
        work.lockProject(orgId, project.id());
        if (!work.rows(orgId, project.id()).containsKey(itemId)) throw PermissionService.notFound();
        List<Map<String, Object>> found = jdbc.queryForList(
                "SELECT owner_membership_id, opened_by, resolved, version FROM task_blockers WHERE id = ? AND org_id = ? AND task_id = ? AND opened_by IS NOT NULL FOR UPDATE",
                blockerId, orgId, itemId);
        if (found.isEmpty()) throw PermissionService.notFound();
        Map<String, Object> row = found.get(0);
        UUID userId = permissions.principal(auth).userId();
        UUID membershipId = permissions.requireMembership(auth, orgId);
        boolean mayResolve = membershipId.equals(row.get("owner_membership_id")) || userId.equals(row.get("opened_by"))
                || permissions.canOnProject(auth, orgId, project.id(), PermissionKey.PROJECT_EDIT.value());
        if (!mayResolve) throw PermissionService.forbidden();
        ExpectedVersion.check(((Number) row.get("version")).longValue(), request.expectedVersion());
        if (Boolean.TRUE.equals(row.get("resolved"))) throw conflict("BLOCKER_RESOLVED", "This blocker is already cleared.");
        Blocker before = one(orgId, blockerId);
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE task_blockers SET resolved = true, resolved_at = now(), resolution = ?, resolved_by_user = ?, version = version + 1
                WHERE id = ? AND org_id = ? AND version = ?
                """, resolution, userId, blockerId, orgId, request.expectedVersion()));
        // Clearing the last open blocker clears the flag; the workflow state is never touched.
        jdbc.update("""
                UPDATE work_items SET is_blocked = EXISTS (SELECT 1 FROM task_blockers b WHERE b.task_id = work_items.id AND b.org_id = work_items.org_id
                    AND b.resolved = false), version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ?
                """, itemId, orgId);
        Blocker after = one(orgId, blockerId);
        List<ItemRef> affected = affected(orgId, project.id(), itemId);
        Map<String, Object> next = snapshot(after);
        next.put("affected", affected.stream().map(ItemRef::id).toList());
        record(orgId, userId, project, "blocker.resolved", itemId, snapshot(before), next, "BlockerResolved");
        return new Raised(after, affected);
    }

    /* ================================================================== helpers */

    private List<ItemRef> affected(UUID orgId, String projectId, String itemId) {
        List<String> ids = DependencyGraph.affected(dependencies.links(orgId, projectId), itemId);
        if (ids.isEmpty()) return List.of();
        return jdbc.query("SELECT id, key, title, state FROM work_items WHERE org_id = ? AND id = ANY (?) ORDER BY key",
                (rs, n) -> new ItemRef(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4)), orgId, ids.toArray(String[]::new));
    }

    private Blocker one(UUID orgId, String id) {
        return jdbc.queryForObject(SELECT + " WHERE b.id = ? AND b.org_id = ?", (rs, n) -> map(rs), id, orgId);
    }

    private static Blocker map(ResultSet rs) throws SQLException {
        UUID owner = rs.getObject("owner_membership_id", UUID.class);
        return new Blocker(rs.getString("id"), rs.getString("task_id"), rs.getString("key"), rs.getString("reason"), rs.getString("severity"),
                owner == null ? null : new PersonRef(owner, rs.getString("owner_email")), rs.getString("opened_by_email"),
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("resolved_at") == null ? null : rs.getTimestamp("resolved_at").toInstant(),
                rs.getString("resolution"), rs.getString("resolved_by_email"), rs.getLong("version"));
    }

    private static Map<String, Object> snapshot(Blocker b) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("blocker_id", b.id());
        s.put("severity", b.severity());
        s.put("owner_membership_id", b.owner() == null ? null : b.owner().membershipId().toString());
        s.put("resolved", b.resolvedAt() != null);
        return s;
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
