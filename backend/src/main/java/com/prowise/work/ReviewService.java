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
import org.springframework.transaction.annotation.Transactional;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.domain.AcceptedWork;
import com.prowise.domain.TaskReview;
import com.prowise.domain.TaskReview.Problem;
import com.prowise.domain.TaskReview.State;
import com.prowise.project.ProjectService;
import com.prowise.project.ProjectService.ProjectResponse;
import com.prowise.work.WorkDTOs.WorkItem;

/**
 * Task 3.3: review and rework. The assignee submits the current revision; only the task's reviewer (task.review)
 * approves it, with every required check passed, or requests changes (new revision, back to In Progress). A Project
 * Manager (project.edit) reopens a Done task: its credit is removed, history kept. Approval and reopening snapshot
 * progress (task 3.5). Every change: audit + outbox in the same transaction.
 */
@Service
public class ReviewService {

    private final JdbcTemplate jdbc;
    private final ProjectService projects;
    private final PermissionService permissions;
    private final ChangeRecorder changes;
    private final WorkService work;
    private final StructuredProgressService progress;
    private final DependencyService dependencies;

    public ReviewService(JdbcTemplate jdbc, ProjectService projects, PermissionService permissions, ChangeRecorder changes,
            WorkService work, StructuredProgressService progress, DependencyService dependencies) {
        this.dependencies = dependencies;
        this.jdbc = jdbc;
        this.projects = projects;
        this.permissions = permissions;
        this.changes = changes;
        this.work = work;
        this.progress = progress;
    }

    public record Check(UUID id, String label) {}

    public record Task(String projectId, String projectKey, String projectName, WorkItem item, int currentRevision,
            Integer submittedRevision, Integer acceptedRevision, boolean cancelled, List<Check> checks,
            List<DependencyService.ItemRef> waitingOn, boolean blocked, String dependencyFlag) {}

    public record ReviewEvent(String kind, int revision, String note, String actorEmail, Instant occurredAt) {}

    public record SubmitRequest(String note, Long expectedVersion) {}

    public record DecisionRequest(Integer reviewedRevision, List<UUID> passedCheckIds, String note, Long expectedVersion) {}

    public record ReasonRequest(String reason, Long expectedVersion) {}

    public record ChecksRequest(List<String> labels, Long expectedVersion) {}

    /* ================================================================== submit */

