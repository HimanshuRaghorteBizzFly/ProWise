package com.prowise.work;

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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
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
import com.prowise.identity.AuthPrincipal;
import com.prowise.project.ProjectService;

/**
 * Task 3.1: breakdown and assignment (FR-012, FR-019, FR-020) on the existing {@code work_items} table.
 *
 * <ul>
 *   <li>Hierarchy: project -> optional milestone -> optional deliverable -> task -> subtask, at most five levels
 *       including the project; parents are in the same project (also enforced by a composite foreign key); no loops.
 *       Hierarchy changes serialize on the project row.</li>
 *   <li>The organization comes from the org-bound token. A work item is visible only when its project is readable
 *       (task 2.1 rule); otherwise 404 with no metadata.</li>
 *   <li>Planning (create, structure, criteria, due date, retire) needs {@code task.create}; assignment needs
 *       {@code task.assign}; the primary assignee with {@code task.update} may edit only the description.</li>
 *   <li>Weights are never set here: they come from an approved scope version (task 3.2). Retiring or splitting work
 *       that is in the approved scope (plan status ACTIVE) returns 409 SCOPE_CHANGE_REQUIRED.</li>
 *   <li>Every change writes its audit row and outbox event in the same transaction (task 1.4) and is guarded by
 *       {@code expected_version}.</li>
 * </ul>
 */
@Service
public class WorkItemService {

    static final int MAX_DEPTH = 5; // including the project
    private static final Set<String> TYPES = Set.of("MILESTONE", "DELIVERABLE", "TASK", "SUBTASK");
    private static final Map<String, Set<String>> CHILD_TYPES = Map.of(
            "ROOT", Set.of("MILESTONE", "DELIVERABLE", "TASK"),
            "MILESTONE", Set.of("DELIVERABLE", "TASK"),
            "DELIVERABLE", Set.of("TASK"),
            "TASK", Set.of("SUBTASK"),
            "SUBTASK", Set.of("SUBTASK"));
    private static final Set<String> CRITICALITY = Set.of("NORMAL", "CRITICAL");

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;
    private final SecurityEvidenceService evidence;
    private final ProjectService projects;
    private final ChangeRecorder changes;

