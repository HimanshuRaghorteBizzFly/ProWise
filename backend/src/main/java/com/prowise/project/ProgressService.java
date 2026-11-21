package com.prowise.project;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.authz.SecurityEvidenceService;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.developer.GitHubActivityEntity;
import com.prowise.developer.GitHubActivityRepository;
import com.prowise.domain.IndividualProgress;
import com.prowise.domain.IndividualProgress.Entry;
import com.prowise.domain.IndividualProgress.Status;
import com.prowise.project.ProgressDTOs.AttachRepoRequest;
import com.prowise.project.ProgressDTOs.CheckIn;
import com.prowise.project.ProgressDTOs.CheckInRequest;
import com.prowise.project.ProgressDTOs.DecisionRequest;
import com.prowise.project.ProgressDTOs.Figure;
import com.prowise.project.ProgressDTOs.PendingReview;
import com.prowise.project.ProgressDTOs.PersonRef;
import com.prowise.project.ProgressDTOs.ProgressSummary;
import com.prowise.project.ProjectService.ProjectResponse;

/**
 * Task 2.2: Individual progress check-ins with Team Lead approval.
 *
 * <ul>
 *   <li>Only the accountable developer (holding project.progress.report) submits. Every submission is a new PENDING
 *       entry; the project's figure does not change until the lead of the project's team approves it.</li>
 *   <li>Approve or reject needs project.progress.verify AND being the lead of the project's team AND not being the
 *       author. No team lead: the entry stays pending.</li>
 *   <li>Entries are append-only (database trigger); a correction is a new entry; a downward one needs a reason.</li>
 *   <li>The label is always "Developer reported"; approving 100% never changes the lifecycle.</li>
 *   <li>Readability follows the task 2.1 project rule (unreadable or foreign = 404). The organization always comes
 *       from the org-bound token or a checked path membership, never from a body.</li>
 *   <li>Each change writes its audit row and outbox event in the same transaction (ChangeRecorder).</li>
 * </ul>
 */
@Service
public class ProgressService {

    private static final Set<String> CLOSED_LIFECYCLES = Set.of("DELIVERED", "CLOSED", "CANCELLED");
    private static final String NO_LEAD_NOTE =
            "No team lead is assigned to this project's team, so check-ins stay pending until one is.";

    private final JdbcTemplate jdbc;
    private final ProjectService projects;
    private final PermissionService permissions;
    private final SecurityEvidenceService evidence;
    private final ChangeRecorder changes;
    private final GitHubActivityRepository gitHubActivity;
    private final ProjectRepositoryLinkRepository repoLinks;

    public ProgressService(JdbcTemplate jdbc, ProjectService projects, PermissionService permissions,
            SecurityEvidenceService evidence, ChangeRecorder changes, GitHubActivityRepository gitHubActivity,
            ProjectRepositoryLinkRepository repoLinks) {
        this.jdbc = jdbc;
        this.projects = projects;
        this.permissions = permissions;
        this.evidence = evidence;
        this.changes = changes;
        this.gitHubActivity = gitHubActivity;
        this.repoLinks = repoLinks;
    }

    /* ================================================================== submit */

    @Transactional
    public CheckIn submit(Authentication authentication, String projectId, CheckInRequest request, String idempotencyKey) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectResponse project = projects.get(orgId, projectId, authentication);
        UUID membershipId = permissions.requireMembership(authentication, orgId);
        UUID userId = permissions.principal(authentication).userId();

