package com.prowise.work;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

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
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.domain.WorkBreakdown;
import com.prowise.domain.WorkBreakdown.Level;
import com.prowise.project.ProjectService;
import com.prowise.project.ProjectService.ProjectResponse;
import com.prowise.work.WorkDTOs.AddWorkItemRequest;
import com.prowise.work.WorkDTOs.AssignableItem;
import com.prowise.work.WorkDTOs.AssignmentChange;
import com.prowise.work.WorkDTOs.AssignmentRequest;
import com.prowise.work.WorkDTOs.ConfiguredProject;
import com.prowise.work.WorkDTOs.ConfiguredProjectRequest;
import com.prowise.work.WorkDTOs.PersonRef;
import com.prowise.work.WorkDTOs.SetupPhase;
import com.prowise.work.WorkDTOs.SetupTask;
import com.prowise.work.WorkDTOs.UpdateWorkItemRequest;
import com.prowise.work.WorkDTOs.WorkItem;

/**
 * Task 3.1: work breakdown and assignment for Structured projects.
 *
 * <ul>
 *   <li>Create Project setup: a Structured project is created together with its documents (at least one), phases
 *       (at least one) and tasks with points and a reviewer (at least one), in one transaction with audit and outbox.</li>
 *   <li>Breakdown: phase (milestone) / deliverable / task / subtask, at most 5 levels, no cycles, parents only inside
 *       the same project. Leaves carry points; a parent never does.</li>
 *   <li>Assignment: one primary assignee, a reviewer, optional collaborators, by the project's PM or the lead of the
 *       project's team (task.assign). Reassignment keeps the previous assignment in an append-only history.</li>
 *   <li>Changing points, removing a planned task or splitting a task with points changes the scope: until task 3.2
 *       provides scope approval these answer 409 SCOPE_CHANGE_REQUIRED.</li>
 *   <li>Project read rule of task 2.1 everywhere (unreadable or foreign = 404); organization from the path + token.</li>
 * </ul>
 */
@Service
public class WorkService {

    private static final String UNIT = "pts";

    private final JdbcTemplate jdbc;
    private final ProjectService projects;
    private final PermissionService permissions;
    private final ChangeRecorder changes;
    private final StructuredProgressService progress;

    public WorkService(JdbcTemplate jdbc, ProjectService projects, PermissionService permissions, ChangeRecorder changes,
            StructuredProgressService progress) {
        this.progress = progress;
        this.jdbc = jdbc;
        this.projects = projects;
        this.permissions = permissions;
        this.changes = changes;
    }

    /* ================================================================== Create Project setup */