    public WorkItemService(JdbcTemplate jdbc, PermissionService permissions, SecurityEvidenceService evidence,
            ProjectService projects, ChangeRecorder changes) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.evidence = evidence;
        this.projects = projects;
        this.changes = changes;
    }

    /* ================================================================== reads */

    @Transactional(readOnly = true)
    public List<WorkItemResponse> list(Authentication authentication, String projectId) {
        Caller caller = caller(authentication);
        readableProject(caller, projectId);
        List<String> ids = jdbc.queryForList(
                "SELECT id FROM work_items WHERE org_id = ? AND project_id = ? ORDER BY created_at, key",
                String.class, caller.orgId(), projectId);
        List<WorkItemResponse> result = new ArrayList<>(ids.size());
        for (String id : ids) result.add(response(caller.orgId(), id));
        return result;
    }

    /**
     * The caller's own work across the organization: primary assignee or collaborator, on projects they can still
     * read (task 2.1 rule, re-checked per project). Retired work is left out.
     */
    @Transactional(readOnly = true)
    public List<WorkItemResponse> mine(Authentication authentication) {
        Caller caller = caller(authentication);
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT w.id, w.project_id FROM work_items w
                WHERE w.org_id = ? AND w.plan_status <> 'RETIRED'
                  AND (w.primary_assignee_id = ? OR EXISTS (SELECT 1 FROM work_item_collaborators c
                       WHERE c.work_item_id = w.id AND c.user_id = ?))
                ORDER BY w.due_on NULLS LAST, w.created_at, w.key
                """, caller.orgId(), caller.userId().toString(), caller.userId());
        Map<String, Boolean> readable = new java.util.HashMap<>();
        List<WorkItemResponse> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            String projectId = (String) row.get("project_id");
            // Removed from the project since: their old work is no longer shown (a quiet check, not a denial).
            boolean canRead = readable.computeIfAbsent(projectId,
                    id -> projects.readable(caller.orgId(), id, caller.authentication()));
            if (canRead) result.add(response(caller.orgId(), (String) row.get("id")));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public WorkItemResponse get(Authentication authentication, String workItemId) {
        Caller caller = caller(authentication);
        Item item = visible(caller, workItemId);
        return response(caller.orgId(), item.id());
    }

    @Transactional(readOnly = true)
    public List<AssignmentChange> assignmentHistory(Authentication authentication, String workItemId) {
        Caller caller = caller(authentication);
        Item item = visible(caller, workItemId);
        return jdbc.query("""
                SELECT assignment_role, previous_user_id, new_user_id, actor_id, reason, occurred_at
                FROM work_item_assignment_history WHERE org_id = ? AND work_item_id = ?
                ORDER BY occurred_at, id
                """, (rs, n) -> new AssignmentChange(rs.getString("assignment_role"),
                        rs.getObject("previous_user_id", UUID.class), rs.getObject("new_user_id", UUID.class),
                        rs.getObject("actor_id", UUID.class), rs.getString("reason"), instant(rs, "occurred_at")),
                caller.orgId(), item.id());
    }

    /* ================================================================== create */

    @Transactional
    public WorkItemResponse create(Authentication authentication, String projectId, CreateWorkItemRequest request) {
        Caller caller = caller(authentication);
        ProjectService.ProjectResponse project = readableProject(caller, projectId);
        requireOnProject(caller, project.id(), PermissionKey.TASK_CREATE);
        requireWritableStructured(project);

        String type = upper(request.type());
        if (type == null || !TYPES.contains(type)) throw validation("type", "must be MILESTONE, DELIVERABLE, TASK or SUBTASK");
        String title = title(request.title());
        String criticality = oneOf("criticality", request.criticality(), CRITICALITY, "NORMAL");

        lockProject(caller.orgId(), project.id());
        String parentId = blank(request.parentId()) ? null : request.parentId().trim();
        Item parent = null;
        if (parentId != null) {
            parent = parentInProject(caller.orgId(), project.id(), parentId);
            if ("ACTIVE".equals(parent.planStatus()) && activeChildren(parent.id()) == 0) {
                // The parent is an approved leaf: giving it children splits it, which is a scope change (3.2).
                throw scopeChangeRequired("Splitting approved work needs an approved scope change.");
            }
        }
        checkNesting(parent == null ? "ROOT" : parent.type(), type);
        int depth = parent == null ? 2 : depthOf(parent.id()) + 1;
        if (depth > MAX_DEPTH) throw maxDepth();

        Integer seq = jdbc.queryForObject(
                "UPDATE projects SET work_item_seq = work_item_seq + 1 WHERE id = ? AND org_id = ? RETURNING work_item_seq",
                Integer.class, project.id(), caller.orgId());
        String key = project.key().toUpperCase(Locale.ROOT) + "-" + seq;
        String id = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO work_items (id, project_id, org_id, parent_id, type, key, title, description, state,
                    plan_status, criticality, criteria, due_on, due_date, created_by, version)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'TODO', 'DRAFT', ?, ?, ?, ?, ?, 0)
                """, id, project.id(), caller.orgId(), parentId, type, key, title, text(request.description(), 10_000),
                criticality, text(request.criteria(), 10_000), sqlDate(request.dueOn()),
                startOfDay(request.dueOn(), project.timezone()), caller.userId());

        Map<String, Object> created = new LinkedHashMap<>();
        created.put("key", key);
        created.put("type", type);
        created.put("title", title);
        created.put("parent_id", parentId);
        changes.record(
                new ChangeRecorder.AuditEntry(caller.orgId(), caller.userId(), "work_item.created", "WORK_ITEM",
                        uuidOf(id), null, null, created),
                new ChangeRecorder.DomainEvent(caller.orgId(), "WORK_ITEM", uuidOf(id), 0L, "WorkItemCreated",
                        withProject(created, project.id())));
        return response(caller.orgId(), id);
    }

    /**
     * Creates one proposed part of a split (task 3.2). Only a scope draft calls this, after its own permission check:
     * the part is a DRAFT child of {@code parent} that inherits the parent's assignee, reviewer, criteria, due date and
     * criticality, and counts only once the scope version that proposed it is approved.
     */
    String createProposedPart(Caller caller, ProjectService.ProjectResponse project, Item parent, String title) {
        lockProject(caller.orgId(), project.id());
        String type = switch (parent.type()) {
            case "TASK", "SUBTASK" -> "SUBTASK";
            default -> "TASK";
        };
        checkNesting(parent.type(), type);
        if (depthOf(parent.id()) + 1 > MAX_DEPTH) throw maxDepth();
        Integer seq = jdbc.queryForObject(
                "UPDATE projects SET work_item_seq = work_item_seq + 1 WHERE id = ? AND org_id = ? RETURNING work_item_seq",
                Integer.class, project.id(), caller.orgId());
        String key = project.key().toUpperCase(Locale.ROOT) + "-" + seq;
        String id = UUID.randomUUID().toString();
        String cleanTitle = title(title);
        jdbc.update("""
                INSERT INTO work_items (id, project_id, org_id, parent_id, type, key, title, description, state, plan_status,
                    criticality, criteria, criteria_version, due_on, due_date, primary_assignee_id, reviewer_id, created_by, version)
                SELECT ?, project_id, org_id, id, ?, ?, ?, NULL, 'TODO', 'DRAFT', criticality, criteria, 1, due_on, due_date,
                       primary_assignee_id, reviewer_id, ?, 0
                FROM work_items WHERE id = ? AND org_id = ?
                """, id, type, key, cleanTitle, caller.userId(), parent.id(), caller.orgId());
        Map<String, Object> created = new LinkedHashMap<>();
        created.put("key", key);
        created.put("type", type);
        created.put("title", cleanTitle);
        created.put("parent_id", parent.id());
        created.put("proposed_by_split", true);
        changes.record(
                new ChangeRecorder.AuditEntry(caller.orgId(), caller.userId(), "work_item.created", "WORK_ITEM",
                        uuidOf(id), null, null, created),
                new ChangeRecorder.DomainEvent(caller.orgId(), "WORK_ITEM", uuidOf(id), 0L, "WorkItemCreated",
                        withProject(created, project.id())));
        return id;
    }

    /* ================================================================== edit */

    @Transactional
    public WorkItemResponse update(Authentication authentication, String workItemId, UpdateWorkItemRequest request) {
        Caller caller = caller(authentication);
        Item item = visible(caller, workItemId);
        ProjectService.ProjectResponse project = projects.get(caller.orgId(), item.projectId(), caller.authentication());
        long expected = expectedVersion(request.expectedVersion());

        boolean structural = request.title() != null || request.criteria() != null || request.dueOn() != null
                || request.criticality() != null || request.parentId() != null || Boolean.TRUE.equals(request.moveToRoot())
                || request.reviewRequired() != null;
        boolean planner = can(caller, item.projectId(), PermissionKey.TASK_CREATE)
                || can(caller, item.projectId(), PermissionKey.TASK_ASSIGN);
        boolean assigneeEditor = caller.userId().toString().equals(item.primaryAssigneeId())
                && can(caller, item.projectId(), PermissionKey.TASK_UPDATE);
        if (!planner && !(assigneeEditor && !structural)) throw PermissionService.forbidden();
        if (request.weight() != null) {
            throw scopeChangeRequired("Weights change only through an approved scope version.");
        }
        if (project.archived()) throw conflict("PROJECT_ARCHIVED", "Archived projects cannot be edited.");
        if ("RETIRED".equals(item.planStatus())) throw conflict("WORK_ITEM_RETIRED", "Retired work cannot be edited.");
        ExpectedVersion.check(item.version(), expected);

        Map<String, Object> before = new LinkedHashMap<>();
        Map<String, Object> after = new LinkedHashMap<>();
        String title = item.title();
        String description = item.description();
        String criteria = item.criteria();
        int criteriaVersion = item.criteriaVersion();
        LocalDate dueOn = item.dueOn();
        String criticality = item.criticality();
        String parentId = item.parentId();
        boolean reviewRequired = jdbc.queryForObject("SELECT review_required FROM work_items WHERE id = ?", Boolean.class,
                item.id());
        if (request.reviewRequired() != null && request.reviewRequired() != reviewRequired) {
            if ("IN_REVIEW".equals(item.state())) {
                throw conflict("INVALID_TRANSITION", "Change the review policy before the work is submitted.");
            }
            change(before, after, "review_required", reviewRequired, request.reviewRequired());
            reviewRequired = request.reviewRequired();
        }

        if (request.title() != null) {
            title = change(before, after, "title", item.title(), title(request.title()));
        }
        if (request.description() != null) {
            String next = text(request.description(), 10_000);
            if (!Objects.equals(next, item.description())) {
                description = next;
                // Free text stays out of the audit row; record only that it changed.
                after.put("description_changed", true);
            }
        }
        if (request.criteria() != null) {
            String next = text(request.criteria(), 10_000);
            if (!Objects.equals(next, item.criteria())) {
                criteria = next;
                criteriaVersion = item.criteriaVersion() + 1; // reviews bind to the criteria version (3.3)
                before.put("criteria_version", item.criteriaVersion());
                after.put("criteria_version", criteriaVersion);
            }
        }
        if (request.dueOn() != null) {
            dueOn = change(before, after, "due_on", item.dueOn(), request.dueOn());
        }
        if (request.criticality() != null) {
            criticality = change(before, after, "criticality", item.criticality(),
                    oneOf("criticality", request.criticality(), CRITICALITY, item.criticality()));
        }
        boolean moving = Boolean.TRUE.equals(request.moveToRoot())
                || (request.parentId() != null && !request.parentId().trim().equals(item.parentId()));
        if (moving) {
            if ("ACTIVE".equals(item.planStatus())) {
                throw scopeChangeRequired("Moving approved work needs an approved scope change.");
            }
            String target = Boolean.TRUE.equals(request.moveToRoot()) ? null : request.parentId().trim();
            parentId = change(before, after, "parent_id", item.parentId(), reparent(caller, item, target));
        }

        int updated = jdbc.update("""
                UPDATE work_items SET title = ?, description = ?, criteria = ?, criteria_version = ?, due_on = ?,
                    due_date = ?, criticality = ?, parent_id = ?, review_required = ?, version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, title, description, criteria, criteriaVersion, sqlDate(dueOn), startOfDay(dueOn, project.timezone()),
                criticality, parentId, reviewRequired, item.id(), caller.orgId(), expected);
        ExpectedVersion.requireUpdated(updated);

        changes.record(
                new ChangeRecorder.AuditEntry(caller.orgId(), caller.userId(), "work_item.updated", "WORK_ITEM",
                        uuidOf(item.id()), null, before, after),
                new ChangeRecorder.DomainEvent(caller.orgId(), "WORK_ITEM", uuidOf(item.id()), expected + 1,
                        "WorkItemUpdated", withProject(after, item.projectId())));
        return response(caller.orgId(), item.id());
    }

    /** Validates a move under {@code target} (null = project root) and returns the new parent id. */
    private String reparent(Caller caller, Item item, String target) {
        lockProject(caller.orgId(), item.projectId());
        Item parent = target == null ? null : parentInProject(caller.orgId(), item.projectId(), target);
        if (parent != null) {
            boolean intoOwnSubtree = Boolean.TRUE.equals(jdbc.queryForObject("""
                    WITH RECURSIVE sub(id, n) AS (
                        SELECT id, 0 FROM work_items WHERE id = ?
                        UNION ALL
                        SELECT w.id, s.n + 1 FROM work_items w JOIN sub s ON w.parent_id = s.id
                        WHERE w.project_id = ? AND s.n < 50)
                    SELECT EXISTS (SELECT 1 FROM sub WHERE id = ?)
                    """, Boolean.class, item.id(), item.projectId(), parent.id()));
            if (intoOwnSubtree) {
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "WORK_ITEM_CYCLE",
                        "Work cannot be moved under itself or its own sub-items.",
                        List.of(new ApiError.FieldError("parent_id", "would create a loop")));
            }
            if ("ACTIVE".equals(parent.planStatus()) && activeChildren(parent.id()) == 0) {
                throw scopeChangeRequired("Splitting approved work needs an approved scope change.");
            }
        }
        checkNesting(parent == null ? "ROOT" : parent.type(), item.type());
        int newDepth = parent == null ? 2 : depthOf(parent.id()) + 1;
        if (newDepth + subtreeHeight(item.projectId(), item.id()) > MAX_DEPTH) throw maxDepth();
        return parent == null ? null : parent.id();
    }

    /* ================================================================== assignment (T20) */

    @Transactional
    public WorkItemResponse assign(Authentication authentication, String workItemId, AssignmentRequest request) {
        Caller caller = caller(authentication);
        Item item = visible(caller, workItemId);
        ProjectService.ProjectResponse project = projects.get(caller.orgId(), item.projectId(), caller.authentication());
        requireOnProject(caller, item.projectId(), PermissionKey.TASK_ASSIGN);
        long expected = expectedVersion(request.expectedVersion());
        if (project.archived()) throw conflict("PROJECT_ARCHIVED", "Archived projects cannot be edited.");
        if ("RETIRED".equals(item.planStatus())) throw conflict("WORK_ITEM_RETIRED", "Retired work cannot be assigned.");
        ExpectedVersion.check(item.version(), expected);

        UUID primary = projectMember(caller.orgId(), item.projectId(), request.primaryAssigneeMembershipId(),
                "primary_assignee_membership_id");
        UUID reviewer = projectMember(caller.orgId(), item.projectId(), request.reviewerMembershipId(),
                "reviewer_membership_id");
        if (primary == null && "ACTIVE".equals(item.planStatus())) {
            throw validation("primary_assignee_membership_id", "approved work needs one primary assignee");
        }
        if (reviewer != null && reviewer.equals(primary)) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "REVIEWER_IS_ASSIGNEE",
                    "The reviewer must be a different person from the primary assignee.",
                    List.of(new ApiError.FieldError("reviewer_membership_id", "is the primary assignee")));
        }
        Set<UUID> collaborators = new LinkedHashSet<>();
        List<UUID> requested = request.collaboratorMembershipIds() == null ? List.of() : request.collaboratorMembershipIds();
        if (requested.size() > 50) throw validation("collaborator_membership_ids", "at most 50 collaborators");
        for (UUID membershipId : requested) {
            UUID userId = projectMember(caller.orgId(), item.projectId(), membershipId, "collaborator_membership_ids");
            if (userId != null && !userId.equals(primary)) collaborators.add(userId);
        }
        String reason = text(request.reason(), 500);

        UUID previousPrimary = parseUuid(item.primaryAssigneeId());
        UUID previousReviewer = parseUuid(item.reviewerId());
        Set<UUID> previousCollaborators = new LinkedHashSet<>(jdbc.queryForList(
                "SELECT user_id FROM work_item_collaborators WHERE work_item_id = ? ORDER BY added_at, user_id",
                UUID.class, item.id()));

        int updated = jdbc.update("""
                UPDATE work_items SET primary_assignee_id = ?, reviewer_id = ?, version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, primary == null ? null : primary.toString(), reviewer == null ? null : reviewer.toString(),
                item.id(), caller.orgId(), expected);
        ExpectedVersion.requireUpdated(updated);

        history(caller, item.id(), "PRIMARY", previousPrimary, primary, reason);
        history(caller, item.id(), "REVIEWER", previousReviewer, reviewer, reason);
        for (UUID removed : previousCollaborators) {
            if (!collaborators.contains(removed)) {
                jdbc.update("DELETE FROM work_item_collaborators WHERE work_item_id = ? AND user_id = ?", item.id(), removed);
                history(caller, item.id(), "COLLABORATOR", removed, null, reason);
            }
        }
        for (UUID added : collaborators) {
            if (!previousCollaborators.contains(added)) {
                jdbc.update("""
                        INSERT INTO work_item_collaborators (org_id, work_item_id, user_id, added_by) VALUES (?, ?, ?, ?)
                        """, caller.orgId(), item.id(), added, caller.userId());
                history(caller, item.id(), "COLLABORATOR", null, added, reason);
            }
        }

        Map<String, Object> before = new LinkedHashMap<>();
        before.put("primary_assignee_id", str(previousPrimary));
        before.put("reviewer_id", str(previousReviewer));
        before.put("collaborators", previousCollaborators.stream().map(UUID::toString).toList());
        Map<String, Object> after = new LinkedHashMap<>();
        after.put("primary_assignee_id", str(primary));
        after.put("reviewer_id", str(reviewer));
        after.put("collaborators", collaborators.stream().map(UUID::toString).toList());
        changes.record(
                new ChangeRecorder.AuditEntry(caller.orgId(), caller.userId(), "work_item.assigned", "WORK_ITEM",
                        uuidOf(item.id()), reason, before, after),
                new ChangeRecorder.DomainEvent(caller.orgId(), "WORK_ITEM", uuidOf(item.id()), expected + 1,
                        "WorkItemAssigned", withProject(after, item.projectId())));
        return response(caller.orgId(), item.id());
    }

    private void history(Caller caller, String workItemId, String role, UUID previous, UUID next, String reason) {
        if (Objects.equals(previous, next)) return;
        jdbc.update("""
                INSERT INTO work_item_assignment_history
                    (id, org_id, work_item_id, assignment_role, previous_user_id, new_user_id, actor_id, reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), caller.orgId(), workItemId, role, previous, next, caller.userId(), reason);
    }

    /* ================================================================== retire (T19) */

    @Transactional
    public WorkItemResponse retire(Authentication authentication, String workItemId, RetireRequest request) {
        Caller caller = caller(authentication);
        Item item = visible(caller, workItemId);
        ProjectService.ProjectResponse project = projects.get(caller.orgId(), item.projectId(), caller.authentication());
        requireOnProject(caller, item.projectId(), PermissionKey.TASK_CREATE);
        long expected = expectedVersion(request.expectedVersion());
        String reason = text(request.reason(), 500);
        if (reason == null) throw validation("reason", "is required");
        if (project.archived()) throw conflict("PROJECT_ARCHIVED", "Archived projects cannot be edited.");
        if ("RETIRED".equals(item.planStatus())) throw conflict("WORK_ITEM_RETIRED", "This work is already retired.");
        if ("ACTIVE".equals(item.planStatus())) {
            throw scopeChangeRequired("Approved work is removed only through an approved scope change.");
        }
        if (activeChildren(item.id()) > 0) {
            throw conflict("HAS_CHILDREN", "Retire or move the sub-items first.");
        }
        DependencyService.requireNoSuccessorLinks(jdbc, item.id()); // task 3.4: treat its links first
        ExpectedVersion.check(item.version(), expected);

        int updated = jdbc.update("""
                UPDATE work_items SET plan_status = 'RETIRED', retired_at = now(), retired_reason = ?,
                    version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, reason, item.id(), caller.orgId(), expected);
        ExpectedVersion.requireUpdated(updated);
        changes.record(
                new ChangeRecorder.AuditEntry(caller.orgId(), caller.userId(), "work_item.retired", "WORK_ITEM",
                        uuidOf(item.id()), reason, Map.of("plan_status", item.planStatus()), Map.of("plan_status", "RETIRED")),
                new ChangeRecorder.DomainEvent(caller.orgId(), "WORK_ITEM", uuidOf(item.id()), expected + 1,
                        "WorkItemRetired", withProject(Map.of("key", item.key()), item.projectId())));
        return response(caller.orgId(), item.id());
    }

    /* ================================================================== access */

    record Caller(UUID orgId, UUID userId, Authentication authentication, AuthPrincipal principal) {}

    Caller caller(Authentication authentication) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        AuthPrincipal principal = permissions.principal(authentication);
        return new Caller(orgId, principal.userId(), authentication, principal);
    }

    /** The project exists in the caller's organization and is readable (task 2.1 rule); else 404 + evidence. */
    ProjectService.ProjectResponse readableProject(Caller caller, String projectId) {
        return projects.get(caller.orgId(), projectId, caller.authentication());
    }

    /** Whether the caller can read the project, without writing security evidence. */
    boolean readableQuietly(Caller caller, String projectId) {
        return projects.readable(caller.orgId(), projectId, caller.authentication());
    }

    /** The work item exists in the caller's organization and its project is readable; else 404 + evidence. */
    Item visible(Caller caller, String workItemId) {
        Item item = workItemId == null ? null : find(caller.orgId(), workItemId);
        if (item == null) {
            evidence.recordDenied(caller.principal(), SecurityEvidenceService.ACCESS_DENIED, "WORK_ITEM",
                    workItemId == null ? null : workItemId.substring(0, Math.min(workItemId.length(), 100)),
                    "Foreign, unknown or unreadable work item");
            throw PermissionService.notFound();
        }
        readableProject(caller, item.projectId());
        return item;
    }

    boolean can(Caller caller, String projectId, PermissionKey key) {
        return permissions.canOnProject(caller.authentication(), caller.orgId(), projectId, key.value());
    }

    private void requireOnProject(Caller caller, String projectId, PermissionKey key) {
        if (!can(caller, projectId, key)) throw PermissionService.forbidden();
    }

    private static void requireWritableStructured(ProjectService.ProjectResponse project) {
        if (project.archived()) throw conflict("PROJECT_ARCHIVED", "Archived projects cannot be edited.");
        if (!"STRUCTURED".equals(project.mode())) {
            throw conflict("PROJECT_NOT_STRUCTURED", "Only Structured projects have a work breakdown.");
        }
    }

    /**
     * The person behind {@code membershipId} as a user id, when the membership is ACTIVE in this organization and the
     * person works on the project (member, project manager, accountable developer or lead of the project's team).
     * Unknown, foreign, inactive and unrelated memberships all give the same answer.
     */
    UUID projectMember(UUID orgId, String projectId, UUID membershipId, String field) {
        if (membershipId == null) return null;
        List<UUID> users = jdbc.queryForList("""
                SELECT m.user_id FROM memberships m JOIN projects p ON p.id = ? AND p.org_id = m.org_id
                WHERE m.id = ? AND m.org_id = ? AND m.status = 'ACTIVE'
                  AND (p.project_manager_membership_id = m.id OR p.accountable_membership_id = m.id
                       OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.org_id = p.org_id
                                  AND pm.membership_id = m.id)
                       OR EXISTS (SELECT 1 FROM teams t WHERE t.id = p.team_id AND t.org_id = p.org_id
                                  AND t.lead_membership_id = m.id))
                """, UUID.class, projectId, membershipId, orgId);
        if (users.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "NOT_PROJECT_MEMBER",
                    "Only active members of this project can be assigned.",
                    List.of(new ApiError.FieldError(field, "is not an active member of this project")));
        }
        return users.get(0);
    }

    /* ================================================================== hierarchy */

    private void lockProject(UUID orgId, String projectId) {
        jdbc.queryForList("SELECT id FROM projects WHERE id = ? AND org_id = ? FOR UPDATE", projectId, orgId);
    }

    private Item parentInProject(UUID orgId, String projectId, String parentId) {
        Item parent = find(orgId, parentId);
        if (parent == null || !parent.projectId().equals(projectId) || "RETIRED".equals(parent.planStatus())) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_PARENT",
                    "The parent must be active work in the same project.",
                    List.of(new ApiError.FieldError("parent_id", "is not active work in this project")));
        }
        return parent;
    }

    private static void checkNesting(String parentType, String childType) {
        if (!CHILD_TYPES.getOrDefault(parentType, Set.of()).contains(childType)) {
            String where = "ROOT".equals(parentType) ? "directly in the project" : "under a " + parentType.toLowerCase(Locale.ROOT);
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_HIERARCHY",
                    "A " + childType.toLowerCase(Locale.ROOT) + " cannot be placed " + where + ".",
                    List.of(new ApiError.FieldError("type", "is not allowed at this level")));
        }
    }

    /** Depth of an item counting the project as level 1. */
    private int depthOf(String itemId) {
        Integer chain = jdbc.queryForObject("""
                WITH RECURSIVE chain(id, parent_id, n) AS (
                    SELECT id, parent_id, 1 FROM work_items WHERE id = ?
                    UNION ALL
                    SELECT w.id, w.parent_id, c.n + 1 FROM work_items w JOIN chain c ON w.id = c.parent_id WHERE c.n < 50)
                SELECT max(n) FROM chain
                """, Integer.class, itemId);
        return 1 + (chain == null ? 0 : chain);
    }

    /** Levels below the item (0 for a leaf). */
    private int subtreeHeight(String projectId, String itemId) {
        Integer height = jdbc.queryForObject("""
                WITH RECURSIVE sub(id, n) AS (
                    SELECT id, 0 FROM work_items WHERE id = ?
                    UNION ALL
                    SELECT w.id, s.n + 1 FROM work_items w JOIN sub s ON w.parent_id = s.id
                    WHERE w.project_id = ? AND s.n < 50)
                SELECT max(n) FROM sub
                """, Integer.class, itemId, projectId);
        return height == null ? 0 : height;
    }

    private int activeChildren(String itemId) {
        Integer count = jdbc.queryForObject(
                "SELECT count(*) FROM work_items WHERE parent_id = ? AND plan_status <> 'RETIRED'", Integer.class, itemId);
        return count == null ? 0 : count;
    }

    /* ================================================================== mapping */

    record Item(String id, String projectId, String parentId, String type, String key, String title, String description,
            String state, String planStatus, String criteria, int criteriaVersion, LocalDate dueOn, String criticality,
            String primaryAssigneeId, String reviewerId, long version) {}

    Item find(UUID orgId, String id) {
        List<Item> rows = jdbc.query("""
                SELECT id, project_id, parent_id, type, key, title, description, state, plan_status, criteria,
                       criteria_version, due_on, criticality, primary_assignee_id, reviewer_id, version
                FROM work_items WHERE id = ? AND org_id = ?
                """, (rs, n) -> new Item(rs.getString("id"), rs.getString("project_id"), rs.getString("parent_id"),
                        rs.getString("type"), rs.getString("key"), rs.getString("title"), rs.getString("description"),
                        rs.getString("state"), rs.getString("plan_status"), rs.getString("criteria"),
                        rs.getInt("criteria_version"), localDate(rs, "due_on"), rs.getString("criticality"),
                        rs.getString("primary_assignee_id"), rs.getString("reviewer_id"), rs.getLong("version")),
                id, orgId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    WorkItemResponse response(UUID orgId, String id) {
        WorkItemResponse base = jdbc.queryForObject("""
                SELECT w.id, w.project_id, w.parent_id, w.type, w.key, w.title, w.description, w.state, w.plan_status,
                       w.is_blocked, w.criticality, w.criteria, w.criteria_version, w.weight, w.weight_unit, w.due_on,
                       w.current_revision, w.submitted_revision, w.accepted_revision, w.review_required, w.dependency_flag, w.retired_reason, w.version, w.created_at, w.updated_at,
                       w.primary_assignee_id, pu.email AS primary_email, w.reviewer_id, ru.email AS reviewer_email,
                       (SELECT count(*) FROM work_items c WHERE c.parent_id = w.id AND c.plan_status <> 'RETIRED') AS children
                FROM work_items w
                LEFT JOIN users pu ON CAST(pu.id AS text) = w.primary_assignee_id
                LEFT JOIN users ru ON CAST(ru.id AS text) = w.reviewer_id
                WHERE w.id = ? AND w.org_id = ?
                """, (rs, n) -> new WorkItemResponse(rs.getString("id"), rs.getString("project_id"),
                        rs.getString("parent_id"), rs.getString("type"), rs.getString("key"), rs.getString("title"),
                        rs.getString("description"), rs.getString("state"), rs.getString("plan_status"),
                        rs.getBoolean("is_blocked"), rs.getString("criticality"), rs.getString("criteria"),
                        rs.getInt("criteria_version"), rs.getBigDecimal("weight"), rs.getString("weight_unit"),
                        localDate(rs, "due_on"), rs.getInt("current_revision"), (Integer) rs.getObject("submitted_revision"),
                        (Integer) rs.getObject("accepted_revision"), rs.getBoolean("review_required"),
                        person(rs.getString("primary_assignee_id"), rs.getString("primary_email")),
                        person(rs.getString("reviewer_id"), rs.getString("reviewer_email")), List.of(),
                        0, rs.getInt("children"), rs.getString("dependency_flag"), rs.getString("retired_reason"), rs.getLong("version"),
                        instant(rs, "created_at"), instant(rs, "updated_at")), id, orgId);
        List<PersonSummary> collaborators = jdbc.query("""
                SELECT c.user_id, u.email FROM work_item_collaborators c JOIN users u ON u.id = c.user_id
                WHERE c.work_item_id = ? AND c.org_id = ? ORDER BY c.added_at, c.user_id
                """, (rs, n) -> new PersonSummary(rs.getObject("user_id", UUID.class).toString(), rs.getString("email")),
                id, orgId);
        return base.with(collaborators, depthOf(id));
    }

    private static PersonSummary person(String userId, String email) {
        return userId == null ? null : new PersonSummary(userId, email);
    }

    /* ================================================================== small helpers */

    /** Work item ids are text (legacy ids are not UUIDs); audit/outbox need a UUID: the id itself or a stable hash. */
    static UUID uuidOf(String id) {
        UUID parsed = parseUuid(id);
        return parsed != null ? parsed : UUID.nameUUIDFromBytes(("work_item:" + id).getBytes(StandardCharsets.UTF_8));
    }

    static UUID parseUuid(String value) {
        if (value == null) return null;
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException notAUuid) {
            return null;
        }
    }

    private static Map<String, Object> withProject(Map<String, ?> data, String projectId) {
        Map<String, Object> payload = new LinkedHashMap<>(data);
        payload.put("project_id", projectId);
        return payload;
    }

    private static <T> T change(Map<String, Object> before, Map<String, Object> after, String field, T previous, T next) {
        if (!Objects.equals(previous, next)) {
            before.put(field, previous == null ? null : previous.toString());
            after.put(field, next == null ? null : next.toString());
        }
        return next;
    }

    private static long expectedVersion(Long value) {
        if (value == null) throw validation("expected_version", "is required");
        return value;
    }

    private static String title(String value) {
        String title = value == null ? "" : value.trim();
        if (title.isEmpty() || title.length() > 255) throw validation("title", "is required (1 to 255 characters)");
        return title;
    }

    private static String text(String value, int max) {
        if (value == null) return null;
        String trimmed = value.trim();
        if (trimmed.isEmpty()) return null;
        if (trimmed.length() > max) throw validation("text", "is longer than " + max + " characters");
        return trimmed;
    }

    private static String oneOf(String field, String value, Set<String> allowed, String fallback) {
        if (value == null || value.isBlank()) return fallback;
        String upper = value.trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(upper)) throw validation(field, "must be one of " + allowed);
        return upper;
    }

    private static String upper(String value) {
        return value == null ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static String str(UUID value) {
        return value == null ? null : value.toString();
    }

    private static Date sqlDate(LocalDate date) {
        return date == null ? null : Date.valueOf(date);
    }

    /** Legacy timestamp column: start of the local day in the project zone (no 24h arithmetic, rule 8). */
    private static Timestamp startOfDay(LocalDate date, String timezone) {
        if (date == null) return null;
        ZoneId zone = timezone == null ? ZoneId.of("UTC") : ZoneId.of(timezone);
        return Timestamp.from(date.atStartOfDay(zone).toInstant());
    }

    private static LocalDate localDate(ResultSet rs, String column) throws SQLException {
        Date value = rs.getDate(column);
        return value == null ? null : value.toLocalDate();
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The request has invalid fields.",
                List.of(new ApiError.FieldError(field, message)));
    }

    static ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }

    static ApiException scopeChangeRequired(String message) {
        return conflict("SCOPE_CHANGE_REQUIRED", message);
    }

    private static ApiException maxDepth() {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "MAX_DEPTH_EXCEEDED",
                "Work can be nested at most " + MAX_DEPTH + " levels deep, counting the project.",
                List.of(new ApiError.FieldError("parent_id", "is too deep")));
    }

    /* ================================================================== API records */

    public record CreateWorkItemRequest(String type, String parentId, String title, String description, String criteria,
            LocalDate dueOn, String criticality) {}

    /** Absent fields stay unchanged. {@code moveToRoot} moves the item directly under the project. */
    public record UpdateWorkItemRequest(String title, String description, String criteria, LocalDate dueOn,
            String criticality, String parentId, Boolean moveToRoot, Boolean reviewRequired, BigDecimal weight,
            Long expectedVersion) {}

    public record AssignmentRequest(UUID primaryAssigneeMembershipId, UUID reviewerMembershipId,
            List<UUID> collaboratorMembershipIds, String reason, Long expectedVersion) {}

    public record RetireRequest(String reason, Long expectedVersion) {}

    public record PersonSummary(String userId, String email) {}

    public record AssignmentChange(String assignmentRole, UUID previousUserId, UUID newUserId, UUID actorId,
            String reason, Instant occurredAt) {}

    public record WorkItemResponse(String id, String projectId, String parentId, String type, String key, String title,
            String description, String state, String planStatus, boolean blocked, String criticality, String criteria,
            int criteriaVersion, BigDecimal weight, String weightUnit, LocalDate dueOn, int revision,
            Integer submittedRevision, Integer acceptedRevision, boolean reviewRequired, PersonSummary primaryAssignee, PersonSummary reviewer,
            List<PersonSummary> collaborators, int depth, int childCount, String dependencyFlag, String retiredReason, long version,
            Instant createdAt, Instant updatedAt) {

        WorkItemResponse with(List<PersonSummary> people, int itemDepth) {
            return new WorkItemResponse(id, projectId, parentId, type, key, title, description, state, planStatus, blocked,
                    criticality, criteria, criteriaVersion, weight, weightUnit, dueOn, revision, submittedRevision,
                    acceptedRevision, reviewRequired, primaryAssignee, reviewer, people, itemDepth, childCount, dependencyFlag, retiredReason, version, createdAt,
                    updatedAt);
        }
    }
}