        if (!"INDIVIDUAL".equals(project.mode())) {
            throw conflict("PROJECT_NOT_INDIVIDUAL",
                    "Only Individual projects take percentage check-ins. Structured progress is calculated from work.");
        }
        if (project.archived()) {
            throw conflict("PROJECT_ARCHIVED", "Archived projects do not take check-ins.");
        }
        if (CLOSED_LIFECYCLES.contains(project.lifecycle())) {
            throw conflict("PROJECT_NOT_OPEN", "This project is " + project.lifecycle().toLowerCase(Locale.ROOT)
                    + "; a correction needs an authorized reopening first.");
        }
        if (!isAccountable(project, membershipId)
                || !permissions.canOnProject(authentication, orgId, project.id(), PermissionKey.PROJECT_PROGRESS_REPORT.value())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_ACCOUNTABLE_DEVELOPER",
                    "Only the project's accountable developer reports its progress.");
        }

        BigDecimal percent;
        try {
            percent = IndividualProgress.validPercent(request.percent());
        } catch (IllegalArgumentException invalid) {
            throw validation("percent", invalid.getMessage());
        }
        String accomplished = required("accomplished", request.accomplished(), 4000);
        String nextSteps = required("next_steps", request.nextSteps(), 4000);
        String blockers = optional("blockers", request.blockers(), 4000);
        String evidenceText = optional("evidence", request.evidence(), 2000);
        String downwardReason = optional("downward_reason", request.downwardReason(), 1000);
        String key = idempotencyKey == null || idempotencyKey.isBlank() ? null : idempotencyKey.trim();

        // Serialize submissions per project: the one-pending rule and the revision sequence depend on it.
        jdbc.queryForObject("SELECT version FROM projects WHERE id = ? AND org_id = ? FOR UPDATE", Long.class,
                project.id(), orgId);

        if (key != null) {
            Optional<Row> replay = rowByKey(orgId, key);
            if (replay.isPresent()) {
                Row earlier = replay.get();
                if (earlier.projectId().equals(project.id()) && userId.toString().equals(earlier.authorId())) {
                    return earlier.toCheckIn();
                }
                throw conflict("IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used for another request.");
            }
        }

        List<Row> rows = rows(orgId, project.id());
        List<Entry> entries = entries(rows);
        if (IndividualProgress.pendingEntry(entries).isPresent()) {
            throw conflict("CHECKIN_PENDING_DECISION",
                    "Your previous check-in is waiting for the Team Lead's decision. Submit again after it is decided.");
        }
        if (IndividualProgress.reasonMissing(percent, downwardReason, entries)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DOWNWARD_REASON_REQUIRED",
                    "Progress is lower than the approved figure. Explain why.",
                    List.of(new ApiError.FieldError("downward_reason", "is required for a downward correction")));
        }
        if (!IndividualProgress.isDownward(percent, entries)) downwardReason = null;

        String id = UUID.randomUUID().toString();
        int revision = IndividualProgress.nextRevision(entries);
        String revisionOf = rows.isEmpty() ? null : rows.get(0).id();
        LocalDate finish = request.projectedFinish();
        jdbc.update("""
                INSERT INTO project_progress_checkins (id, org_id, project_id, author_id, author_name, percent, accomplished,
                    next_steps, blockers, projected_finish, projected_finish_on, evidence_summary, downward_reason, status,
                    method, revision_seq, revision_of, idempotency_key, captured_at, created_at, version)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, now(), now(), 0)
                """, id, orgId, project.id(), userId.toString(), permissions.principal(authentication).email(), percent,
                accomplished, nextSteps, blockers, startOfDay(finish, project.timezone()),
                finish == null ? null : Date.valueOf(finish), evidenceText, downwardReason, IndividualProgress.METHOD,
                revision, revisionOf, key);

        CheckIn created = one(orgId, id);
        Figure current = figure(entries);
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, userId, "checkin.submitted", "CHECKIN", UUID.fromString(id),
                        downwardReason, figureSnapshot(current), entrySnapshot(created)),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT", aggregateId(project.id()), project.version(),
                        "CheckInSubmitted", eventPayload(project.id(), created)));
        return created;
    }

    /* ================================================================== decide */

    @Transactional
    public CheckIn decide(Authentication authentication, String checkinId, DecisionRequest request) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        List<String> projectIds = jdbc.queryForList(
                "SELECT project_id FROM project_progress_checkins WHERE id = ? AND org_id = ?", String.class,
                checkinId == null ? "" : checkinId, orgId);
        if (projectIds.isEmpty()) {
            throw notFound(authentication, checkinId);
        }
        ProjectResponse project = projects.get(orgId, projectIds.get(0), authentication);
        UUID membershipId = permissions.requireMembership(authentication, orgId);
        UUID userId = permissions.principal(authentication).userId();

        String decision = request.decision() == null ? "" : request.decision().trim().toUpperCase(Locale.ROOT);
        if (!decision.equals("APPROVE") && !decision.equals("REJECT")) {
            throw validation("decision", "Choose APPROVE or REJECT.");
        }
        if (request.expectedVersion() == null) {
            throw validation("expected_version", "is required");
        }
        String reason = optional("reason", request.reason(), 1000);
        if (decision.equals("REJECT") && reason == null) {
            throw validation("reason", "Give a reason for the rejection.");
        }

        Row row = jdbc.query(ROW_SELECT + " WHERE c.org_id = ? AND c.id = ? FOR UPDATE OF c", (rs, n) -> row(rs),
                orgId, checkinId).get(0);
        Entry entry = row.toEntry();
        if (IndividualProgress.selfDecision(entry, userId.toString())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "SELF_APPROVAL_NOT_ALLOWED",
                    "You cannot approve or reject your own check-in.");
        }
        UUID lead = teamLead(orgId, project.teamId());
        if (lead == null || !lead.equals(membershipId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_PROJECT_TEAM_LEAD",
                    "Only the lead of this project's team can approve or reject its check-ins.");
        }
        if (!permissions.canOnProject(authentication, orgId, project.id(), PermissionKey.PROJECT_PROGRESS_VERIFY.value())) {
            throw PermissionService.forbidden();
        }
        if (!IndividualProgress.decidable(entry)) {
            throw conflict("CHECKIN_ALREADY_DECIDED",
                    "This check-in was already " + entry.status().name().toLowerCase(Locale.ROOT) + ".");
        }
        ExpectedVersion.check(row.version(), request.expectedVersion());
        if (project.archived()) {
            throw conflict("PROJECT_ARCHIVED", "Archived projects do not take decisions.");
        }

        List<Entry> before = entries(rows(orgId, project.id()));
        Figure previous = figure(before);
        String status = decision.equals("APPROVE") ? "APPROVED" : "REJECTED";
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE project_progress_checkins
                SET status = ?, verified_by = ?, reviewed_at = now(), review_comment = ?, version = version + 1
                WHERE id = ? AND org_id = ? AND version = ? AND status = 'PENDING'
                """, status, userId.toString(), reason, checkinId, orgId, request.expectedVersion()));

        Figure next = figure(entries(rows(orgId, project.id())));
        if (status.equals("APPROVED")) {
            // Cache of the approved figure for lists; the lifecycle is never touched (100% does not close delivery).
            jdbc.update("""
                    UPDATE projects SET last_progress_percent = ?, last_progress_method = ?, last_reported_at = ?,
                        updated_at = now()
                    WHERE id = ? AND org_id = ?
                    """, next.percent(), IndividualProgress.METHOD,
                    next.reportedAt() == null ? null : Timestamp.from(next.reportedAt()), project.id(), orgId);
        }

        CheckIn decided = one(orgId, checkinId);
        Map<String, Object> previousState = figureSnapshot(previous);
        previousState.put("status", "PENDING");
        Map<String, Object> nextState = figureSnapshot(next);
        nextState.put("status", status);
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, userId, status.equals("APPROVED") ? "checkin.approved" : "checkin.rejected",
                        "CHECKIN", aggregateId(checkinId), reason, previousState, nextState),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT", aggregateId(project.id()), project.version(),
                        status.equals("APPROVED") ? "CheckInApproved" : "CheckInRejected",
                        eventPayload(project.id(), decided)));
        return decided;
    }

    /* ================================================================== reads */

    @Transactional(readOnly = true)
    public List<CheckIn> history(Authentication authentication, String projectId) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectResponse project = projects.get(orgId, projectId, authentication);
        return rows(orgId, project.id()).stream().map(Row::toCheckIn).toList();
    }

    @Transactional(readOnly = true)
    public ProgressSummary summary(Authentication authentication, String projectId) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectResponse project = projects.get(orgId, projectId, authentication);
        UUID membershipId = permissions.requireMembership(authentication, orgId);
        UUID userId = permissions.principal(authentication).userId();

        List<Row> rows = rows(orgId, project.id());
        List<Entry> entries = entries(rows);
        Optional<Row> pending = rows.stream().filter(r -> "PENDING".equals(r.status())).findFirst();
        UUID lead = teamLead(orgId, project.teamId());
        PersonRef approver = lead == null ? null : person(orgId, lead);

        boolean open = "INDIVIDUAL".equals(project.mode()) && !project.archived()
                && !CLOSED_LIFECYCLES.contains(project.lifecycle());
        boolean canSubmit = open && pending.isEmpty() && isAccountable(project, membershipId)
                && permissions.canOnProject(authentication, orgId, project.id(), PermissionKey.PROJECT_PROGRESS_REPORT.value());
        boolean canDecide = pending.isPresent() && !project.archived() && membershipId.equals(lead)
                && !userId.toString().equals(pending.get().authorId())
                && permissions.canOnProject(authentication, orgId, project.id(), PermissionKey.PROJECT_PROGRESS_VERIFY.value());

        return new ProgressSummary(project.id(), project.key(), project.name(), project.mode(), project.lifecycle(),
                project.archived(), figure(entries), pending.map(Row::toCheckIn).orElse(null), approver,
                approver == null ? NO_LEAD_NOTE : null, canSubmit, canDecide,
                rows.stream().map(Row::toCheckIn).toList());
    }

    /** The caller's approval queue: pending entries of projects whose team they lead, never their own. */
    @Transactional(readOnly = true)
    public List<PendingReview> pendingQueue(Authentication authentication, UUID orgId) {
        UUID membershipId = permissions.requireMembership(authentication, orgId);
        UUID userId = permissions.principal(authentication).userId();
        List<Row> pending = jdbc.query(ROW_SELECT + """
                 JOIN projects p ON p.id = c.project_id AND p.org_id = c.org_id
                 JOIN teams t ON t.id = p.team_id AND t.org_id = p.org_id
                 WHERE c.org_id = ? AND c.status = 'PENDING' AND t.lead_membership_id = ? AND c.author_id <> ?
                   AND p.archived = false
                 ORDER BY c.created_at, c.id
                """, (rs, n) -> row(rs), orgId, membershipId, userId.toString());

        List<PendingReview> queue = new ArrayList<>();
        for (Row row : pending) {
            if (!permissions.canOnProject(authentication, orgId, row.projectId(), PermissionKey.PROJECT_PROGRESS_VERIFY.value())) {
                continue;
            }
            Map<String, Object> p = jdbc.queryForMap("SELECT key, name FROM projects WHERE id = ? AND org_id = ?",
                    row.projectId(), orgId);
            queue.add(new PendingReview(row.projectId(), (String) p.get("key"), (String) p.get("name"),
                    figure(entries(rows(orgId, row.projectId()))), row.toCheckIn()));
        }
        return queue;
    }

    /* ================================================================== repository evidence (unchanged scope) */

    @Transactional(readOnly = true)
    public List<GitHubActivityEntity> gitHubActivity(Authentication authentication, String projectId) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectResponse project = projects.get(orgId, projectId, authentication);
        List<GitHubActivityEntity> byProject = gitHubActivity.findByOrgIdAndProjectIdOrderByCreatedAtDesc(orgId, project.id());
        if (!byProject.isEmpty()) return byProject;
        List<GitHubActivityEntity> combined = new ArrayList<>();
        for (ProjectRepositoryLinkEntity link : repoLinks.findByOrgIdAndProjectId(orgId, project.id())) {
            combined.addAll(gitHubActivity.findByOrgIdAndRepositoryNameOrderByCreatedAtDesc(orgId, link.getRepoName()));
        }
        combined.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
        return combined; // never other projects' activity
    }

    @Transactional
    public void linkRepository(Authentication authentication, String projectId, AttachRepoRequest request) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectResponse project = projects.get(orgId, projectId, authentication);
        if (!permissions.canOnProject(authentication, orgId, project.id(), PermissionKey.PROJECT_EDIT.value())) {
            throw PermissionService.forbidden();
        }
        String repoName = required("repo_name", request.repoName(), 150);
        if (repoLinks.findByOrgIdAndProjectIdAndRepoName(orgId, project.id(), repoName).isEmpty()) {
            repoLinks.save(new ProjectRepositoryLinkEntity("prl-" + UUID.randomUUID().toString().substring(0, 12), orgId,
                    project.id(), repoName, request.defaultBranch() != null ? request.defaultBranch() : "main"));
        }
    }

    /* ================================================================== rows */

    private static final String ROW_SELECT = """
            SELECT c.id, c.project_id, c.revision_seq, c.revision_of, c.percent, c.accomplished, c.next_steps, c.blockers,
                   c.projected_finish_on, c.evidence_summary, c.downward_reason, c.status, c.method, c.author_id,
                   au.email AS author_email, COALESCE(c.captured_at, c.created_at) AS submitted_at, c.verified_by,
                   du.email AS decider_email, c.reviewed_at, c.review_comment, c.version
            FROM project_progress_checkins c
            LEFT JOIN users au ON CAST(au.id AS text) = c.author_id
            LEFT JOIN users du ON CAST(du.id AS text) = c.verified_by
            """;

    private record Row(String id, String projectId, int revisionSeq, String revisionOf, BigDecimal percent,
            String accomplished, String nextSteps, String blockers, LocalDate projectedFinish, String evidence,
            String downwardReason, String status, String method, String authorId, String authorEmail,
            Instant submittedAt, String deciderId, String deciderEmail, Instant decidedAt, String decisionReason,
            long version) {

        Entry toEntry() {
            return new Entry(id, revisionSeq, percent, Status.valueOf(status), authorId, submittedAt, decidedAt);
        }

        CheckIn toCheckIn() {
            return new CheckIn(id, projectId, revisionSeq, revisionOf, percent, accomplished, nextSteps, blockers,
                    projectedFinish, evidence, downwardReason, status, method, IndividualProgress.LABEL,
                    new PersonRef(uuid(authorId), authorEmail), submittedAt,
                    deciderId == null ? null : new PersonRef(uuid(deciderId), deciderEmail), decidedAt, decisionReason,
                    version);
        }
    }

    private static Row row(ResultSet rs) throws SQLException {
        Date finish = rs.getDate("projected_finish_on");
        Timestamp decided = rs.getTimestamp("reviewed_at");
        return new Row(rs.getString("id"), rs.getString("project_id"), rs.getInt("revision_seq"),
                rs.getString("revision_of"), rs.getBigDecimal("percent"), rs.getString("accomplished"),
                rs.getString("next_steps"), rs.getString("blockers"), finish == null ? null : finish.toLocalDate(),
                rs.getString("evidence_summary"), rs.getString("downward_reason"), rs.getString("status"),
                rs.getString("method"), rs.getString("author_id"), rs.getString("author_email"),
                rs.getTimestamp("submitted_at").toInstant(), rs.getString("verified_by"), rs.getString("decider_email"),
                decided == null ? null : decided.toInstant(), rs.getString("review_comment"), rs.getLong("version"));
    }

    /** All entries of one project, newest revision first. */
    private List<Row> rows(UUID orgId, String projectId) {
        return jdbc.query(ROW_SELECT + " WHERE c.org_id = ? AND c.project_id = ? ORDER BY c.revision_seq DESC",
                (rs, n) -> row(rs), orgId, projectId);
    }

    private Optional<Row> rowByKey(UUID orgId, String key) {
        return jdbc.query(ROW_SELECT + " WHERE c.org_id = ? AND c.idempotency_key = ?", (rs, n) -> row(rs), orgId, key)
                .stream().findFirst();
    }

    private CheckIn one(UUID orgId, String id) {
        return jdbc.query(ROW_SELECT + " WHERE c.org_id = ? AND c.id = ?", (rs, n) -> row(rs), orgId, id).get(0).toCheckIn();
    }

    private static List<Entry> entries(List<Row> rows) {
        return rows.stream().map(Row::toEntry).toList();
    }

    private static Figure figure(List<Entry> entries) {
        IndividualProgress.Figure f = IndividualProgress.current(entries);
        return new Figure(f.percent(), f.label(), f.reported() ? IndividualProgress.METHOD : null, f.reportedAt(),
                f.approvedAt(), f.entryId());
    }

    /* ================================================================== helpers */

    private static boolean isAccountable(ProjectResponse project, UUID membershipId) {
        return project.accountable() != null && membershipId.equals(project.accountable().membershipId());
    }

    /** The active lead membership of the project's team, or null (no team, no lead, or lead not active). */
    private UUID teamLead(UUID orgId, UUID teamId) {
        if (teamId == null) return null;
        return jdbc.query("""
                SELECT t.lead_membership_id FROM teams t
                JOIN memberships m ON m.id = t.lead_membership_id AND m.org_id = t.org_id AND m.status = 'ACTIVE'
                WHERE t.id = ? AND t.org_id = ?
                """, (rs, n) -> rs.getObject(1, UUID.class), teamId, orgId).stream().findFirst().orElse(null);
    }

    private PersonRef person(UUID orgId, UUID membershipId) {
        return jdbc.query("""
                SELECT u.id, u.email FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.id = ? AND m.org_id = ?
                """, (rs, n) -> new PersonRef(rs.getObject("id", UUID.class), rs.getString("email")), membershipId, orgId)
                .stream().findFirst().orElse(null);
    }

    private ApiException notFound(Authentication authentication, String ref) {
        evidence.recordDenied(permissions.principal(authentication), SecurityEvidenceService.ACCESS_DENIED, "CHECKIN",
                ref == null ? null : ref.substring(0, Math.min(ref.length(), 100)), "Check-in not readable");
        return PermissionService.notFound();
    }

    private static Map<String, Object> figureSnapshot(Figure figure) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("current_percent", figure.percent());
        s.put("current_checkin_id", figure.checkinId());
        return s;
    }

    private static Map<String, Object> entrySnapshot(CheckIn c) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("checkin_id", c.id());
        s.put("percent", c.percent());
        s.put("revision_seq", c.revisionSeq());
        s.put("status", c.status());
        s.put("method", c.method());
        return s;
    }

    private static Map<String, Object> eventPayload(String projectId, CheckIn c) {
        Map<String, Object> s = entrySnapshot(c);
        s.put("project_id", projectId);
        return s;
    }

    /** 2.1 projects have UUID ids; legacy ids get a stable name-based UUID for the event envelope. */
    private static UUID aggregateId(String projectId) {
        UUID parsed = uuid(projectId);
        return parsed != null ? parsed : UUID.nameUUIDFromBytes(projectId.getBytes(StandardCharsets.UTF_8));
    }

    private static UUID uuid(String value) {
        if (value == null) return null;
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static Timestamp startOfDay(LocalDate date, String timezone) {
        if (date == null) return null;
        ZoneId zone = timezone == null ? ZoneId.of("UTC") : ZoneId.of(timezone);
        return Timestamp.from(date.atStartOfDay(zone).toInstant());
    }

    private static String required(String field, String value, int max) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty()) throw validation(field, "is required");
        if (trimmed.length() > max) throw validation(field, "must be at most " + max + " characters");
        return trimmed;
    }

    private static String optional(String field, String value, int max) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.length() > max) throw validation(field, "must be at most " + max + " characters");
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The request has invalid fields.",
                List.of(new ApiError.FieldError(field, message)));
    }

    private static ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }
}