    @Transactional
    public ConfiguredProject createConfigured(UUID orgId, Authentication auth, ConfiguredProjectRequest request) {
        UUID userId = permissions.principal(auth).userId();
        if (request == null || request.project() == null) throw validation("project", "is required");
        if (!"STRUCTURED".equals(request.project().mode())) {
            throw validation("project.mode", "The setup steps are for Structured projects.");
        }
        List<String> documentIds = request.documentIds() == null ? List.of() : request.documentIds().stream().distinct().toList();
        if (documentIds.isEmpty()) throw validation("document_ids", "Upload at least one document.");
        List<SetupPhase> phases = request.phases() == null ? List.of() : request.phases();
        if (phases.isEmpty()) throw validation("phases", "Add at least one phase.");
        int taskCount = 0;
        for (int p = 0; p < phases.size(); p++) {
            SetupPhase phase = phases.get(p);
            required("phases[" + p + "].title", phase == null ? null : phase.title(), 200);
            for (int t = 0; phase.tasks() != null && t < phase.tasks().size(); t++) {
                SetupTask task = phase.tasks().get(t);
                String field = "phases[" + p + "].tasks[" + t + "]";
                required(field + ".title", task == null ? null : task.title(), 200);
                if (!WorkBreakdown.validPoints(Level.TASK, task.points())) throw validation(field + ".points", "Enter points greater than 0.");
                if (task.reviewerMembershipId() == null) throw validation(field + ".reviewer_membership_id", "Choose a reviewer.");
                activeMember(orgId, task.reviewerMembershipId(), field + ".reviewer_membership_id");
                taskCount++;
            }
        }
        if (taskCount == 0) throw validation("phases", "Add at least one task with points.");
        for (String documentId : documentIds) {
            Integer draft = jdbc.queryForObject("""
                    SELECT count(*) FROM file_metadata
                    WHERE id = ? AND org_id = ? AND project_id IS NULL AND uploaded_by_user = ? AND content IS NOT NULL
                    """, Integer.class, documentId, orgId, userId);
            if (draft == null || draft != 1) throw validation("document_ids", "A document was not found. Upload it again.");
        }

        ProjectResponse project = projects.create(orgId, auth, request.project());
        lockProject(orgId, project.id());
        int sequence = 0;
        int phasePosition = 0;
        Map<String, BigDecimal> leaves = new LinkedHashMap<>();
        for (SetupPhase phase : phases) {
            String phaseId = insertItem(orgId, project, null, Level.MILESTONE, phase.title().trim(), null, BigDecimal.ZERO,
                    null, null, ++sequence, phasePosition++, userId);
            int taskPosition = 0;
            for (SetupTask task : phase.tasks() == null ? List.<SetupTask>of() : phase.tasks()) {
                Member reviewer = activeMember(orgId, task.reviewerMembershipId(), "reviewer_membership_id");
                String taskId = insertItem(orgId, project, phaseId, Level.TASK, task.title().trim(), null,
                        task.points().setScale(2), null, reviewer, ++sequence, taskPosition++, userId);
                ensureProjectMember(orgId, project.id(), reviewer.id(), userId);
                leaves.put(taskId, task.points().setScale(2));
                jdbc.update("""
                        INSERT INTO work_item_assignments (id, org_id, work_item_id, new_reviewer_membership_id, reason, actor_id)
                        VALUES (?, ?, ?, ?, 'Project setup', ?)
                        """, UUID.randomUUID(), orgId, taskId, reviewer.id(), userId);
            }
        }
        // Task 3.2: the setup tasks are version 1 of the scope; approved now when the creator may approve scope.
        boolean approveScope = permissions.canOnProject(auth, orgId, project.id(), PermissionKey.PROJECT_SCOPE_CHANGE.value());
        ScopeService.createInitialBaseline(jdbc, orgId, project.id(), userId, approveScope, leaves);
        if (approveScope) progress.snapshot(orgId, project.id(), "SCOPE_APPROVED", null);
        for (String documentId : documentIds) {
            jdbc.update("UPDATE file_metadata SET project_id = ? WHERE id = ? AND org_id = ? AND project_id IS NULL",
                    project.id(), documentId, orgId);
        }

        List<WorkItem> items = items(orgId, project.id());
        Map<String, Object> next = new LinkedHashMap<>();
        next.put("phases", phases.size());
        next.put("tasks", taskCount);
        next.put("total_points", items.stream().filter(WorkItem::leaf).map(WorkItem::points).reduce(BigDecimal.ZERO, BigDecimal::add));
        next.put("documents", documentIds.size());
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, userId, "project.breakdown_created", "PROJECT", UUID.fromString(project.id()),
                        null, null, next),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(project.id()), project.version(),
                        "ProjectBreakdownCreated", next));
        List<WorkDTOs.Document> linked = jdbc.query("""
                SELECT f.id, f.project_id, f.file_name, f.file_size, f.file_type, u.email, f.created_at
                FROM file_metadata f LEFT JOIN users u ON u.id = f.uploaded_by_user
                WHERE f.org_id = ? AND f.project_id = ? ORDER BY f.created_at, f.id
                """, (rs, n) -> new WorkDTOs.Document(rs.getString("id"), rs.getString("project_id"), rs.getString("file_name"),
                rs.getLong("file_size"), rs.getString("file_type"), rs.getString("email"), rs.getTimestamp("created_at").toInstant()),
                orgId, project.id());
        return new ConfiguredProject(project, items, linked);
    }

    /* ================================================================== breakdown */

    @Transactional(readOnly = true)
    public List<WorkItem> list(UUID orgId, String projectId, Authentication auth) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        return items(orgId, project.id());
    }

    @Transactional
    public WorkItem add(UUID orgId, String projectId, Authentication auth, AddWorkItemRequest request) {
        ProjectResponse project = editableStructured(orgId, projectId, auth);
        UUID userId = permissions.principal(auth).userId();
        Level level = level(request.type());
        String title = required("title", request.title(), 200);
        lockProject(orgId, project.id());
        Map<String, ItemRow> rows = rows(orgId, project.id());
        ItemRow parent = null;
        if (request.parentId() != null && !request.parentId().isBlank()) {
            parent = rows.get(request.parentId());
            if (parent == null) throw validation("parent_id", "The parent is not part of this project.");
        }
        placement(level, parent);
        if (WorkBreakdown.tooDeep(WorkBreakdown.depthUnder(parent == null ? null : parent.id(), parentMap(rows)))) {
            throw validation("parent_id", "Work can be at most five levels deep, including the project.");
        }
        if (parent != null && isLeafWithPoints(parent, rows)) throw scopeChange("Splitting a task that has points");
        if (WorkBreakdown.measurable(level) && hasScope(orgId, project.id())) throw scopeChange("Adding a task");
        BigDecimal points = WorkBreakdown.measurable(level) ? request.points() : BigDecimal.ZERO;
        if (!WorkBreakdown.validPoints(level, points)) throw validation("points", "Enter points greater than 0.");
        UUID typeId = workType(orgId, request.workTypeId());
        Member reviewer = request.reviewerMembershipId() == null ? null
                : activeMember(orgId, request.reviewerMembershipId(), "reviewer_membership_id");
        if (reviewer != null && !WorkBreakdown.measurable(level)) throw validation("reviewer_membership_id", "Only tasks and subtasks have a reviewer.");
        final String parentKey = parent == null ? null : parent.id();
        int position = (int) rows.values().stream().filter(r -> Objects.equals(r.parentId(), parentKey)).count();
        String id = insertItem(orgId, project, parent == null ? null : parent.id(), level, title,
                optional("description", request.description(), 5000), points.setScale(2), typeId, reviewer,
                nextSequence(orgId, project.id()), position, userId);
        if (reviewer != null) ensureProjectMember(orgId, project.id(), reviewer.id(), userId);
        WorkItem created = item(orgId, project.id(), id);
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, userId, "work_item.created", "WORK_ITEM", UUID.fromString(id), null, null,
                        snapshot(created)),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(project.id()), project.version(),
                        "WorkItemCreated", snapshot(created)));
        return created;
    }

    @Transactional
    public WorkItem update(UUID orgId, String projectId, String itemId, Authentication auth, UpdateWorkItemRequest request) {
        ProjectResponse project = editableStructured(orgId, projectId, auth);
        UUID userId = permissions.principal(auth).userId();
        if (request.expectedVersion() == null) throw validation("expected_version", "is required");
        lockProject(orgId, project.id());
        Map<String, ItemRow> rows = rows(orgId, project.id());
        ItemRow row = rows.get(itemId);
        if (row == null) throw PermissionService.notFound();
        ExpectedVersion.check(row.version(), request.expectedVersion());
        WorkItem before = item(orgId, project.id(), itemId);
        if (request.points() != null && request.points().compareTo(row.points()) != 0) throw scopeChange("Changing points");

        String parentId = row.parentId();
        boolean moving = Boolean.TRUE.equals(request.moveToProjectRoot())
                || (request.parentId() != null && !request.parentId().equals(row.parentId()));
        if (moving) {
            ItemRow parent = null;
            if (!Boolean.TRUE.equals(request.moveToProjectRoot())) {
                parent = rows.get(request.parentId());
                if (parent == null) throw validation("parent_id", "The parent is not part of this project.");
            }
            placement(row.level(), parent);
            Map<String, String> parentOf = parentMap(rows);
            if (parent != null && WorkBreakdown.createsCycle(itemId, parent.id(), parentOf)) {
                throw validation("parent_id", "An item cannot be moved under itself or its own children.");
            }
            int subtree = subtreeHeight(itemId, rows);
            if (WorkBreakdown.tooDeep(WorkBreakdown.depthUnder(parent == null ? null : parent.id(), parentOf) + subtree - 1)) {
                throw validation("parent_id", "Work can be at most five levels deep, including the project.");
            }
            if (parent != null && isLeafWithPoints(parent, rows)) throw scopeChange("Splitting a task that has points");
            parentId = parent == null ? null : parent.id();
        }
        String title = request.title() == null ? row.title() : required("title", request.title(), 200);
        String description = request.description() == null ? before.description() : optional("description", request.description(), 5000);
        UUID typeId = request.workTypeId() == null ? before.workTypeId() : workType(orgId, request.workTypeId());
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE work_items SET title = ?, description = ?, work_type_id = ?, parent_id = ?, version = version + 1,
                    updated_at = now()
                WHERE id = ? AND org_id = ? AND project_id = ? AND version = ?
                """, title, description, typeId, parentId, itemId, orgId, project.id(), request.expectedVersion()));
        WorkItem after = item(orgId, project.id(), itemId);
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, userId, "work_item.updated", "WORK_ITEM", UUID.fromString(itemId), null,
                        snapshot(before), snapshot(after)),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(project.id()), project.version(),
                        "WorkItemUpdated", snapshot(after)));
        return after;
    }

    @Transactional
    public WorkItem retire(UUID orgId, String projectId, String itemId, Authentication auth, Long expectedVersion) {
        ProjectResponse project = editableStructured(orgId, projectId, auth);
        UUID userId = permissions.principal(auth).userId();
        if (expectedVersion == null) throw validation("expected_version", "is required");
        lockProject(orgId, project.id());
        Map<String, ItemRow> rows = rows(orgId, project.id());
        ItemRow row = rows.get(itemId);
        if (row == null) throw PermissionService.notFound();
        ExpectedVersion.check(row.version(), expectedVersion);
        if (rows.values().stream().anyMatch(r -> itemId.equals(r.parentId()))) {
            throw new ApiException(HttpStatus.CONFLICT, "HAS_CHILDREN", "Remove or move the items under it first.");
        }
        if (WorkBreakdown.measurable(row.level()) && row.points().signum() > 0) throw scopeChange("Removing a planned task");
        DependencyService.requireNoLinks(jdbc, orgId, itemId, row.key()); // task 3.4: explicit treatment of its links first
        WorkItem before = item(orgId, project.id(), itemId);
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE work_items SET retired_at = now(), version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, itemId, orgId, expectedVersion));
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, userId, "work_item.retired", "WORK_ITEM", UUID.fromString(itemId), null,
                        snapshot(before), Map.of("retired", true)),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(project.id()), project.version(),
                        "WorkItemRetired", Map.of("work_item_id", itemId)));
        return before;
    }

    /* ================================================================== assignment (T20) */

    @Transactional
    public WorkItem assign(UUID orgId, String projectId, String itemId, Authentication auth, AssignmentRequest request) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        UUID userId = permissions.principal(auth).userId();
        UUID membershipId = permissions.requireMembership(auth, orgId);
        if (!"STRUCTURED".equals(project.mode())) throw conflict("PROJECT_NOT_STRUCTURED", "Only Structured projects have tasks.");
        if (project.archived()) throw conflict("PROJECT_ARCHIVED", "Archived projects are read-only.");
        if (!mayAssign(orgId, auth, project, membershipId)) throw PermissionService.forbidden();
        if (request.expectedVersion() == null) throw validation("expected_version", "is required");
        lockProject(orgId, project.id());
        Map<String, ItemRow> rows = rows(orgId, project.id());
        ItemRow row = rows.get(itemId);
        if (row == null) throw PermissionService.notFound();
        if (!isLeaf(row, rows)) throw conflict("NOT_A_LEAF", "Only tasks and subtasks without children are assigned.");
        ExpectedVersion.check(row.version(), request.expectedVersion());
        if (request.assigneeMembershipId() == null) throw validation("assignee_membership_id", "Choose the developer.");
        Member assignee = activeMember(orgId, request.assigneeMembershipId(), "assignee_membership_id");
        if (project.teamId() != null && !inTeam(orgId, project.teamId(), assignee.id())) {
            throw validation("assignee_membership_id", "Choose a member of the project's team.");
        }
        UUID reviewerId = request.reviewerMembershipId() != null ? request.reviewerMembershipId() : row.reviewer();
        Member reviewer = reviewerId == null ? null : activeMember(orgId, reviewerId, "reviewer_membership_id");
        List<UUID> collaborators = request.collaboratorMembershipIds() == null ? List.of()
                : request.collaboratorMembershipIds().stream().distinct().filter(id -> !id.equals(assignee.id())).toList();
        for (UUID collaborator : collaborators) activeMember(orgId, collaborator, "collaborator_membership_ids");
        String reason = optional("reason", request.reason(), 500);

        WorkItem before = item(orgId, project.id(), itemId);
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE work_items SET assignee_membership_id = ?, reviewer_membership_id = ?, primary_assignee_id = ?,
                    reviewer_id = ?, version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, assignee.id(), reviewer == null ? null : reviewer.id(), assignee.userId().toString(),
                reviewer == null ? null : reviewer.userId().toString(), itemId, orgId, request.expectedVersion()));
        jdbc.update("DELETE FROM work_item_collaborators WHERE work_item_id = ? AND org_id = ?", itemId, orgId);
        for (UUID collaborator : collaborators) {
            jdbc.update("INSERT INTO work_item_collaborators (org_id, work_item_id, membership_id, added_by) VALUES (?, ?, ?, ?)",
                    orgId, itemId, collaborator, userId);
            ensureProjectMember(orgId, project.id(), collaborator, userId);
        }
        jdbc.update("""
                INSERT INTO work_item_assignments (id, org_id, work_item_id, previous_assignee_membership_id,
                    new_assignee_membership_id, previous_reviewer_membership_id, new_reviewer_membership_id, reason, actor_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), orgId, itemId, row.assignee(), assignee.id(), row.reviewer(),
                reviewer == null ? null : reviewer.id(), reason, userId);
        // The assignee (and reviewer) must be able to open the project (task 2.1 read rule: assigned work).
        ensureProjectMember(orgId, project.id(), assignee.id(), userId);
        if (reviewer != null) ensureProjectMember(orgId, project.id(), reviewer.id(), userId);

        WorkItem after = item(orgId, project.id(), itemId);
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, userId, "work_item.assigned", "WORK_ITEM", UUID.fromString(itemId), reason,
                        snapshot(before), snapshot(after)),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(project.id()), project.version(),
                        "WorkItemAssigned", snapshot(after)));
        return after;
    }

    @Transactional(readOnly = true)
    public List<AssignmentChange> assignmentHistory(UUID orgId, String projectId, String itemId, Authentication auth) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        if (!rows(orgId, project.id()).containsKey(itemId)) throw PermissionService.notFound();
        return jdbc.query("""
                SELECT a.*, pa.email AS pa_email, na.email AS na_email, pr.email AS pr_email, nr.email AS nr_email,
                       actor.email AS actor_email
                FROM work_item_assignments a
                LEFT JOIN memberships pam ON pam.id = a.previous_assignee_membership_id LEFT JOIN users pa ON pa.id = pam.user_id
                LEFT JOIN memberships nam ON nam.id = a.new_assignee_membership_id LEFT JOIN users na ON na.id = nam.user_id
                LEFT JOIN memberships prm ON prm.id = a.previous_reviewer_membership_id LEFT JOIN users pr ON pr.id = prm.user_id
                LEFT JOIN memberships nrm ON nrm.id = a.new_reviewer_membership_id LEFT JOIN users nr ON nr.id = nrm.user_id
                JOIN users actor ON actor.id = a.actor_id
                WHERE a.org_id = ? AND a.work_item_id = ? ORDER BY a.occurred_at, a.id
                """, (rs, n) -> new AssignmentChange(
                ref(rs, "previous_assignee_membership_id", "pa_email"), ref(rs, "new_assignee_membership_id", "na_email"),
                ref(rs, "previous_reviewer_membership_id", "pr_email"), ref(rs, "new_reviewer_membership_id", "nr_email"),
                rs.getString("reason"), rs.getString("actor_email"), rs.getTimestamp("occurred_at").toInstant()), orgId, itemId);
    }

    /** Leaves of Structured projects the caller may assign (PM of the project, lead of its team, or portfolio). */
    @Transactional(readOnly = true)
    public List<AssignableItem> assignable(UUID orgId, Authentication auth) {
        UUID membershipId = permissions.requireMembership(auth, orgId);
        boolean portfolio = permissions.can(auth, orgId, PermissionKey.PROJECT_CREATE.value());
        List<Map<String, Object>> candidates = jdbc.queryForList("""
                SELECT p.id, p.key, p.name FROM projects p
                LEFT JOIN teams t ON t.id = p.team_id AND t.org_id = p.org_id
                WHERE p.org_id = ? AND p.mode = 'STRUCTURED' AND p.archived = false
                  AND (? OR p.project_manager_membership_id = ? OR t.lead_membership_id = ?)
                ORDER BY lower(p.name), p.id
                """, orgId, portfolio, membershipId, membershipId);
        List<AssignableItem> result = new ArrayList<>();
        for (Map<String, Object> project : candidates) {
            String projectId = (String) project.get("id");
            if (!permissions.canOnProject(auth, orgId, projectId, PermissionKey.TASK_ASSIGN.value())) continue;
            for (WorkItem item : items(orgId, projectId)) {
                if (item.leaf()) result.add(new AssignableItem(projectId, (String) project.get("key"), (String) project.get("name"), item));
            }
        }
        result.sort((a, b) -> Boolean.compare(a.item().assignee() != null, b.item().assignee() != null));
        return result;
    }

    /** People who can be assigned on this project: its team (and lead) when it has one, else active org members. */
    @Transactional(readOnly = true)
    public List<PersonRef> assignees(UUID orgId, String projectId, Authentication auth) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        if (project.teamId() != null) {
            return jdbc.query("""
                    SELECT DISTINCT m.id, u.email FROM memberships m JOIN users u ON u.id = m.user_id
                    WHERE m.org_id = ? AND m.status = 'ACTIVE' AND (
                        m.id IN (SELECT tm.membership_id FROM team_members tm WHERE tm.team_id = ? AND tm.org_id = ?)
                        OR m.id = (SELECT t.lead_membership_id FROM teams t WHERE t.id = ? AND t.org_id = ?))
                    ORDER BY u.email
                    """, (rs, n) -> new PersonRef(rs.getObject("id", UUID.class), rs.getString("email")),
                    orgId, project.teamId(), orgId, project.teamId(), orgId);
        }
        return jdbc.query("""
                SELECT m.id, u.email FROM memberships m JOIN users u ON u.id = m.user_id
                WHERE m.org_id = ? AND m.status = 'ACTIVE' ORDER BY u.email
                """, (rs, n) -> new PersonRef(rs.getObject("id", UUID.class), rs.getString("email")), orgId);
    }

    /* ================================================================== helpers */

    private boolean mayAssign(UUID orgId, Authentication auth, ProjectResponse project, UUID membershipId) {
        if (!permissions.canOnProject(auth, orgId, project.id(), PermissionKey.TASK_ASSIGN.value())) return false;
        if (permissions.can(auth, orgId, PermissionKey.PROJECT_CREATE.value())) return true;
        if (project.projectManager() != null && membershipId.equals(project.projectManager().membershipId())) return true;
        if (project.teamId() == null) return false;
        UUID lead = jdbc.query("SELECT lead_membership_id FROM teams WHERE id = ? AND org_id = ?",
                (rs, n) -> rs.getObject(1, UUID.class), project.teamId(), orgId).stream().findFirst().orElse(null);
        return membershipId.equals(lead);
    }

    ProjectResponse editableStructured(UUID orgId, String projectId, Authentication auth) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        if (!"STRUCTURED".equals(project.mode())) throw conflict("PROJECT_NOT_STRUCTURED", "Only Structured projects have a work breakdown.");
        if (project.archived()) throw conflict("PROJECT_ARCHIVED", "Archived projects are read-only.");
        if (!permissions.canOnProject(auth, orgId, project.id(), PermissionKey.PROJECT_EDIT.value())) throw PermissionService.forbidden();
        return project;
    }

    void lockProject(UUID orgId, String projectId) {
        jdbc.queryForObject("SELECT key FROM projects WHERE id = ? AND org_id = ? FOR UPDATE", String.class, projectId, orgId);
    }

    /** A task proposed by a scope draft: hidden from the breakdown until the draft is approved (task 3.2). */
    String insertProposed(UUID orgId, ProjectResponse project, String parentId, Level level, String title, BigDecimal points,
            UUID userId, UUID draftId) {
        String id = insertItem(orgId, project, parentId, level, title, null, points, null, null, nextSequence(orgId, project.id()),
                Integer.MAX_VALUE / 2, userId);
        jdbc.update("UPDATE work_items SET proposed_scope_version_id = ? WHERE id = ? AND org_id = ?", draftId, id, orgId);
        return id;
    }

    private boolean hasScope(UUID orgId, String projectId) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM scope_versions WHERE org_id = ? AND project_id = ?",
                Integer.class, orgId, projectId);
        return count != null && count > 0;
    }

    private String insertItem(UUID orgId, ProjectResponse project, String parentId, Level level, String title,
            String description, BigDecimal points, UUID typeId, Member reviewer, int sequence, int position, UUID userId) {
        String id = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO work_items (id, project_id, org_id, parent_id, type, key, title, description, weight, weight_unit,
                    work_type_id, reviewer_membership_id, reviewer_id, position, state, created_by, version)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'TODO', ?, 0)
                """, id, project.id(), orgId, parentId, level.name(), project.key() + "-" + sequence, title, description,
                points, UNIT, typeId, reviewer == null ? null : reviewer.id(),
                reviewer == null ? null : reviewer.userId().toString(), position, userId);
        return id;
    }

    record ItemRow(String id, String parentId, Level level, String title, BigDecimal points, UUID assignee,
            UUID reviewer, long version, String key) {}

    /** Active breakdown rows of one project. */
    Map<String, ItemRow> rows(UUID orgId, String projectId) {
        Map<String, ItemRow> rows = new LinkedHashMap<>();
        jdbc.query("""
                SELECT id, parent_id, type, title, weight, assignee_membership_id, reviewer_membership_id, version, key
                FROM work_items WHERE org_id = ? AND project_id = ? AND created_by IS NOT NULL AND retired_at IS NULL
                  AND proposed_scope_version_id IS NULL
                ORDER BY position, key
                """, rs -> {
            rows.put(rs.getString("id"), new ItemRow(rs.getString("id"), rs.getString("parent_id"), Level.valueOf(rs.getString("type")),
                    rs.getString("title"), rs.getBigDecimal("weight"), rs.getObject("assignee_membership_id", UUID.class),
                    rs.getObject("reviewer_membership_id", UUID.class), rs.getLong("version"), rs.getString("key")));
        }, orgId, projectId);
        return rows;
    }

    private static Map<String, String> parentMap(Map<String, ItemRow> rows) {
        Map<String, String> parentOf = new HashMap<>();
        rows.values().forEach(r -> parentOf.put(r.id(), r.parentId()));
        return parentOf;
    }

    private static boolean isLeaf(ItemRow row, Map<String, ItemRow> rows) {
        return WorkBreakdown.measurable(row.level()) && rows.values().stream().noneMatch(r -> row.id().equals(r.parentId()));
    }

    private static boolean isLeafWithPoints(ItemRow row, Map<String, ItemRow> rows) {
        return isLeaf(row, rows) && row.points() != null && row.points().signum() > 0;
    }

    private static int subtreeHeight(String id, Map<String, ItemRow> rows) {
        int max = 0;
        for (ItemRow child : rows.values()) if (id.equals(child.parentId())) max = Math.max(max, subtreeHeight(child.id(), rows));
        return max + 1;
    }

    /** Next stable key number; retired items keep their keys, so they are counted too (caller holds the project lock). */
    private int nextSequence(UUID orgId, String projectId) {
        Integer max = jdbc.queryForObject("""
                SELECT COALESCE(max(CAST(substring(key FROM '-([0-9]+)$') AS integer)), 0)
                FROM work_items WHERE org_id = ? AND project_id = ? AND created_by IS NOT NULL
                """, Integer.class, orgId, projectId);
        return (max == null ? 0 : max) + 1;
    }

    private static void placement(Level level, ItemRow parent) {
        Optional<String> error = WorkBreakdown.placementError(level, parent == null ? null : parent.level());
        if (error.isPresent()) throw validation("parent_id", error.get());
    }

    private static Level level(String type) {
        try {
            return Level.valueOf(type == null ? "" : type.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw validation("type", "Choose MILESTONE (phase), DELIVERABLE, TASK or SUBTASK.");
        }
    }

    private UUID workType(UUID orgId, UUID typeId) {
        if (typeId == null) return null;
        Integer active = jdbc.queryForObject("SELECT count(*) FROM work_types WHERE id = ? AND org_id = ? AND retired_at IS NULL",
                Integer.class, typeId, orgId);
        if (active == null || active != 1) throw validation("work_type_id", "Choose an active work type.");
        return typeId;
    }

    record Member(UUID id, UUID userId) {}

    Member activeMember(UUID orgId, UUID membershipId, String field) {
        List<Member> found = jdbc.query("SELECT id, user_id, status FROM memberships WHERE id = ? AND org_id = ?",
                (rs, n) -> "ACTIVE".equals(rs.getString("status"))
                        ? new Member(rs.getObject("id", UUID.class), rs.getObject("user_id", UUID.class)) : null,
                membershipId, orgId);
        if (found.isEmpty()) throw PermissionService.notFound(); // foreign or unknown membership
        if (found.get(0) == null) throw new ApiException(HttpStatus.CONFLICT, "MEMBER_INACTIVE", "That member is not active.",
                List.of(new ApiError.FieldError(field, "is not active")));
        return found.get(0);
    }

    private boolean inTeam(UUID orgId, UUID teamId, UUID membershipId) {
        Integer count = jdbc.queryForObject("""
                SELECT count(*) FROM teams t WHERE t.id = ? AND t.org_id = ? AND (t.lead_membership_id = ?
                    OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = t.id AND tm.org_id = t.org_id AND tm.membership_id = ?))
                """, Integer.class, teamId, orgId, membershipId, membershipId);
        return count != null && count > 0;
    }

    void ensureProjectMember(UUID orgId, String projectId, UUID membershipId, UUID actorId) {
        jdbc.update("""
                INSERT INTO project_members (org_id, project_id, membership_id, added_by) VALUES (?, ?, ?, ?)
                ON CONFLICT DO NOTHING
                """, orgId, projectId, membershipId, actorId);
    }

    List<WorkItem> items(UUID orgId, String projectId) {
        Map<String, List<PersonRef>> collaborators = new HashMap<>();
        jdbc.query("""
                SELECT c.work_item_id, c.membership_id, u.email FROM work_item_collaborators c
                JOIN memberships m ON m.id = c.membership_id JOIN users u ON u.id = m.user_id
                JOIN work_items w ON w.id = c.work_item_id
                WHERE c.org_id = ? AND w.project_id = ? ORDER BY u.email
                """, rs -> {
            collaborators.computeIfAbsent(rs.getString("work_item_id"), k -> new ArrayList<>())
                    .add(new PersonRef(rs.getObject("membership_id", UUID.class), rs.getString("email")));
        }, orgId, projectId);
        List<WorkItem> items = jdbc.query(ITEM_SELECT + " WHERE w.org_id = ? AND w.project_id = ? AND w.created_by IS NOT NULL"
                + " AND w.retired_at IS NULL AND w.proposed_scope_version_id IS NULL ORDER BY w.position, w.key", (rs, n) -> map(rs, collaborators), orgId, projectId);
        Map<String, Boolean> hasChildren = new HashMap<>();
        items.forEach(i -> { if (i.parentId() != null) hasChildren.put(i.parentId(), true); });
        return treeOrder(items).stream().map(i -> new WorkItem(i.id(), i.key(), i.type(), i.parentId(), i.title(), i.description(),
                i.points(), i.unit(), i.workTypeId(), i.workTypeName(), i.assignee(), i.reviewer(), i.collaborators(), i.state(),
                i.position(), WorkBreakdown.measurable(Level.valueOf(i.type())) && !hasChildren.containsKey(i.id()), i.version(),
                i.createdAt())).toList();
    }

    /** Depth-first tree order: each parent followed by its children (by position, then key number). */
    private static List<WorkItem> treeOrder(List<WorkItem> items) {
        Map<String, List<WorkItem>> children = new HashMap<>();
        java.util.Set<String> ids = new java.util.HashSet<>();
        items.forEach(i -> ids.add(i.id()));
        for (WorkItem item : items) {
            String parent = item.parentId() != null && ids.contains(item.parentId()) ? item.parentId() : "";
            children.computeIfAbsent(parent, k -> new ArrayList<>()).add(item);
        }
        java.util.Comparator<WorkItem> order = java.util.Comparator.comparingInt(WorkItem::position)
                .thenComparingInt(i -> keyNumber(i.key()));
        children.values().forEach(list -> list.sort(order));
        List<WorkItem> ordered = new ArrayList<>();
        java.util.ArrayDeque<WorkItem> stack = new java.util.ArrayDeque<>();
        List<WorkItem> roots = children.getOrDefault("", List.of());
        for (int i = roots.size() - 1; i >= 0; i--) stack.push(roots.get(i));
        while (!stack.isEmpty()) {
            WorkItem next = stack.pop();
            ordered.add(next);
            List<WorkItem> kids = children.getOrDefault(next.id(), List.of());
            for (int i = kids.size() - 1; i >= 0; i--) stack.push(kids.get(i));
        }
        return ordered;
    }

    private static int keyNumber(String key) {
        try {
            return Integer.parseInt(key.substring(key.lastIndexOf('-') + 1));
        } catch (RuntimeException e) {
            return Integer.MAX_VALUE;
        }
    }

    private WorkItem item(UUID orgId, String projectId, String itemId) {
        return items(orgId, projectId).stream().filter(i -> i.id().equals(itemId)).findFirst()
                .orElseThrow(PermissionService::notFound);
    }

    private static final String ITEM_SELECT = """
            SELECT w.id, w.key, w.type, w.parent_id, w.title, w.description, w.weight, w.weight_unit, w.work_type_id,
                   wt.name AS work_type_name, w.assignee_membership_id, au.email AS assignee_email,
                   w.reviewer_membership_id, ru.email AS reviewer_email, w.state, w.position, w.version, w.created_at
            FROM work_items w
            LEFT JOIN work_types wt ON wt.id = w.work_type_id AND wt.org_id = w.org_id
            LEFT JOIN memberships am ON am.id = w.assignee_membership_id LEFT JOIN users au ON au.id = am.user_id
            LEFT JOIN memberships rm ON rm.id = w.reviewer_membership_id LEFT JOIN users ru ON ru.id = rm.user_id
            """;

    private static WorkItem map(ResultSet rs, Map<String, List<PersonRef>> collaborators) throws SQLException {
        String id = rs.getString("id");
        Timestamp created = rs.getTimestamp("created_at");
        return new WorkItem(id, rs.getString("key"), rs.getString("type"), rs.getString("parent_id"), rs.getString("title"),
                rs.getString("description"), rs.getBigDecimal("weight"), rs.getString("weight_unit"),
                rs.getObject("work_type_id", UUID.class), rs.getString("work_type_name"),
                ref(rs, "assignee_membership_id", "assignee_email"), ref(rs, "reviewer_membership_id", "reviewer_email"),
                collaborators.getOrDefault(id, List.of()), rs.getString("state"), rs.getInt("position"), false,
                rs.getLong("version"), created == null ? null : created.toInstant());
    }

    private static PersonRef ref(ResultSet rs, String idColumn, String emailColumn) throws SQLException {
        UUID id = rs.getObject(idColumn, UUID.class);
        return id == null ? null : new PersonRef(id, rs.getString(emailColumn));
    }

    private static Map<String, Object> snapshot(WorkItem item) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("work_item_id", item.id());
        s.put("key", item.key());
        s.put("type", item.type());
        s.put("parent_id", item.parentId());
        s.put("title", item.title());
        s.put("points", item.points());
        s.put("assignee_membership_id", item.assignee() == null ? null : item.assignee().membershipId());
        s.put("reviewer_membership_id", item.reviewer() == null ? null : item.reviewer().membershipId());
        return s;
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

    static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The request has invalid fields.",
                List.of(new ApiError.FieldError(field, message)));
    }

    private static ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }

    /** Scope changes need an approved scope version (task 3.2). */
    private static ApiException scopeChange(String what) {
        return new ApiException(HttpStatus.CONFLICT, "SCOPE_CHANGE_REQUIRED",
                what + " changes the approved scope and needs a scope change approval.");
    }
}
