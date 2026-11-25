package com.prowise.work;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.project.FileService;

/**
 * Task 3.3: workflow, review and rework (FR-022, D04, docs/domain-rules.md "Task workflow" and "Review rules").
 *
 * <p>{@code To Do -> In Progress -> In Review -> Done}. Only the primary assignee starts and submits their work.
 * A submission is bound to the current revision and criteria version. The assigned reviewer (with {@code task.review},
 * never the submitter) approves or requests changes (reason mandatory). A decision on a stale revision, by someone who
 * is no longer the reviewer, after the criteria changed, or a second decision racing the first, returns 409
 * STALE_REVIEW and changes nothing. Approval also needs every required check satisfied (422 MISSING_CHECK).
 * Without required review, submitting completes the work when the checks pass. Reopening (planner or reviewer, with a
 * reason) removes the credit, opens a new revision and keeps all history.
 *
 * <p>Every transition locks the work item row and writes its audit row and outbox event in the same transaction.
 */
@Service
public class WorkflowService {

    private static final Pattern CHECK_KEY = Pattern.compile("^[a-z0-9][a-z0-9-]{0,59}$");

    private final JdbcTemplate jdbc;
    private final WorkItemService workItems;
    private final ChangeRecorder changes;
    private final ObjectMapper objectMapper;
    private final List<WorkItemStateListener> listeners;
    private final ProjectApprovers approvers;
    private final ReviewNotifications notifications;
    private final FileService files;

    public WorkflowService(JdbcTemplate jdbc, WorkItemService workItems, ChangeRecorder changes, ObjectMapper objectMapper,
            List<WorkItemStateListener> listeners, ProjectApprovers approvers, ReviewNotifications notifications,
            FileService files) {
        this.jdbc = jdbc;
        this.workItems = workItems;
        this.changes = changes;
        this.objectMapper = objectMapper;
        this.listeners = listeners;
        this.approvers = approvers;
        this.notifications = notifications;
        this.files = files;
    }

    /* ================================================================== start */

    @Transactional
    public WorkItemService.WorkItemResponse start(Authentication authentication, String workItemId, VersionRequest request) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        WorkItemService.Item item = lockedWorkable(caller, workItemId);
        requireAssignee(caller, item);
        if (!"TODO".equals(item.state())) throw invalidTransition("Only work that has not started can be started.");
        ExpectedVersion.check(item.version(), expected(request.expectedVersion()));
        for (WorkItemStateListener listener : listeners) listener.beforeStart(caller.orgId(), item.id());

