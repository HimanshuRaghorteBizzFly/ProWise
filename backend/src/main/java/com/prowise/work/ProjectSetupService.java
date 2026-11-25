package com.prowise.work;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.identity.AuthPrincipal;
import com.prowise.project.FilePolicy;
import com.prowise.project.FileService;
import com.prowise.project.ProjectService;

/**
 * Guided project setup (create wizard): basics, documents, phases and tasks (Team), people and approvers, saved in ONE
 * transaction with audit rows and outbox events. Allowed with {@code project.create}. The server re-checks every rule:
 *
 * <ul>
 *   <li>Solo (Individual Ownership): no phases, no tasks, at most one developer. Team (Structured Delivery): phases carry
 *       no points; every task has a title, a phase, whole points 1..100 and an optional dependency on another task;
 *       the total is at most 100 (it may be less). Dependencies may not form a loop.</li>
 *   <li>Start date today or later in the project time zone; end date on or after the start date.</li>
 *   <li>People and approvers: ACTIVE members of this organization only, never Owner or Organization Admin; every role
 *       is optional. A task's assignee must be one of the chosen developers.</li>
 *   <li>The tasks become approved scope version 1 (unit POINTS, the creator approves at setup), so progress =
 *       approved points / total points from the first moment; nothing is reported until something is approved.</li>
 *   <li>Approvers get a PROJECT-scoped task.review grant for this project only ({@link ProjectApprovers}).</li>
 * </ul>
 */
@Service
public class ProjectSetupService {

    private static final int MAX_PHASES = 30;
    private static final int MAX_TASKS = 200;

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;
    private final ProjectService projects;
    private final ProjectApprovers approvers;
    private final FileService files;
    private final StructuredSnapshotService snapshots;
    private final ChangeRecorder changes;
    private final ObjectMapper objectMapper;

    public ProjectSetupService(JdbcTemplate jdbc, PermissionService permissions, ProjectService projects,
            ProjectApprovers approvers, FileService files, StructuredSnapshotService snapshots, ChangeRecorder changes,
            ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.projects = projects;
        this.approvers = approvers;
        this.files = files;
        this.snapshots = snapshots;
        this.changes = changes;
        this.objectMapper = objectMapper;
    }

    /* ================================================================== options */

    @Transactional(readOnly = true)
    public SetupOptions options(UUID orgId, Authentication authentication) {
        permissions.require(authentication, orgId, PermissionKey.PROJECT_CREATE.value());
        String timezone = jdbc.queryForObject("SELECT timezone FROM organizations WHERE id = ?", String.class, orgId);
        List<Person> people = jdbc.query("""
                SELECT m.id AS membership_id, u.id AS user_id, u.name, u.email, m.role_template,
                       (SELECT count(*) FROM work_items w WHERE w.org_id = m.org_id AND w.primary_assignee_id = CAST(u.id AS text)
                          AND w.plan_status = 'ACTIVE' AND w.state IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW')) AS open_tasks,
                       (SELECT count(*) FROM projects p WHERE p.org_id = m.org_id AND p.archived = FALSE
                          AND p.lifecycle IN ('PLANNED', 'ACTIVE', 'ON_HOLD')
                          AND (p.accountable_membership_id = m.id OR p.project_manager_membership_id = m.id
                               OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.membership_id = m.id)))
                          AS active_projects
                FROM memberships m JOIN users u ON u.id = m.user_id
                WHERE m.org_id = ? AND m.status = 'ACTIVE' AND m.role_template NOT IN ('ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN', 'PLATFORM_OPERATOR')
                ORDER BY lower(COALESCE(NULLIF(u.name, ''), u.email)), m.id
                """, (rs, n) -> new Person(rs.getObject("membership_id", UUID.class), rs.getObject("user_id", UUID.class),
                        display(rs.getString("name"), rs.getString("email")), rs.getString("email"),
                        rs.getString("role_template"), rs.getInt("open_tasks"), rs.getInt("active_projects")), orgId);
        return new SetupOptions(timezone, LocalDate.now(ZoneId.of(timezone)), people,
                new Limits(100, FilePolicy.DOCUMENT_MAX_BYTES, FilePolicy.SCREENSHOT_MAX_BYTES, MAX_PHASES, MAX_TASKS));
    }

    /* ================================================================== create */

