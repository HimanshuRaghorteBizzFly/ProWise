package com.prowise.work;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.authz.RoleService;
import com.prowise.common.api.CursorPage;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.domain.StructuredProgress;
import com.prowise.project.ProjectService;

/**
 * Reads and small writes of the delivery flow that sit across modules: the approver's review queue, per-task activity
 * history, project approvers, and the progress overview shown on the PM / Team Lead / QA / Owner / Admin pages.
 * Every read goes through the task 2.1 project rule; the organization always comes from the token.
 */
@Service
public class ProjectFlowService {

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;
    private final ProjectService projects;
    private final WorkItemService workItems;
    private final ProjectApprovers approvers;
    private final AcceptedWork acceptedWork;

    public ProjectFlowService(JdbcTemplate jdbc, PermissionService permissions, ProjectService projects,
            WorkItemService workItems, ProjectApprovers approvers, AcceptedWork acceptedWork) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.projects = projects;
        this.workItems = workItems;
        this.approvers = approvers;
        this.acceptedWork = acceptedWork;
    }

    /* ================================================================== review queue */

    /**
     * Work waiting for the caller's decision: Team tasks In review and Solo submissions pending, only in projects
     * where the caller is a chosen approver, never their own work.
     */
    @Transactional(readOnly = true)
    public List<QueueItem> reviewQueue(Authentication authentication) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        List<String> projectIds = jdbc.queryForList("""
                SELECT DISTINCT CAST(g.scope_id AS text) FROM grants g
                JOIN memberships m ON m.id = g.membership_id AND m.org_id = g.org_id
                WHERE g.org_id = ? AND m.user_id = ? AND m.status = 'ACTIVE' AND g.scope = 'PROJECT' AND g.template_role_id = ?
                  AND (g.expires_at IS NULL OR g.expires_at > now())
                UNION
                SELECT p.id FROM projects p
                JOIN memberships pm ON pm.id = p.project_manager_membership_id AND pm.org_id = p.org_id
                WHERE p.org_id = ? AND pm.user_id = ? AND pm.status = 'ACTIVE'
                """, String.class, caller.orgId(), caller.userId(), RoleService.PROJECT_APPROVER_TEMPLATE_ID,
                caller.orgId(), caller.userId());
        List<QueueItem> queue = new ArrayList<>();
        for (String projectId : projectIds) {
            if (!projects.readable(caller.orgId(), projectId, authentication)) continue;
            Map<String, Object> project = jdbc.queryForMap(
                    "SELECT key, name, mode, archived FROM projects WHERE id = ? AND org_id = ?", projectId, caller.orgId());
            if (Boolean.TRUE.equals(project.get("archived"))) continue;
            ProjectRef ref = new ProjectRef(projectId, (String) project.get("key"), (String) project.get("name"),
                    (String) project.get("mode"));
            queue.addAll(jdbc.query("""
                    SELECT w.id, w.key, w.title, w.weight, w.submitted_revision, s.note, s.submitted_at, u.email
                    FROM work_items w
                    JOIN work_item_submissions s ON s.work_item_id = w.id AND s.revision = w.submitted_revision AND s.status = 'SUBMITTED'
                    JOIN users u ON u.id = s.submitted_by
                    WHERE w.org_id = ? AND w.project_id = ? AND w.state = 'IN_REVIEW'
                      AND COALESCE(w.primary_assignee_id, '') <> ? AND s.submitted_by <> ?
                      AND (w.reviewer_id IS NULL OR w.reviewer_id = ?)
                    ORDER BY s.submitted_at
                    """, (rs, n) -> new QueueItem("TASK", rs.getString("id"), rs.getString("id"), ref, rs.getString("key"),
                            rs.getString("title"), rs.getBigDecimal("weight"), null, rs.getString("note"), rs.getString("email"),
                            rs.getTimestamp("submitted_at").toInstant(), (Integer) rs.getObject("submitted_revision")),
                    caller.orgId(), projectId, caller.userId().toString(), caller.userId(), caller.userId().toString()));
            queue.addAll(jdbc.query("""
                    SELECT c.id, c.percent, c.accomplished, COALESCE(c.captured_at, c.created_at) AS submitted_at, u.email,
                           c.revision_seq
                    FROM project_progress_checkins c LEFT JOIN users u ON CAST(u.id AS text) = c.author_id
                    WHERE c.org_id = ? AND c.project_id = ? AND c.status = 'PENDING' AND c.author_id <> ?
                    ORDER BY c.created_at
                    """, (rs, n) -> new QueueItem("SOLO", rs.getString("id"), "checkin-" + rs.getString("id"), ref,
                            ref.key(), ref.name(), null, rs.getBigDecimal("percent"), rs.getString("accomplished"),
                            rs.getString("email"), rs.getTimestamp("submitted_at").toInstant(), rs.getInt("revision_seq")),
                    caller.orgId(), projectId, caller.userId().toString()));
        }
        queue.sort((a, b) -> a.submittedAt().compareTo(b.submittedAt()));
        return queue;
    }

    /* ================================================================== activity */

    /** Append-only history of one task: every audited change with who, when and why. */
    @Transactional(readOnly = true)
    public List<ActivityEntry> activity(Authentication authentication, String workItemId) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        WorkItemService.Item item = workItems.visible(caller, workItemId);
        return jdbc.query("""
                SELECT a.action, a.occurred_at, a.reason, a.previous ->> 'state' AS from_state, a.new ->> 'state' AS to_state,
                       u.email AS actor_email
                FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
                WHERE a.org_id = ? AND a.target_type = 'WORK_ITEM' AND a.target_id = ?
                ORDER BY a.occurred_at, a.id
                """, (rs, n) -> new ActivityEntry(rs.getString("action"), rs.getString("actor_email"),
                        rs.getTimestamp("occurred_at").toInstant(), rs.getString("reason"), rs.getString("from_state"),
                        rs.getString("to_state")), caller.orgId(), WorkItemService.uuidOf(item.id()));
    }

    /* ================================================================== approvers */

    @Transactional(readOnly = true)
    public ApproversView approvers(Authentication authentication, String projectId) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectService.ProjectResponse project = projects.get(orgId, projectId, authentication);
        boolean canEdit = permissions.canOnProject(authentication, orgId, project.id(), PermissionKey.PROJECT_EDIT.value());
        return new ApproversView(approvers.list(orgId, project.id()), approvers.isApprover(authentication, orgId, project.id()),
                canEdit, project.version());
    }

    @Transactional
    public ApproversView replaceApprovers(Authentication authentication, String projectId, ApproversRequest request) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectService.ProjectResponse project = projects.get(orgId, projectId, authentication);
        if (!permissions.canOnProject(authentication, orgId, project.id(), PermissionKey.PROJECT_EDIT.value())) {
            throw PermissionService.forbidden();
        }
        if (request == null || request.expectedVersion() == null) {
            throw WorkItemService.validation("expected_version", "is required");
        }
        Long current = jdbc.queryForObject("SELECT version FROM projects WHERE id = ? AND org_id = ? FOR UPDATE", Long.class,
                project.id(), orgId);
        ExpectedVersion.check(current == null ? -1 : current, request.expectedVersion());
        approvers.replace(orgId, permissions.principal(authentication).userId(), project.id(),
                request.approverMembershipIds());
        // Approvers must be able to open the project: they join its members.
        for (UUID membershipId : request.approverMembershipIds() == null ? List.<UUID>of() : request.approverMembershipIds()) {
            if (membershipId == null) continue;
            jdbc.update("""
                    INSERT INTO project_members (project_id, org_id, membership_id, added_by) VALUES (?, ?, ?, ?)
                    ON CONFLICT DO NOTHING
                    """, project.id(), orgId, membershipId, permissions.principal(authentication).userId());
        }
        jdbc.update("UPDATE projects SET version = version + 1, updated_at = now() WHERE id = ? AND org_id = ?", project.id(), orgId);
        return approvers(authentication, project.id());
    }

    /* ================================================================== progress overview */

    /**
     * One row per readable project: the progress figure with its method (Team: approved points of the active scope;
     * Solo: the approved check-in), the Solo figure awaiting review (shown separately, never blended), and counts.
     */
    @Transactional(readOnly = true)
    public List<ProgressRow> progressOverview(UUID orgId, Authentication authentication) {
        List<ProgressRow> rows = new ArrayList<>();
        String cursor = null;
        do {
            CursorPage<ProjectService.ProjectResponse> page = projects.list(orgId, authentication,
                    new ProjectService.ListQuery(cursor, 100, null, null, null, null, null, null, null, false));
            for (ProjectService.ProjectResponse project : page.items()) rows.add(progressRow(orgId, project));
            cursor = page.hasMore() && rows.size() < 500 ? page.nextCursor() : null;
        } while (cursor != null);
        return rows;
    }

    /**
     * One page of progress rows for every project the caller can read. Fixed number of queries per page (projects,
     * task counts, open blockers, scope leaves, pending Solo submissions), never one per project.
     */
    @Transactional(readOnly = true)
    public CursorPage<ProgressRow> progressPage(UUID orgId, Authentication authentication, String q, String mode,
            String status, String sort, String cursor, Integer limit) {
        int offset = decodeOffset(cursor);
        int size = limit == null ? 12 : Math.max(1, Math.min(100, limit));
        ProjectService.ProgressPage page = projects.listForProgress(orgId, authentication,
                new ProjectService.ProgressPageQuery(q, mode, status, sort, offset, size));
        List<ProjectService.ProgressProject> items = page.items();
        if (items.isEmpty()) return new CursorPage<>(List.of(), null, false);
        String in = String.join(",", java.util.Collections.nCopies(items.size(), "?"));
        List<Object> args = new ArrayList<>();
        args.add(orgId);
        items.forEach(p -> args.add(p.id()));

        Map<String, int[]> counts = new java.util.HashMap<>();
        jdbc.query("""
                SELECT project_id,
                       count(*) FILTER (WHERE state = 'TODO') AS todo, count(*) FILTER (WHERE state = 'IN_PROGRESS') AS in_progress,
                       count(*) FILTER (WHERE state = 'IN_REVIEW') AS in_review, count(*) FILTER (WHERE state = 'DONE') AS done
                FROM work_items WHERE org_id = ? AND project_id IN (""" + in + ") AND type <> 'MILESTONE' AND plan_status = 'ACTIVE'"
                + " GROUP BY project_id", rs -> {
            counts.put(rs.getString("project_id"), new int[] {rs.getInt("todo"), rs.getInt("in_progress"),
                    rs.getInt("in_review"), rs.getInt("done")});
        }, args.toArray());
        Map<String, Integer> blockers = new java.util.HashMap<>();
        jdbc.query("""
                SELECT w.project_id, count(*) AS open FROM task_blockers b JOIN work_items w ON w.id = b.task_id
                WHERE b.org_id = ? AND w.project_id IN (""" + in + ") AND NOT b.resolved GROUP BY w.project_id",
                rs -> { blockers.put(rs.getString("project_id"), rs.getInt("open")); }, args.toArray());
        // Leaves of every active baseline on the page, with the same "accepted" rule as AcceptedWork (Done, not
        // cancelled, every prerequisite Done).
        Map<String, List<StructuredProgress.Leaf>> leaves = new java.util.HashMap<>();
        jdbc.query("""
                SELECT p.id AS project_id, l.work_item_id, l.weight, l.cancelled, w.state,
                       EXISTS (
                           WITH RECURSIVE up(id, n) AS (
                               SELECT predecessor_id, 1 FROM work_item_dependencies WHERE successor_id = w.id
                               UNION
                               SELECT d.predecessor_id, up.n + 1 FROM work_item_dependencies d JOIN up ON d.successor_id = up.id
                               WHERE up.n < 500)
                           SELECT 1 FROM up JOIN work_items pr ON pr.id = up.id WHERE pr.state <> 'DONE') AS suspended
                FROM projects p JOIN scope_leaves l ON l.scope_version_id = p.active_baseline_id
                JOIN work_items w ON w.id = l.work_item_id
                WHERE p.org_id = ? AND p.id IN (""" + in + ")", rs -> {
            boolean done = "DONE".equals(rs.getString("state"));
            boolean cancelled = rs.getBoolean("cancelled");
            leaves.computeIfAbsent(rs.getString("project_id"), k -> new ArrayList<>()).add(new StructuredProgress.Leaf(
                    rs.getString("work_item_id"), rs.getBigDecimal("weight"), done && !cancelled && !rs.getBoolean("suspended"),
                    cancelled));
        }, args.toArray());
        Map<String, BigDecimal> pending = new java.util.HashMap<>();
        jdbc.query("""
                SELECT DISTINCT ON (project_id) project_id, percent FROM project_progress_checkins
                WHERE org_id = ? AND project_id IN (""" + in + ") AND status = 'PENDING' ORDER BY project_id, revision_seq DESC",
                rs -> { pending.put(rs.getString("project_id"), rs.getBigDecimal("percent")); }, args.toArray());

        List<ProgressRow> rows = new ArrayList<>();
        for (ProjectService.ProgressProject p : items) {
            int[] c = counts.getOrDefault(p.id(), new int[4]);
            int open = blockers.getOrDefault(p.id(), 0);
            if ("STRUCTURED".equals(p.mode())) {
                StructuredProgress.Result r = StructuredProgress.calculate(leaves.getOrDefault(p.id(), List.of()));
                boolean reported = r.measurable() && r.numerator().signum() > 0;
                rows.add(new ProgressRow(p.id(), p.key(), p.name(), p.mode(), p.lifecycle(), reported ? r.displayPercent() : null,
                        !r.measurable() ? StructuredProgress.NOT_MEASURABLE : reported ? r.label() : ProjectService.NOT_REPORTED_LABEL,
                        r.measurable() ? StructuredSnapshotService.methodLabel(r, "POINTS") : null, r.numerator(), r.denominator(),
                        null, c[0], c[1], c[2], c[3], open, p.targetOn(), p.updatedAt()));
            } else {
                BigDecimal approved = p.approvedPercent();
                rows.add(new ProgressRow(p.id(), p.key(), p.name(), p.mode(), p.lifecycle(),
                        approved == null ? null : approved.setScale(0, java.math.RoundingMode.HALF_UP).intValue(),
                        approved == null ? ProjectService.NOT_REPORTED_LABEL : approved.stripTrailingZeros().toPlainString() + "%",
                        approved == null ? null : "approved outcome", null, null, pending.get(p.id()),
                        c[0], c[1], c[2], c[3], open, p.targetOn(), p.updatedAt()));
            }
        }
        return new CursorPage<>(rows, page.hasMore() ? encodeOffset(offset + items.size()) : null, page.hasMore());
    }

    private static String encodeOffset(int offset) {
        return java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(("o:" + offset).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private static int decodeOffset(String cursor) {
        if (cursor == null || cursor.isBlank()) return 0;
        try {
            String raw = new String(java.util.Base64.getUrlDecoder().decode(cursor), java.nio.charset.StandardCharsets.UTF_8);
            if (!raw.startsWith("o:")) throw new IllegalArgumentException();
            return Math.max(0, Integer.parseInt(raw.substring(2)));
        } catch (IllegalArgumentException e) {
            throw WorkItemService.validation("cursor", "is invalid");
        }
    }

    private ProgressRow progressRow(UUID orgId, ProjectService.ProjectResponse project) {
        Map<String, Object> counts = jdbc.queryForMap("""
                SELECT count(*) FILTER (WHERE state = 'TODO') AS todo,
                       count(*) FILTER (WHERE state = 'IN_PROGRESS') AS in_progress,
                       count(*) FILTER (WHERE state = 'IN_REVIEW') AS in_review,
                       count(*) FILTER (WHERE state = 'DONE') AS done
                FROM work_items WHERE org_id = ? AND project_id = ? AND type <> 'MILESTONE' AND plan_status = 'ACTIVE'
                """, orgId, project.id());
        Integer blockers = jdbc.queryForObject("""
                SELECT count(*) FROM task_blockers b JOIN work_items w ON w.id = b.task_id
                WHERE b.org_id = ? AND w.project_id = ? AND NOT b.resolved
                """, Integer.class, orgId, project.id());
        if ("STRUCTURED".equals(project.mode())) {
            StructuredProgress.Result result = acceptedWork.progress(project.activeBaselineId());
            boolean reported = result.measurable() && result.numerator().signum() > 0;
            return new ProgressRow(project.id(), project.key(), project.name(), project.mode(), project.lifecycle(),
                    reported ? result.displayPercent() : null,
                    !result.measurable() ? StructuredProgress.NOT_MEASURABLE : reported ? result.label() : ProjectService.NOT_REPORTED_LABEL,
                    result.measurable() ? StructuredSnapshotService.methodLabel(result, "POINTS") : null,
                    result.numerator(), result.denominator(), null, number(counts, "todo"), number(counts, "in_progress"),
                    number(counts, "in_review"), number(counts, "done"), blockers == null ? 0 : blockers, project.targetOn(),
                    project.updatedAt());
        }
        BigDecimal pending = jdbc.query("""
                SELECT percent FROM project_progress_checkins WHERE org_id = ? AND project_id = ? AND status = 'PENDING'
                ORDER BY revision_seq DESC LIMIT 1
                """, (rs, n) -> rs.getBigDecimal(1), orgId, project.id()).stream().findFirst().orElse(null);
        BigDecimal approved = project.progress().percent();
        return new ProgressRow(project.id(), project.key(), project.name(), project.mode(), project.lifecycle(),
                approved == null ? null : approved.intValue(),
                approved == null ? ProjectService.NOT_REPORTED_LABEL : approved.stripTrailingZeros().toPlainString() + "%",
                approved == null ? null : "approved outcome", null, null, pending,
                number(counts, "todo"), number(counts, "in_progress"), number(counts, "in_review"), number(counts, "done"),
                blockers == null ? 0 : blockers, project.targetOn(), project.updatedAt());
    }

    private static int number(Map<String, Object> row, String key) {
        Object value = row.get(key);
        return value == null ? 0 : ((Number) value).intValue();
    }

    /* ================================================================== records */

    public record ProjectRef(String id, String key, String name, String mode) {}

    /** {@code reviewRef}: the id the review page opens (work item id, or "checkin-<id>" for Solo submissions). */
    public record QueueItem(String kind, String id, String reviewRef, ProjectRef project, String key, String title,
            BigDecimal points, BigDecimal reportedPercent, String note, String submittedBy, Instant submittedAt,
            Integer revision) {}

    public record ActivityEntry(String action, String actorEmail, Instant occurredAt, String reason, String fromState,
            String toState) {}

    public record ApproversRequest(List<UUID> approverMembershipIds, Long expectedVersion) {}

    public record ApproversView(List<ProjectApprovers.Approver> approvers, boolean callerIsApprover, boolean canEdit,
            long projectVersion) {}

    /** {@code pendingPercent}: Solo figure "reported, not yet approved" (never part of {@code percent}). */
    public record ProgressRow(String projectId, String key, String name, String mode, String lifecycle, Integer percent,
            String label, String methodLabel, BigDecimal approvedPoints, BigDecimal totalPoints, BigDecimal pendingPercent,
            int todo, int inProgress, int inReview, int done, int openBlockers, java.time.LocalDate targetOn,
            Instant updatedAt) {}
}