        jdbc.update("UPDATE work_items SET state = 'IN_PROGRESS', version = version + 1, updated_at = now() WHERE id = ?",
                item.id());
        record(caller, item, "work_item.started", null, "TODO", "IN_PROGRESS", "WorkItemStarted", Map.of());
        return workItems.response(caller.orgId(), item.id());
    }

    /* ================================================================== submit */

    @Transactional
    public WorkItemService.WorkItemResponse submit(Authentication authentication, String workItemId, SubmissionRequest request) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        WorkItemService.Item item = lockedWorkable(caller, workItemId);
        requireAssignee(caller, item);
        if (!"IN_PROGRESS".equals(item.state()) && !"IN_REVIEW".equals(item.state())) {
            throw invalidTransition("Start the work before submitting it.");
        }
        ExpectedVersion.check(item.version(), expected(request.expectedVersion()));
        Policy policy = policy(item.id());
        if (policy.criteria() == null || policy.criteria().isBlank()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "CRITERIA_MISSING",
                    "This work has no acceptance criteria yet. Ask your project manager to add them.");
        }
        String evidence = evidence(request.evidence());
        for (EvidenceItem file : request.evidence() == null ? List.<EvidenceItem>of() : request.evidence()) {
            if ("FILE".equalsIgnoreCase(String.valueOf(file.type()).trim())) {
                files.requireEvidenceFile(caller.orgId(), file.ref().trim(), item.projectId(), item.id());
            }
        }
        String note = text(request.note(), 2000);

        int revision = policy.currentRevision();
        if ("IN_REVIEW".equals(item.state())) {
            // A newer revision replaces the one waiting for review; a review of the old one becomes stale.
            jdbc.update("""
                    UPDATE work_item_submissions SET status = 'SUPERSEDED'
                    WHERE work_item_id = ? AND revision = ? AND status = 'SUBMITTED'
                    """, item.id(), revision);
            revision = revision + 1;
        }

        if (policy.reviewRequired()) {
            jdbc.update("""
                    INSERT INTO work_item_submissions (id, org_id, work_item_id, revision, criteria_version, evidence, note,
                        submitted_by, status)
                    VALUES (?, ?, ?, ?, ?, ?::jsonb, ?, ?, 'SUBMITTED')
                    """, UUID.randomUUID(), caller.orgId(), item.id(), revision, policy.criteriaVersion(), evidence, note,
                    caller.userId());
            jdbc.update("""
                    UPDATE work_items SET state = 'IN_REVIEW', current_revision = ?, submitted_revision = ?,
                        version = version + 1, updated_at = now()
                    WHERE id = ?
                    """, revision, revision, item.id());
            record(caller, item, "work_item.submitted", null, item.state(), "IN_REVIEW", "ReviewRequested",
                    Map.of("revision", revision, "reviewer_id", String.valueOf(item.reviewerId())));
            List<UUID> recipients = item.reviewerId() != null
                    ? List.of(UUID.fromString(item.reviewerId()))
                    : approvers.approverUserIds(caller.orgId(), item.projectId());
            notifications.reviewRequested(caller.orgId(), recipients, caller.userId(), item.id(),
                    "Review requested: " + item.key(), "\"" + item.title() + "\" was submitted for review (revision "
                            + revision + ").");
            return workItems.response(caller.orgId(), item.id());
        }

        // No review required: Done only when every required check passes.
        requireChecks(item.id());
        jdbc.update("""
                INSERT INTO work_item_submissions (id, org_id, work_item_id, revision, criteria_version, evidence, note,
                    submitted_by, status)
                VALUES (?, ?, ?, ?, ?, ?::jsonb, ?, ?, 'COMPLETED')
                """, UUID.randomUUID(), caller.orgId(), item.id(), revision, policy.criteriaVersion(), evidence, note,
                caller.userId());
        jdbc.update("""
                UPDATE work_items SET state = 'DONE', current_revision = ?, submitted_revision = ?, accepted_revision = ?,
                    accepted_at = now(), version = version + 1, updated_at = now()
                WHERE id = ?
                """, revision, revision, revision, item.id());
        record(caller, item, "work_item.completed", null, item.state(), "DONE", "WorkItemCompleted",
                Map.of("revision", revision, "review", "not_required"));
        notifyCredit(caller, item.id(), "WORK_ACCEPTED");
        return workItems.response(caller.orgId(), item.id());
    }

    /* ================================================================== review */

    @Transactional
    public WorkItemService.WorkItemResponse review(Authentication authentication, String workItemId, ReviewRequest request) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        WorkItemService.Item visible = workItems.visible(caller, workItemId);
        // Owner rule (2026-11-25): approvers are chosen per project. task.review must come from a PROJECT-scoped
        // grant on exactly this project; an organization-wide task.review does not make anyone an approver here.
        if (!approvers.isApprover(authentication, caller.orgId(), visible.projectId())) throw PermissionService.forbidden();
        if (caller.userId().toString().equals(visible.primaryAssigneeId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "SELF_REVIEW_NOT_ALLOWED", "You cannot approve your own task.");
        }
        String decision = request.decision() == null ? "" : request.decision().trim().toUpperCase(Locale.ROOT);
        if (!decision.equals("APPROVED") && !decision.equals("CHANGES_REQUESTED")) {
            throw WorkItemService.validation("decision", "must be APPROVED or CHANGES_REQUESTED");
        }
        String reason = text(request.reason(), 2000);
        if (decision.equals("CHANGES_REQUESTED") && reason == null) {
            throw WorkItemService.validation("reason", "explain what needs to change");
        }
        if (request.submittedRevision() == null) throw WorkItemService.validation("submitted_revision", "is required");

        WorkItemService.Item item = lock(caller, visible.id());
        Policy policy = policy(item.id());
        // A task with a designated reviewer is decided by that approver only (reassigned meanwhile = stale); otherwise
        // any approver of the project decides. Decided/replaced revision or a racing decision: nothing changes.
        boolean designatedElsewhere = item.reviewerId() != null && !caller.userId().toString().equals(item.reviewerId());
        if (designatedElsewhere || !"IN_REVIEW".equals(item.state())
                || policy.submittedRevision() == null || policy.submittedRevision() != policy.currentRevision()
                || request.submittedRevision() != policy.currentRevision()) {
            throw staleReview();
        }
        Map<String, Object> submission = jdbc.queryForMap("""
                SELECT id, submitted_by, criteria_version FROM work_item_submissions
                WHERE work_item_id = ? AND revision = ? AND status = 'SUBMITTED'
                """, item.id(), policy.currentRevision());
        if (caller.userId().equals(submission.get("submitted_by"))) {
            throw PermissionService.forbidden(); // never review your own submission
        }
        if (((Number) submission.get("criteria_version")).intValue() != policy.criteriaVersion()) {
            throw staleReview(); // the criteria changed after submission
        }
        UUID submissionId = (UUID) submission.get("id");
        int revision = policy.currentRevision();
        // The evidence reviewed: the exact submission (its note, links and files) and the commits linked at this time.
        String reviewed = request.evidenceRef() != null && !request.evidenceRef().isBlank()
                ? request.evidenceRef() : reviewedEvidence(submissionId, item.id());
        UUID submitter = (UUID) submission.get("submitted_by");
        String taskLink = "/org/" + caller.orgId() + "/developer/tasks/" + item.id();

        if (decision.equals("APPROVED")) {
            requireChecks(item.id());
            insertReview(caller, item.id(), submissionId, decision, reason, reviewed, revision);
            jdbc.update("UPDATE work_item_submissions SET status = 'APPROVED' WHERE id = ?", submissionId);
            jdbc.update("""
                    UPDATE work_items SET state = 'DONE', accepted_revision = ?, accepted_at = now(),
                        version = version + 1, updated_at = now()
                    WHERE id = ?
                    """, revision, item.id());
            record(caller, item, "work_item.accepted", null, "IN_REVIEW", "DONE", "WorkItemCompleted",
                    Map.of("revision", revision, "review", "approved"));
            notifyCredit(caller, item.id(), "WORK_ACCEPTED");
            notifications.decided(caller.orgId(), submitter, true, item.key() + " approved",
                    "\"" + item.title() + "\" was approved and its points now count.", taskLink);
        } else {
            insertReview(caller, item.id(), submissionId, decision, reason, reviewed, revision);
            jdbc.update("UPDATE work_item_submissions SET status = 'CHANGES_REQUESTED' WHERE id = ?", submissionId);
            jdbc.update("""
                    UPDATE work_items SET state = 'IN_PROGRESS', current_revision = current_revision + 1,
                        submitted_revision = NULL, version = version + 1, updated_at = now()
                    WHERE id = ?
                    """, item.id());
            record(caller, item, "work_item.changes_requested", reason, "IN_REVIEW", "IN_PROGRESS", "ChangesRequested",
                    Map.of("revision", revision));
            notifications.decided(caller.orgId(), submitter, false, item.key() + ": changes requested",
                    "\"" + item.title() + "\" is back in progress: " + reason, taskLink);
        }
        return workItems.response(caller.orgId(), item.id());
    }

    /** "submission:<id>; commits:<sha,...>" (at most 500 characters), recorded with the decision. */
    private String reviewedEvidence(UUID submissionId, String itemId) {
        List<String> shas = jdbc.queryForList("""
                SELECT left(sha, 12) FROM github_activity
                WHERE work_item_id = ? AND sha IS NOT NULL ORDER BY occurred_at DESC NULLS LAST LIMIT 20
                """, String.class, itemId);
        String value = "submission:" + submissionId + (shas.isEmpty() ? "" : "; commits:" + String.join(",", shas));
        return value.length() <= 500 ? value : value.substring(0, 500);
    }

    private void insertReview(WorkItemService.Caller caller, String itemId, UUID submissionId, String decision, String reason,
            String evidenceRef, int revision) {
        jdbc.update("""
                INSERT INTO work_item_reviews (id, org_id, work_item_id, submission_id, reviewer_id, decision, reason,
                    evidence_ref, work_item_revision)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), caller.orgId(), itemId, submissionId, caller.userId(), decision, reason,
                text(evidenceRef, 500), revision);
    }

    /* ================================================================== reopen */

    @Transactional
    public WorkItemService.WorkItemResponse reopen(Authentication authentication, String workItemId, ReopenRequest request) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        WorkItemService.Item visible = workItems.visible(caller, workItemId);
        boolean planner = workItems.can(caller, visible.projectId(), PermissionKey.TASK_ASSIGN);
        boolean reviewer = approvers.isApprover(authentication, caller.orgId(), visible.projectId())
                && (visible.reviewerId() == null || caller.userId().toString().equals(visible.reviewerId()));
        if (!planner && !reviewer) throw PermissionService.forbidden();
        String reason = text(request.reason(), 2000);
        if (reason == null) throw WorkItemService.validation("reason", "explain why the work is reopened");

        WorkItemService.Item item = lock(caller, visible.id());
        if (!"DONE".equals(item.state())) throw invalidTransition("Only completed work can be reopened.");
        ExpectedVersion.check(item.version(), expected(request.expectedVersion()));
        Integer accepted = jdbc.queryForObject("SELECT accepted_revision FROM work_items WHERE id = ?", Integer.class, item.id());

        jdbc.update("""
                INSERT INTO work_item_reopen_events (id, org_id, work_item_id, actor_id, reason, previous_state, superseded_revision)
                VALUES (?, ?, ?, ?, ?, 'DONE', ?)
                """, UUID.randomUUID(), caller.orgId(), item.id(), caller.userId(), reason, accepted);
        jdbc.update("""
                UPDATE work_items SET state = 'IN_PROGRESS', current_revision = current_revision + 1, submitted_revision = NULL,
                    accepted_revision = NULL, accepted_at = NULL, version = version + 1, updated_at = now()
                WHERE id = ?
                """, item.id());
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("superseded_revision", accepted);
        record(caller, item, "work_item.reopened", reason, "DONE", "IN_PROGRESS", "WorkItemReopened", payload);
        for (WorkItemStateListener listener : listeners) listener.afterReopen(caller.orgId(), item.id(), caller.userId());
        notifyCredit(caller, item.id(), "WORK_REOPENED");
        return workItems.response(caller.orgId(), item.id());
    }

    /* ================================================================== required checks */

    @Transactional
    public WorkItemService.WorkItemResponse defineChecks(Authentication authentication, String workItemId, ChecksRequest request) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        WorkItemService.Item visible = workItems.visible(caller, workItemId);
        if (!workItems.can(caller, visible.projectId(), PermissionKey.TASK_CREATE)
                && !workItems.can(caller, visible.projectId(), PermissionKey.TASK_ASSIGN)) {
            throw PermissionService.forbidden();
        }
        WorkItemService.Item item = lock(caller, visible.id());
        if ("DONE".equals(item.state())) throw invalidTransition("Reopen completed work before changing its checks.");
        ExpectedVersion.check(item.version(), expected(request.expectedVersion()));
        List<CheckDefinition> checks = request.checks() == null ? List.of() : request.checks();
        if (checks.size() > 20) throw WorkItemService.validation("checks", "at most 20 checks");
        List<String> keys = new ArrayList<>();
        for (CheckDefinition check : checks) {
            String key = check.key() == null ? "" : check.key().trim().toLowerCase(Locale.ROOT);
            if (!CHECK_KEY.matcher(key).matches()) throw WorkItemService.validation("key", "use letters, numbers and dashes");
            String label = text(check.label(), 200);
            if (label == null) throw WorkItemService.validation("label", "is required");
            if (keys.contains(key)) throw WorkItemService.validation("key", "is listed twice");
            keys.add(key);
            jdbc.update("""
                    INSERT INTO work_item_required_checks (org_id, work_item_id, check_key, label) VALUES (?, ?, ?, ?)
                    ON CONFLICT (work_item_id, check_key) DO UPDATE SET label = EXCLUDED.label
                    """, caller.orgId(), item.id(), key, label);
        }
        List<String> existing = jdbc.queryForList(
                "SELECT check_key FROM work_item_required_checks WHERE work_item_id = ?", String.class, item.id());
        for (String key : existing) {
            if (!keys.contains(key)) {
                jdbc.update("DELETE FROM work_item_required_checks WHERE work_item_id = ? AND check_key = ?", item.id(), key);
            }
        }
        jdbc.update("UPDATE work_items SET version = version + 1, updated_at = now() WHERE id = ?", item.id());
        record(caller, item, "work_item.checks_defined", null, item.state(), item.state(), "WorkItemChecksChanged",
                Map.of("checks", keys));
        return workItems.response(caller.orgId(), item.id());
    }

    @Transactional
    public List<CheckView> markCheck(Authentication authentication, String workItemId, String checkKey, CheckMark request) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        WorkItemService.Item visible = workItems.visible(caller, workItemId);
        boolean planner = workItems.can(caller, visible.projectId(), PermissionKey.TASK_CREATE)
                || workItems.can(caller, visible.projectId(), PermissionKey.TASK_ASSIGN);
        boolean reviewer = approvers.isApprover(authentication, caller.orgId(), visible.projectId())
                && (visible.reviewerId() == null || caller.userId().toString().equals(visible.reviewerId()));
        boolean assignee = caller.userId().toString().equals(visible.primaryAssigneeId());
        if ((!planner && !reviewer) || assignee) throw PermissionService.forbidden(); // never your own checks
        WorkItemService.Item item = lock(caller, visible.id());
        if ("DONE".equals(item.state())) throw invalidTransition("Reopen completed work before changing its checks.");
        boolean satisfied = Boolean.TRUE.equals(request.satisfied());
        int updated = jdbc.update("""
                UPDATE work_item_required_checks SET satisfied = ?, satisfied_by = ?, satisfied_at = ?
                WHERE work_item_id = ? AND check_key = ? AND org_id = ?
                """, satisfied, satisfied ? caller.userId() : null, satisfied ? Timestamp.from(Instant.now()) : null,
                item.id(), checkKey, caller.orgId());
        if (updated == 0) throw PermissionService.notFound();
        record(caller, item, "work_item.check_marked", null, item.state(), item.state(), "WorkItemCheckMarked",
                Map.of("check", checkKey, "satisfied", satisfied));
        return checks(item.id());
    }

    /* ================================================================== history */

    @Transactional(readOnly = true)
    public ReviewHistory history(Authentication authentication, String workItemId) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        WorkItemService.Item item = workItems.visible(caller, workItemId);
        List<SubmissionView> submissions = jdbc.query("""
                SELECT s.id, s.revision, s.criteria_version, s.evidence::text AS evidence, s.note, s.status, s.submitted_at,
                       s.submitted_by, u.email
                FROM work_item_submissions s JOIN users u ON u.id = s.submitted_by
                WHERE s.work_item_id = ? AND s.org_id = ? ORDER BY s.revision DESC
                """, (rs, n) -> new SubmissionView(rs.getObject("id", UUID.class), rs.getInt("revision"),
                        rs.getInt("criteria_version"), tree(rs.getString("evidence")), rs.getString("note"),
                        rs.getString("status"), rs.getTimestamp("submitted_at").toInstant(),
                        rs.getObject("submitted_by", UUID.class), rs.getString("email")), item.id(), caller.orgId());
        List<ReviewView> reviews = jdbc.query("""
                SELECT r.id, r.decision, r.reason, r.evidence_ref, r.work_item_revision, r.decided_at, r.reviewer_id, u.email
                FROM work_item_reviews r JOIN users u ON u.id = r.reviewer_id
                WHERE r.work_item_id = ? AND r.org_id = ? ORDER BY r.decided_at DESC, r.id
                """, (rs, n) -> new ReviewView(rs.getObject("id", UUID.class), rs.getString("decision"), rs.getString("reason"),
                        rs.getString("evidence_ref"), rs.getInt("work_item_revision"), rs.getTimestamp("decided_at").toInstant(),
                        rs.getObject("reviewer_id", UUID.class), rs.getString("email")), item.id(), caller.orgId());
        List<ReopenView> reopens = jdbc.query("""
                SELECT e.reason, e.superseded_revision, e.occurred_at, e.actor_id, u.email
                FROM work_item_reopen_events e JOIN users u ON u.id = e.actor_id
                WHERE e.work_item_id = ? AND e.org_id = ? ORDER BY e.occurred_at DESC
                """, (rs, n) -> new ReopenView(rs.getString("reason"), (Integer) rs.getObject("superseded_revision"),
                        rs.getTimestamp("occurred_at").toInstant(), rs.getObject("actor_id", UUID.class), rs.getString("email")),
                item.id(), caller.orgId());
        return new ReviewHistory(submissions, reviews, checks(item.id()), reopens);
    }

    /** Review decisions on the caller's own submissions (newest first), on projects they can still read. */
    @Transactional(readOnly = true)
    public List<FeedbackView> myFeedback(Authentication authentication) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        java.util.Set<String> readable = new java.util.HashSet<>();
        for (WorkItemService.WorkItemResponse item : workItems.mine(authentication)) readable.add(item.id());
        return jdbc.query("""
                SELECT r.id, r.work_item_id, w.key, w.title, w.project_id, w.state, r.decision, r.reason,
                       r.work_item_revision, r.decided_at, u.email AS reviewer_email
                FROM work_item_reviews r
                JOIN work_item_submissions s ON s.id = r.submission_id
                JOIN work_items w ON w.id = r.work_item_id
                JOIN users u ON u.id = r.reviewer_id
                WHERE r.org_id = ? AND s.submitted_by = ?
                ORDER BY r.decided_at DESC LIMIT 200
                """, (rs, n) -> new FeedbackView(rs.getObject("id", UUID.class), rs.getString("work_item_id"),
                        rs.getString("key"), rs.getString("title"), rs.getString("project_id"), rs.getString("state"),
                        rs.getString("decision"), rs.getString("reason"), rs.getInt("work_item_revision"),
                        rs.getTimestamp("decided_at").toInstant(), rs.getString("reviewer_email")),
                caller.orgId(), caller.userId()).stream().filter(f -> readable.contains(f.workItemId())).toList();
    }

    private List<CheckView> checks(String itemId) {
        return jdbc.query("""
                SELECT check_key, label, satisfied, satisfied_at FROM work_item_required_checks
                WHERE work_item_id = ? ORDER BY check_key
                """, (rs, n) -> new CheckView(rs.getString("check_key"), rs.getString("label"), rs.getBoolean("satisfied"),
                        rs.getTimestamp("satisfied_at") == null ? null : rs.getTimestamp("satisfied_at").toInstant()), itemId);
    }

    /* ================================================================== legacy developer endpoint */

    /**
     * PATCH /v1/developer/tasks/{id}/status (Developer module) goes through the same rules: start and submit only.
     * Done, Cancelled and other jumps are refused (409 INVALID_TRANSITION); the caller has already been shown the task.
     */
    @Transactional
    public void legacyTransition(Authentication authentication, String workItemId, String targetState, String note) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        WorkItemService.Item item = workItems.visible(caller, workItemId);
        String target = targetState == null ? "" : targetState.trim().toUpperCase(Locale.ROOT);
        if (target.equals(item.state())) return;
        switch (target) {
            case "IN_PROGRESS" -> start(authentication, workItemId, new VersionRequest(item.version()));
            case "IN_REVIEW" -> submit(authentication, workItemId, new SubmissionRequest(item.version(), note, List.of()));
            default -> throw invalidTransition(
                    "Use start, submit for review and the reviewer's decision to move work forward.");
        }
    }

    /* ================================================================== helpers */

    private record Policy(boolean reviewRequired, int currentRevision, Integer submittedRevision, int criteriaVersion,
            String criteria) {}

    private Policy policy(String itemId) {
        return jdbc.queryForObject("""
                SELECT review_required, current_revision, submitted_revision, criteria_version, criteria
                FROM work_items WHERE id = ?
                """, (rs, n) -> new Policy(rs.getBoolean("review_required"), rs.getInt("current_revision"),
                        (Integer) rs.getObject("submitted_revision"), rs.getInt("criteria_version"), rs.getString("criteria")),
                itemId);
    }

    private void requireChecks(String itemId) {
        List<String> missing = jdbc.queryForList("""
                SELECT label FROM work_item_required_checks WHERE work_item_id = ? AND NOT satisfied ORDER BY check_key
                """, String.class, itemId);
        if (!missing.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "MISSING_CHECK",
                    "Required checks are not satisfied: " + String.join(", ", missing) + ".",
                    List.of(new ApiError.FieldError("checks", String.join("; ", missing))));
        }
    }

    private WorkItemService.Item lockedWorkable(WorkItemService.Caller caller, String workItemId) {
        WorkItemService.Item visible = workItems.visible(caller, workItemId);
        WorkItemService.Item item = lock(caller, visible.id());
        if ("RETIRED".equals(item.planStatus()) || "CANCELLED".equals(item.state())) {
            throw invalidTransition("Retired or cancelled work cannot change.");
        }
        Boolean archived = jdbc.queryForObject("SELECT archived FROM projects WHERE id = ?", Boolean.class, item.projectId());
        if (Boolean.TRUE.equals(archived)) throw WorkItemService.conflict("PROJECT_ARCHIVED", "Archived projects cannot be edited.");
        return item;
    }

    /** Locks the row and re-reads it, so concurrent transitions of one item run one after the other. */
    private WorkItemService.Item lock(WorkItemService.Caller caller, String itemId) {
        jdbc.queryForList("SELECT id FROM work_items WHERE id = ? AND org_id = ? FOR UPDATE", itemId, caller.orgId());
        return workItems.find(caller.orgId(), itemId);
    }

    private void requireAssignee(WorkItemService.Caller caller, WorkItemService.Item item) {
        if (!caller.userId().toString().equals(item.primaryAssigneeId())
                || !workItems.can(caller, item.projectId(), PermissionKey.TASK_UPDATE)) {
            throw PermissionService.forbidden();
        }
    }

    private void notifyCredit(WorkItemService.Caller caller, String itemId, String cause) {
        for (WorkItemStateListener listener : listeners) listener.creditChanged(caller.orgId(), itemId, cause, caller.userId());
    }

    private void record(WorkItemService.Caller caller, WorkItemService.Item item, String action, String reason,
            String fromState, String toState, String eventType, Map<String, ?> extra) {
        Map<String, Object> after = new LinkedHashMap<>(extra);
        after.put("state", toState);
        Map<String, Object> payload = new LinkedHashMap<>(after);
        payload.put("project_id", item.projectId());
        payload.put("key", item.key());
        changes.record(
                new ChangeRecorder.AuditEntry(caller.orgId(), caller.userId(), action, "WORK_ITEM",
                        WorkItemService.uuidOf(item.id()), reason, Map.of("state", fromState), after),
                new ChangeRecorder.DomainEvent(caller.orgId(), "WORK_ITEM", WorkItemService.uuidOf(item.id()),
                        item.version() + 1, eventType, payload));
    }

    private String evidence(List<EvidenceItem> items) {
        List<Map<String, String>> clean = new ArrayList<>();
        if (items != null) {
            if (items.size() > 20) throw WorkItemService.validation("evidence", "at most 20 items");
            for (EvidenceItem item : items) {
                String ref = text(item.ref(), 500);
                if (ref == null) throw WorkItemService.validation("evidence", "each item needs a link or reference");
                String type = item.type() == null ? "LINK" : item.type().trim().toUpperCase(Locale.ROOT);
                if (!List.of("LINK", "COMMIT", "PULL_REQUEST", "FILE", "NOTE").contains(type)) {
                    throw WorkItemService.validation("evidence", "type must be LINK, COMMIT, PULL_REQUEST, FILE or NOTE");
                }
                Map<String, String> entry = new LinkedHashMap<>();
                entry.put("type", type);
                entry.put("ref", ref);
                String label = text(item.label(), 200);
                if (label != null) entry.put("label", label);
                clean.add(entry);
            }
        }
        try {
            return objectMapper.writeValueAsString(clean);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private JsonNode tree(String value) {
        try {
            return objectMapper.readTree(value == null ? "[]" : value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static String text(String value, int max) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return null;
        if (trimmed.length() > max) throw WorkItemService.validation("text", "is longer than " + max + " characters");
        return trimmed;
    }

    private static long expected(Long value) {
        if (value == null) throw WorkItemService.validation("expected_version", "is required");
        return value;
    }

    private static ApiException invalidTransition(String message) {
        return new ApiException(HttpStatus.CONFLICT, "INVALID_TRANSITION", message);
    }

    private static ApiException staleReview() {
        return new ApiException(HttpStatus.CONFLICT, "STALE_REVIEW",
                "This review no longer matches the work: it was resubmitted, decided, or reassigned. Reload and review again.");
    }

    /* ================================================================== API records */

    public record VersionRequest(Long expectedVersion) {}

    public record EvidenceItem(String type, String ref, String label) {}

    public record SubmissionRequest(Long expectedVersion, String note, List<EvidenceItem> evidence) {}

    public record ReviewRequest(Integer submittedRevision, String decision, String reason, String evidenceRef) {}

    public record ReopenRequest(String reason, Long expectedVersion) {}

    public record CheckDefinition(String key, String label) {}

    public record ChecksRequest(List<CheckDefinition> checks, Long expectedVersion) {}

    public record CheckMark(Boolean satisfied) {}

    public record CheckView(String key, String label, boolean satisfied, Instant satisfiedAt) {}

    public record SubmissionView(UUID id, int revision, int criteriaVersion, JsonNode evidence, String note, String status,
            Instant submittedAt, UUID submittedBy, String submittedByEmail) {}

    public record ReviewView(UUID id, String decision, String reason, String evidenceRef, int revision, Instant decidedAt,
            UUID reviewerId, String reviewerEmail) {}

    public record ReopenView(String reason, Integer supersededRevision, Instant occurredAt, UUID actorId, String actorEmail) {}

    public record FeedbackView(UUID id, String workItemId, String key, String title, String projectId, String state,
            String decision, String reason, int revision, Instant decidedAt, String reviewerEmail) {}

    public record ReviewHistory(List<SubmissionView> submissions, List<ReviewView> reviews, List<CheckView> checks,
            List<ReopenView> reopenEvents) {}
}