    @Transactional
    public SetupResult create(UUID orgId, Authentication authentication, SetupRequest request) {
        permissions.require(authentication, orgId, PermissionKey.PROJECT_CREATE.value());
        AuthPrincipal actor = permissions.principal(authentication);
        if (request == null) throw validation("name", "is required");

        boolean team = team(request.mode());
        String timezone = request.timezone() == null || request.timezone().isBlank()
                ? jdbc.queryForObject("SELECT timezone FROM organizations WHERE id = ?", String.class, orgId)
                : request.timezone().trim();
        ZoneId zone;
        try {
            zone = ZoneId.of(timezone);
        } catch (RuntimeException e) {
            throw validation("timezone", "must be an IANA time zone such as Europe/London");
        }
        if (request.startOn() == null) throw validation("start_on", "is required");
        if (request.targetOn() == null) throw validation("target_on", "is required");
        if (request.startOn().isBefore(LocalDate.now(zone))) throw validation("start_on", "must be today or later");
        if (request.targetOn().isBefore(request.startOn())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "The end date is before the start date.",
                    List.of(new ApiError.FieldError("target_on", "must be on or after the start date")));
        }

        // People: active, this organization, never Owner/Admin. Every role is optional.
        UUID teamLead = request.teamLeadMembershipId();
        List<UUID> developers = distinct(request.developerMembershipIds(), "developer_membership_ids", 50);
        List<UUID> qa = distinct(request.qaMembershipIds(), "qa_membership_ids", 50);
        List<UUID> approverIds = distinct(request.approverMembershipIds(), "approver_membership_ids", 20);
        if (!team) {
            if (teamLead != null) throw validation("team_lead_membership_id", "Solo projects have no team lead");
            if (!qa.isEmpty()) throw validation("qa_membership_ids", "Solo projects have no QA picker; choose an approver instead");
            if (developers.size() > 1) throw validation("developer_membership_ids", "a Solo project has one developer");
        }
        Map<UUID, UUID> userOf = new HashMap<>();
        if (teamLead != null) userOf.put(teamLead, approvers.eligibleUser(orgId, teamLead, "team_lead_membership_id"));
        for (UUID id : developers) userOf.put(id, approvers.eligibleUser(orgId, id, "developer_membership_ids"));
        for (UUID id : qa) userOf.put(id, approvers.eligibleUser(orgId, id, "qa_membership_ids"));
        for (UUID id : approverIds) userOf.put(id, approvers.eligibleUser(orgId, id, "approver_membership_ids"));

        // Phases and tasks (Team only).
        List<PhaseInput> phases = request.phases() == null ? List.of() : request.phases();
        List<TaskInput> tasks = request.tasks() == null ? List.of() : request.tasks();
        if (!team && (!phases.isEmpty() || !tasks.isEmpty())) {
            throw validation("tasks", "Solo projects have no phases and no tasks");
        }
        Plan plan = team ? plan(phases, tasks, developers) : new Plan(List.of(), List.of(), BigDecimal.ZERO);

        // The project record itself (task 2.1 rules, audit + outbox inside).
        UUID creatorMembership = permissions.requireMembership(authentication, orgId);
        String creatorRole = jdbc.queryForObject("SELECT role_template FROM memberships WHERE id = ?", String.class,
                creatorMembership);
        Set<UUID> members = new LinkedHashSet<>();
        if (teamLead != null) members.add(teamLead);
        members.addAll(developers);
        members.addAll(qa);
        members.addAll(approverIds);
        UUID pm = "PROJECT_MANAGER".equals(creatorRole) ? creatorMembership : null;
        ProjectService.ProjectResponse project = projects.create(orgId, authentication,
                new ProjectService.CreateProjectRequest(request.name(), request.key(), request.description(),
                        team ? "STRUCTURED" : "INDIVIDUAL", request.startOn().isEqual(LocalDate.now(zone)) ? "ACTIVE" : "PLANNED",
                        request.priority(), pm, team || developers.isEmpty() ? null : developers.get(0),
                        new ArrayList<>(members), null, request.startOn(), request.targetOn(), timezone),
                false);