    @Transactional
    public Task submit(UUID orgId, String projectId, String itemId, Authentication auth, SubmitRequest request) {
        Context c = context(orgId, projectId, itemId, auth, request.expectedVersion());
        if (c.row.assignee() == null || !c.row.assignee().equals(c.membershipId)
                || !permissions.canOnProject(auth, orgId, c.project.id(), PermissionKey.TASK_UPDATE.value())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_TASK_ASSIGNEE", "Only the task's assigned developer submits it.");
        }
        if (c.cancelled) throw conflict("TASK_CANCELLED", "Cancelled tasks are not submitted.");
        problem(TaskReview.canSubmit(c.state));
        // Task 3.4: Finish-to-Start - a task cannot go forward while a predecessor is not accepted.
        List<DependencyService.ItemRef> waiting = dependencies.unfinishedPredecessors(orgId, itemId);
        if (!waiting.isEmpty()) {
            throw conflict("PREDECESSOR_OPEN", "Waiting on " + String.join(", ", waiting.stream().map(DependencyService.ItemRef::key).toList())
                    + ". Those tasks must be approved first.");
        }
        String note = optional(request.note(), 2000);
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE work_items SET state = 'IN_REVIEW', submitted_revision = current_revision, version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, itemId, orgId, request.expectedVersion()));
        event(orgId, itemId, "SUBMITTED", c.currentRevision, note, c.userId);
        return record(c, "task.submitted_for_review", "ReviewRequested", note);
    }

    /* ================================================================== decisions */

    @Transactional
    public Task approve(UUID orgId, String projectId, String itemId, Authentication auth, DecisionRequest request) {
        Context c = context(orgId, projectId, itemId, auth, request.expectedVersion());
        requireReviewer(c, auth);
        if (request.reviewedRevision() == null) throw WorkService.validation("reviewed_revision", "is required");
        List<String> required = checks(orgId, itemId).stream().map(check -> check.id().toString()).toList();
        List<String> passed = request.passedCheckIds() == null ? List.of() : request.passedCheckIds().stream().map(UUID::toString).toList();
        problem(TaskReview.canApprove(c.state, request.reviewedRevision(), c.submittedRevision, c.currentRevision, required, passed));
        String note = optional(request.note(), 2000);
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE work_items SET state = 'DONE', accepted_revision = submitted_revision, accepted_at = now(), version = version + 1,
                    updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, itemId, orgId, request.expectedVersion()));
        jdbc.update("""
                INSERT INTO task_reviews (id, org_id, work_item_id, kind, revision, note, passed_check_ids, actor_id)
                VALUES (?, ?, ?, 'APPROVED', ?, ?, ?, ?)
                """, UUID.randomUUID(), orgId, itemId, c.currentRevision, note, String.join(",", passed), c.userId);
        progress.snapshot(orgId, c.project.id(), "TASK_APPROVED", itemId);
        return record(c, "task.review_approved", "WorkItemCompleted", note);
    }

    @Transactional
    public Task requestChanges(UUID orgId, String projectId, String itemId, Authentication auth, DecisionRequest request) {
        Context c = context(orgId, projectId, itemId, auth, request.expectedVersion());
        requireReviewer(c, auth);
        if (request.reviewedRevision() == null) throw WorkService.validation("reviewed_revision", "is required");
        String note = optional(request.note(), 2000);
        if (note == null) throw WorkService.validation("note", "Say what needs to change.");
        problem(TaskReview.canRequestChanges(c.state, request.reviewedRevision(), c.submittedRevision, c.currentRevision));
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE work_items SET state = 'IN_PROGRESS', current_revision = current_revision + 1, submitted_revision = NULL,
                    version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, itemId, orgId, request.expectedVersion()));
        event(orgId, itemId, "CHANGES_REQUESTED", c.currentRevision, note, c.userId);
        return record(c, "task.changes_requested", "ReviewChangesRequested", note);
    }

    @Transactional
    public Task reopen(UUID orgId, String projectId, String itemId, Authentication auth, ReasonRequest request) {
        Context c = context(orgId, projectId, itemId, auth, request.expectedVersion());
        if (!permissions.canOnProject(auth, orgId, c.project.id(), PermissionKey.PROJECT_EDIT.value())) throw PermissionService.forbidden();
        String reason = optional(request.reason(), 2000);
        if (reason == null) throw WorkService.validation("reason", "Explain why the task is reopened.");
        problem(TaskReview.canReopen(c.state));
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE work_items SET state = 'IN_PROGRESS', current_revision = current_revision + 1, submitted_revision = NULL,
                    accepted_revision = NULL, accepted_at = NULL, version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, itemId, orgId, request.expectedVersion()));
        event(orgId, itemId, "REOPENED", c.currentRevision, reason, c.userId);
        progress.snapshot(orgId, c.project.id(), "TASK_REOPENED", itemId);
        // Task 3.4: successors are flagged for review, never reversed automatically; no date moves.
        List<DependencyService.ItemRef> flagged = dependencies.flagSuccessors(orgId, c.project.id(), itemId, c.row.key());
        return record(c, "task.reopened", "WorkItemReopened", reason,
                Map.of("flagged_successors", flagged.stream().map(DependencyService.ItemRef::id).toList()));
    }

    /* ================================================================== checks and reads */

    @Transactional
    public Task setChecks(UUID orgId, String projectId, String itemId, Authentication auth, ChecksRequest request) {
        Context c = context(orgId, projectId, itemId, auth, request.expectedVersion());
        if (!permissions.canOnProject(auth, orgId, c.project.id(), PermissionKey.PROJECT_EDIT.value())) throw PermissionService.forbidden();
        if (c.state == State.DONE) throw conflict("TASK_DONE", "Reopen the task before changing its checks.");
        List<String> labels = new ArrayList<>();
        for (String label : request.labels() == null ? List.<String>of() : request.labels()) {
            String trimmed = label == null ? "" : label.trim();
            if (trimmed.isEmpty() || trimmed.length() > 200) throw WorkService.validation("labels", "Each check needs a text of up to 200 characters.");
            labels.add(trimmed);
        }
        ExpectedVersion.requireUpdated(jdbc.update("UPDATE work_items SET version = version + 1, updated_at = now() WHERE id = ? AND org_id = ? AND version = ?",
                itemId, orgId, request.expectedVersion()));
        jdbc.update("UPDATE work_item_checks SET retired_at = now() WHERE work_item_id = ? AND org_id = ? AND retired_at IS NULL", itemId, orgId);
        for (int i = 0; i < labels.size(); i++) {
            jdbc.update("INSERT INTO work_item_checks (id, org_id, work_item_id, label, position, created_by) VALUES (?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID(), orgId, itemId, labels.get(i), i, c.userId);
        }
        return record(c, "task.checks_changed", "WorkItemChecksChanged", String.join("; ", labels));
    }

    @Transactional(readOnly = true)
    public List<ReviewEvent> history(UUID orgId, String projectId, String itemId, Authentication auth) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        if (!work.rows(orgId, project.id()).containsKey(itemId)) throw PermissionService.notFound();
        return jdbc.query("""
                SELECT r.kind, r.revision, r.note, u.email, r.occurred_at FROM task_reviews r JOIN users u ON u.id = r.actor_id
                WHERE r.org_id = ? AND r.work_item_id = ? ORDER BY r.occurred_at, r.id
                """, (rs, n) -> new ReviewEvent(rs.getString("kind"), rs.getInt("revision"), rs.getString("note"), rs.getString("email"),
                rs.getTimestamp("occurred_at").toInstant()), orgId, itemId);
    }

    /** One task's review state and checks (read with the project). */
    @Transactional(readOnly = true)
    public Task view(UUID orgId, String projectId, String itemId, Authentication auth) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        if (!work.rows(orgId, project.id()).containsKey(itemId)) throw PermissionService.notFound();
        return task(orgId, project, itemId);
    }

    /** Tasks assigned to the caller (developer "My tasks"). */
    @Transactional(readOnly = true)
    public List<Task> myTasks(UUID orgId, Authentication auth) {
        UUID membershipId = permissions.requireMembership(auth, orgId);
        return tasksWhere(orgId, auth, "w.assignee_membership_id = ?", membershipId);
    }

    /** Tasks waiting for the caller's review. */
    @Transactional(readOnly = true)
    public List<Task> reviewQueue(UUID orgId, Authentication auth) {
        UUID membershipId = permissions.requireMembership(auth, orgId);
        return tasksWhere(orgId, auth, "w.reviewer_membership_id = ? AND w.state = 'IN_REVIEW'", membershipId);
    }

    /* ================================================================== helpers */

    private record Context(UUID orgId, ProjectResponse project, WorkService.ItemRow row, State state, int currentRevision, Integer submittedRevision,
            boolean cancelled, UUID userId, UUID membershipId, WorkItem before) {}

    private Context context(UUID orgId, String projectId, String itemId, Authentication auth, Long expectedVersion) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        if (!"STRUCTURED".equals(project.mode())) throw conflict("PROJECT_NOT_STRUCTURED", "Only Structured projects have tasks.");
        if (project.archived()) throw conflict("PROJECT_ARCHIVED", "Archived projects are read-only.");
        if (expectedVersion == null) throw WorkService.validation("expected_version", "is required");
        UUID userId = permissions.principal(auth).userId();
        UUID membershipId = permissions.requireMembership(auth, orgId);
        work.lockProject(orgId, project.id());
        Map<String, WorkService.ItemRow> rows = work.rows(orgId, project.id());
        WorkService.ItemRow row = rows.get(itemId);
        if (row == null) throw PermissionService.notFound();
        boolean leaf = com.prowise.domain.WorkBreakdown.measurable(row.level()) && rows.values().stream().noneMatch(r -> itemId.equals(r.parentId()));
        if (!leaf) throw conflict("NOT_A_LEAF", "Only tasks and subtasks without children are reviewed.");
        Map<String, Object> state = jdbc.queryForMap(
                "SELECT state, current_revision, submitted_revision, cancelled_at, version FROM work_items WHERE id = ? AND org_id = ? FOR UPDATE",
                itemId, orgId);
        ExpectedVersion.check(((Number) state.get("version")).longValue(), expectedVersion);
        WorkItem before = work.list(orgId, project.id(), auth).stream().filter(i -> i.id().equals(itemId)).findFirst().orElseThrow();
        return new Context(orgId, project, row, State.valueOf((String) state.get("state")), ((Number) state.get("current_revision")).intValue(),
                state.get("submitted_revision") == null ? null : ((Number) state.get("submitted_revision")).intValue(),
                state.get("cancelled_at") != null, userId, membershipId, before);
    }

    private void requireReviewer(Context c, Authentication auth) {
        if (c.row.reviewer() == null || !c.row.reviewer().equals(c.membershipId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_TASK_REVIEWER", "Only the task's reviewer decides its review.");
        }
        if (!permissions.canOnProject(auth, c.orgId, c.project.id(), PermissionKey.TASK_REVIEW.value())) {
            throw PermissionService.forbidden();
        }
    }

    private static void problem(Optional<Problem> problem) {
        if (problem.isEmpty()) return;
        throw switch (problem.get()) {
            case STALE_REVIEW -> conflict("STALE_REVIEW", "This revision is no longer the one in review. Reload the task.");
            case MISSING_CHECK -> conflict("MISSING_CHECK", "Every required check must pass before approval.");
            case NOT_IN_REVIEW -> conflict("NOT_IN_REVIEW", "The task is not waiting for review.");
            case NOT_SUBMITTABLE -> conflict("NOT_SUBMITTABLE", "Only tasks in To Do or In Progress can be submitted.");
            case NOT_DONE -> conflict("NOT_DONE", "Only Done tasks can be reopened.");
        };
    }

    private void event(UUID orgId, String itemId, String kind, int revision, String note, UUID actorId) {
        jdbc.update("INSERT INTO task_reviews (id, org_id, work_item_id, kind, revision, note, actor_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
                UUID.randomUUID(), orgId, itemId, kind, revision, note, actorId);
    }

    private Task record(Context c, String action, String eventType, String reason) {
        return record(c, action, eventType, reason, Map.of());
    }

    private Task record(Context c, String action, String eventType, String reason, Map<String, Object> extra) {
        UUID orgId = c.orgId;
        Task after = task(orgId, c.project, c.row.id());
        Map<String, Object> previous = state(c.before.state(), c.currentRevision);
        Map<String, Object> next = state(after.item().state(), after.currentRevision());
        next.put("project_id", c.project.id());
        next.put("work_item_id", c.row.id());
        AcceptedWork.Measure measure = progress.measure(orgId, c.project.id());
        next.put("progress_display", measure.display());
        next.putAll(extra);
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, c.userId, action, "WORK_ITEM", UUID.fromString(c.row.id()), reason, previous, next),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(c.project.id()), c.project.version(), eventType, next));
        return after;
    }

    private static Map<String, Object> state(String state, int revision) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("state", state);
        s.put("revision", revision);
        return s;
    }

    private List<Check> checks(UUID orgId, String itemId) {
        return jdbc.query("SELECT id, label FROM work_item_checks WHERE org_id = ? AND work_item_id = ? AND retired_at IS NULL ORDER BY position",
                (rs, n) -> new Check(rs.getObject("id", UUID.class), rs.getString("label")), orgId, itemId);
    }

    private Task task(UUID orgId, ProjectResponse project, String itemId) {
        WorkItem item = itemsOf(orgId, project.id()).get(itemId);
        Map<String, Object> s = jdbc.queryForMap(
                "SELECT current_revision, submitted_revision, accepted_revision, cancelled_at, is_blocked, dependency_flag_reason FROM work_items WHERE id = ? AND org_id = ?",
                itemId, orgId);
        return new Task(project.id(), project.key(), project.name(), item, ((Number) s.get("current_revision")).intValue(),
                (Integer) s.get("submitted_revision"), (Integer) s.get("accepted_revision"), s.get("cancelled_at") != null, checks(orgId, itemId),
                dependencies.unfinishedPredecessors(orgId, itemId), Boolean.TRUE.equals(s.get("is_blocked")), (String) s.get("dependency_flag_reason"));
    }

    private Map<String, WorkItem> itemsOf(UUID orgId, String projectId) {
        Map<String, WorkItem> byId = new HashMap<>();
        work.items(orgId, projectId).forEach(i -> byId.put(i.id(), i));
        return byId;
    }

    private List<Task> tasksWhere(UUID orgId, Authentication auth, String condition, UUID membershipId) {
        List<Task> tasks = new ArrayList<>();
        // Only projects the caller may read (unreadable ones are absent, not probed one by one).
        for (ProjectResponse project : projects.readable(orgId, auth, "STRUCTURED")) {
            String projectId = project.id();
            List<String> ids = jdbc.queryForList("SELECT w.id FROM work_items w WHERE w.org_id = ? AND w.project_id = ? AND w.created_by IS NOT NULL"
                    + " AND w.retired_at IS NULL AND w.proposed_scope_version_id IS NULL AND " + condition + " ORDER BY w.key",
                    String.class, orgId, projectId, membershipId);
            for (String id : ids) {
                Task task = task(orgId, project, id);
                if (task.item() != null && task.item().leaf()) tasks.add(task);
            }
        }
        return tasks;
    }

    private static String optional(String value, int max) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.length() > max) throw WorkService.validation("note", "must be at most " + max + " characters");
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }
}