        Map<String, String> taskIds = team ? writePlan(orgId, actor.userId(), project, plan, userOf, developers) : Map.of();
        approvers.replace(orgId, actor.userId(), project.id(), approverIds);
        files.attachStaged(orgId, actor.userId(), project.id(), request.documentFileIds());

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("mode", team ? "STRUCTURED" : "INDIVIDUAL");
        summary.put("phases", plan.phases().size());
        summary.put("tasks", plan.tasks().size());
        summary.put("total_points", plan.total());
        summary.put("team_lead_membership_id", teamLead == null ? null : teamLead.toString());
        summary.put("developer_membership_ids", developers.stream().map(UUID::toString).toList());
        summary.put("qa_membership_ids", qa.stream().map(UUID::toString).toList());
        summary.put("approver_membership_ids", approverIds.stream().map(UUID::toString).toList());
        summary.put("documents", request.documentFileIds() == null ? 0 : request.documentFileIds().size());
        Map<String, Object> payload = new LinkedHashMap<>(summary);
        payload.put("project_id", project.id());
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, actor.userId(), "project.setup_completed", "PROJECT",
                        UUID.fromString(project.id()), null, null, summary),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(project.id()), project.version(),
                        "ProjectSetUp", payload));
        return new SetupResult(projects.get(orgId, project.id(), authentication), plan.total(), taskIds.size(),
                approvers.list(orgId, project.id()));
    }

    /* ================================================================== plan */

    record Plan(List<PhaseInput> phases, List<TaskInput> tasks, BigDecimal total) {}

    static Plan plan(List<PhaseInput> phases, List<TaskInput> tasks, List<UUID> developers) {
        if (phases.size() > MAX_PHASES) throw validation("phases", "at most " + MAX_PHASES + " phases");
        if (tasks.size() > MAX_TASKS) throw validation("tasks", "at most " + MAX_TASKS + " tasks");
        Set<String> phaseRefs = new HashSet<>();
        for (PhaseInput phase : phases) {
            String ref = ref(phase.ref(), "phases");
            if (!phaseRefs.add(ref)) throw validation("phases", "phase " + ref + " is listed twice");
            title(phase.name(), "phases");
        }
        if (!tasks.isEmpty() && phases.isEmpty()) throw validation("phases", "add at least one phase for the tasks");
        Map<String, TaskInput> byRef = new LinkedHashMap<>();
        BigDecimal total = BigDecimal.ZERO;
        for (TaskInput task : tasks) {
            String ref = ref(task.ref(), "tasks");
            if (byRef.put(ref, task) != null) throw validation("tasks", "task " + ref + " is listed twice");
            title(task.title(), "tasks");
            if (task.phaseRef() == null || !phaseRefs.contains(task.phaseRef().trim())) {
                throw validation("tasks", "\"" + task.title().trim() + "\" needs one of the phases");
            }
            if (task.points() == null || task.points() < 1 || task.points() > 100) {
                throw validation("points", "\"" + task.title().trim() + "\" needs whole points from 1 to 100");
            }
            if (task.assigneeMembershipId() != null && !developers.contains(task.assigneeMembershipId())) {
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "ASSIGNEE_NOT_DEVELOPER",
                        "A task can only be assigned to one of the project's developers.",
                        List.of(new ApiError.FieldError("assignee_membership_id", "is not a developer of this project")));
            }
            total = total.add(BigDecimal.valueOf(task.points()));
        }
        ScopeService.requireWithinPointLimit(total);
        for (TaskInput task : tasks) {
            String dependsOn = task.dependsOnRef() == null || task.dependsOnRef().isBlank() ? null : task.dependsOnRef().trim();
            if (dependsOn == null) continue;
            if (!byRef.containsKey(dependsOn)) throw validation("depends_on_ref", "\"" + task.title().trim() + "\" depends on an unknown task");
            if (dependsOn.equals(task.ref().trim())) throw validation("depends_on_ref", "a task cannot depend on itself");
        }
        // One dependency per task: follow each chain; returning to the start is a loop.
        for (TaskInput task : tasks) {
            Set<String> seen = new HashSet<>();
            String current = task.ref().trim();
            while (current != null) {
                if (!seen.add(current)) {
                    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "DEPENDENCY_CYCLE",
                            "These dependencies form a loop. Remove one of them.",
                            List.of(new ApiError.FieldError("depends_on_ref", "creates a loop")));
                }
                TaskInput next = byRef.get(current);
                current = next.dependsOnRef() == null || next.dependsOnRef().isBlank() ? null : next.dependsOnRef().trim();
            }
        }
        return new Plan(phases, tasks, total);
    }

    /** Phases (no points), tasks under them, dependencies, and the approved scope version 1. */
    private Map<String, String> writePlan(UUID orgId, UUID actorId, ProjectService.ProjectResponse project, Plan plan,
            Map<UUID, UUID> userOf, List<UUID> developers) {
        if (plan.phases().isEmpty()) return Map.of();
        String key = project.key().toUpperCase(Locale.ROOT);
        int count = plan.tasks().size() + plan.phases().size();
        Integer last = jdbc.queryForObject(
                "UPDATE projects SET work_item_seq = work_item_seq + ? WHERE id = ? AND org_id = ? RETURNING work_item_seq",
                Integer.class, count, project.id(), orgId);
        int next = last - count + 1; // tasks get the first keys (PRW-1, PRW-2, ...), then the phases

        Map<String, String> phaseIds = new HashMap<>();
        Map<String, String> taskIds = new LinkedHashMap<>();
        Map<String, String> taskKeys = new HashMap<>();
        for (TaskInput task : plan.tasks()) taskKeys.put(task.ref().trim(), key + "-" + (next++));
        for (PhaseInput phase : plan.phases()) {
            String id = UUID.randomUUID().toString();
            phaseIds.put(phase.ref().trim(), id);
            jdbc.update("""
                    INSERT INTO work_items (id, project_id, org_id, parent_id, type, key, title, description, state, plan_status,
                        criticality, criteria, created_by, version)
                    VALUES (?, ?, ?, NULL, 'MILESTONE', ?, ?, NULL, 'TODO', 'ACTIVE', 'NORMAL', NULL, ?, 0)
                    """, id, project.id(), orgId, key + "-" + (next++), title(phase.name(), "phases"), actorId);
        }
        // With exactly one developer, unassigned tasks go to that developer; otherwise they wait for a planner.
        UUID onlyDeveloper = developers.size() == 1 ? developers.get(0) : null;
        for (TaskInput task : plan.tasks()) {
            String id = UUID.randomUUID().toString();
            taskIds.put(task.ref().trim(), id);
            UUID assigneeMembership = task.assigneeMembershipId() != null ? task.assigneeMembershipId() : onlyDeveloper;
            UUID assignee = assigneeMembership == null ? null : userOf.get(assigneeMembership);
            String title = title(task.title(), "tasks");
            String description = task.description() == null || task.description().isBlank() ? null : task.description().trim();
            if (description != null && description.length() > 10_000) throw validation("description", "is too long");
            jdbc.update("""
                    INSERT INTO work_items (id, project_id, org_id, parent_id, type, key, title, description, state, plan_status,
                        criticality, criteria, primary_assignee_id, created_by, version)
                    VALUES (?, ?, ?, ?, 'TASK', ?, ?, ?, 'TODO', 'DRAFT', 'NORMAL', ?, ?, ?, 0)
                    """, id, project.id(), orgId, phaseIds.get(task.phaseRef().trim()), taskKeys.get(task.ref().trim()), title,
                    description, description != null ? description : "Deliver: " + title,
                    assignee == null ? null : assignee.toString(), actorId);
            if (assignee != null) {
                jdbc.update("""
                        INSERT INTO work_item_assignment_history
                            (id, org_id, work_item_id, assignment_role, previous_user_id, new_user_id, actor_id, reason)
                        VALUES (?, ?, ?, 'PRIMARY', NULL, ?, ?, 'Project setup')
                        """, UUID.randomUUID(), orgId, id, assignee, actorId);
            }
        }
        for (TaskInput task : plan.tasks()) {
            if (task.dependsOnRef() == null || task.dependsOnRef().isBlank()) continue;
            jdbc.update("""
                    INSERT INTO work_item_dependencies (id, org_id, project_id, predecessor_id, successor_id, created_by)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, UUID.randomUUID(), orgId, project.id(), taskIds.get(task.dependsOnRef().trim()),
                    taskIds.get(task.ref().trim()), actorId);
        }
        if (!plan.tasks().isEmpty()) {
            UUID version = UUID.randomUUID();
            List<Map<String, Object>> recorded = new ArrayList<>();
            for (TaskInput task : plan.tasks()) {
                recorded.add(Map.of("op", "ADD", "work_item_id", taskIds.get(task.ref().trim()),
                        "key", taskKeys.get(task.ref().trim()), "weight", task.points()));
            }
            jdbc.update("""
                    INSERT INTO scope_versions (id, org_id, project_id, unit, status, base_version_id, reason, changes, author_id)
                    VALUES (?, ?, ?, 'POINTS', 'DRAFT', NULL, 'Initial plan from project setup', ?::jsonb, ?)
                    """, version, orgId, project.id(), json(recorded), actorId);
            for (TaskInput task : plan.tasks()) {
                jdbc.update("INSERT INTO scope_leaves (scope_version_id, org_id, work_item_id, weight, cancelled) VALUES (?, ?, ?, ?, FALSE)",
                        version, orgId, taskIds.get(task.ref().trim()), BigDecimal.valueOf(task.points()));
            }
            jdbc.update("""
                    UPDATE scope_versions SET status = 'ACTIVE', version_no = 1, approver_id = ?, approved_at = now(),
                        effective_at = now(), version = version + 1
                    WHERE id = ? AND status = 'DRAFT'
                    """, actorId, version);
            jdbc.update("UPDATE projects SET active_baseline_id = ?, updated_at = now() WHERE id = ? AND org_id = ?",
                    version, project.id(), orgId);
            for (TaskInput task : plan.tasks()) {
                jdbc.update("""
                        UPDATE work_items SET plan_status = 'ACTIVE', weight = ?, weight_unit = 'POINTS', version = version + 1,
                            updated_at = now()
                        WHERE id = ? AND org_id = ?
                        """, BigDecimal.valueOf(task.points()), taskIds.get(task.ref().trim()), orgId);
            }
            Map<String, Object> scope = new LinkedHashMap<>();
            scope.put("version_no", 1);
            scope.put("unit", "POINTS");
            scope.put("denominator", plan.total());
            scope.put("project_id", project.id());
            changes.record(
                    new ChangeRecorder.AuditEntry(orgId, actorId, "scope.approved", "SCOPE_VERSION", version,
                            "Initial plan from project setup", null, scope),
                    new ChangeRecorder.DomainEvent(orgId, "SCOPE_VERSION", version, 1L, "ScopeChanged", scope));
            snapshots.record(orgId, project.id(), "SCOPE_APPROVED", actorId);
        }
        return taskIds;
    }

    /* ================================================================== helpers */

    static boolean team(String mode) {
        String value = mode == null ? "" : mode.trim().toUpperCase(Locale.ROOT);
        return switch (value) {
            case "TEAM", "STRUCTURED" -> true;
            case "SOLO", "INDIVIDUAL" -> false;
            default -> throw validation("mode", "choose SOLO (Individual Ownership) or TEAM (Structured Delivery)");
        };
    }

    private static List<UUID> distinct(List<UUID> ids, String field, int max) {
        Set<UUID> set = new LinkedHashSet<>(ids == null ? List.of() : ids);
        set.remove(null);
        if (set.size() > max) throw validation(field, "at most " + max + " people");
        return new ArrayList<>(set);
    }

    private static String ref(String value, String field) {
        String ref = value == null ? "" : value.trim();
        if (ref.isEmpty() || ref.length() > 64) throw validation(field, "each entry needs a reference");
        return ref;
    }

    private static String title(String value, String field) {
        String title = value == null ? "" : value.trim();
        if (title.isEmpty() || title.length() > 255) throw validation(field, "each entry needs a title (1 to 255 characters)");
        return title;
    }

    private static String display(String name, String email) {
        return name == null || name.isBlank() ? email : name;
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The request has invalid fields.",
                List.of(new ApiError.FieldError(field, message)));
    }

    /* ================================================================== records */

    public record PhaseInput(String ref, String name) {}

    public record TaskInput(String ref, String title, String description, String phaseRef, Integer points,
            String dependsOnRef, UUID assigneeMembershipId) {}

    /** {@code mode}: SOLO (Individual Ownership) or TEAM (Structured Delivery). */
    public record SetupRequest(String name, String key, String description, String mode, LocalDate startOn,
            LocalDate targetOn, String timezone, String priority, UUID teamLeadMembershipId,
            List<UUID> developerMembershipIds, List<UUID> qaMembershipIds, List<UUID> approverMembershipIds,
            List<UUID> documentFileIds, List<PhaseInput> phases, List<TaskInput> tasks) {}

    public record Person(UUID membershipId, UUID userId, String name, String email, String role, int openTasks,
            int activeProjects) {}

    public record Limits(int maxTotalPoints, long documentMaxBytes, long screenshotMaxBytes, int maxPhases, int maxTasks) {}

    public record SetupOptions(String defaultTimezone, LocalDate today, List<Person> people, Limits limits) {}

    public record SetupResult(ProjectService.ProjectResponse project, BigDecimal totalPoints, int taskCount,
            List<ProjectApprovers.Approver> approvers) {}
}
