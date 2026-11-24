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
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.dao.DuplicateKeyException;
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
import com.prowise.common.api.CursorPage;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.identity.AuthPrincipal;
import com.prowise.domain.IndividualProgress;

/**
 * Task 2.1 (FR-009 / T09, FR-011 / T11): project records.
 *
 * <p><b>Who may read a project</b> (server-side on list, detail and edit; anything else is a 404):
 * <ul>
 *   <li>the whole portfolio: {@code project.read} AND {@code project.create} at organization scope
 *       (people who run the portfolio: Owner, Admin, Project Manager by the default templates);</li>
 *   <li>one project: a PROJECT-scoped grant with {@code project.read} for exactly that project;</li>
 *   <li>assigned work: organization-scope {@code project.read} and a relationship to the project
 *       (project manager, accountable developer or project member) - the CONDITIONAL rows of the matrix.</li>
 * </ul>
 * Edits additionally need {@code project.edit} at organization scope or on that project.
 *
 * <p>A new project has zero tasks and no percentage: progress is "Not reported" until someone reports it (2.2).
 */
@Service
public class ProjectService {

    static final String NOT_REPORTED = "Not reported";
    private static final Pattern KEY = Pattern.compile("^[A-Z][A-Z0-9]{1,9}$");
    private static final Set<String> MODES = Set.of("INDIVIDUAL", "STRUCTURED");
    private static final Set<String> PRIORITIES = Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL");
    private static final Set<String> CREATE_STATES = Set.of("PLANNED", "ACTIVE");
    /** Lifecycle moves owned by 2.1; acceptance, delivery, closing and cancelling arrive with 2.4. */
    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
            "PLANNED", Set.of("ACTIVE", "ON_HOLD"),
            "ACTIVE", Set.of("ON_HOLD"),
            "ON_HOLD", Set.of("ACTIVE"));
    private static final int DEFAULT_LIMIT = 25;
    private static final int MAX_LIMIT = 100;

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;
    private final SecurityEvidenceService evidence;
    private final ChangeRecorder changes;
    private final org.springframework.context.ApplicationEventPublisher events;

    public ProjectService(JdbcTemplate jdbc, PermissionService permissions, SecurityEvidenceService evidence,
            ChangeRecorder changes, org.springframework.context.ApplicationEventPublisher events) {
        this.events = events;
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.evidence = evidence;
        this.changes = changes;
    }

    /* ================================================================== create */

    @Transactional
    public ProjectResponse create(UUID organizationId, Authentication authentication, CreateProjectRequest request) {
        permissions.require(authentication, organizationId, PermissionKey.PROJECT_CREATE.value());
        AuthPrincipal actor = permissions.principal(authentication);
        if (request == null) throw validation("name", "is required");
        String name = name(request.name());
        String key = key(request.key());
        String mode = oneOf("mode", request.mode(), MODES, null);
        String lifecycle = oneOf("status", request.status(), CREATE_STATES, "PLANNED");
        String priority = oneOf("priority", request.priority(), PRIORITIES, "MEDIUM");
        String timezone = timezone(request.timezone(), organizationTimezone(organizationId));
        dateRange(request.startOn(), request.targetOn());
        // A new project starts today or later (today in the project's time zone); the target is on or after the start.
        com.prowise.domain.ProjectDates.forNewProject(request.startOn(), request.targetOn(), LocalDate.now(ZoneId.of(timezone)))
                .ifPresent(problem -> { throw validation(problem.field(), problem.message()); });
        String description = description(request.description());

        Member pm = request.projectManagerMembershipId() == null ? null
                : activeMember(organizationId, request.projectManagerMembershipId(), "project_manager_membership_id");
        Member accountable = request.accountableMembershipId() == null ? null
                : activeMember(organizationId, request.accountableMembershipId(), "accountable_membership_id");
        if ("INDIVIDUAL".equals(mode) && accountable == null) {
            throw validation("accountable_membership_id", "an Individual project needs one accountable developer");
        }
        List<Member> members = members(organizationId, request.memberMembershipIds(), pm, accountable);
        UUID teamId = request.teamId();
        if (teamId != null) activeTeam(organizationId, teamId);

        String id = UUID.randomUUID().toString();
        try {
            jdbc.update("""
                    INSERT INTO projects (id, org_id, key, name, description, mode, lifecycle, priority,
                        project_manager_membership_id, accountable_membership_id, project_manager_id, accountable_owner_id,
                        member_ids, team_id, start_on, target_on, start_date, target_date, timezone,
                        last_progress_percent, health, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
                    """, id, organizationId, key, name, description, mode, lifecycle, priority,
                    pm == null ? null : pm.id(), accountable == null ? null : accountable.id(),
                    pm == null ? null : pm.userId().toString(), accountable == null ? null : accountable.userId().toString(),
                    legacyMemberIds(members), teamId, sqlDate(request.startOn()), sqlDate(request.targetOn()),
                    startOfDay(request.startOn(), timezone), startOfDay(request.targetOn(), timezone), timezone,
                    actor.userId());
        } catch (DuplicateKeyException exception) {
            throw duplicateKey();
        }
        for (Member member : members) addMember(organizationId, id, member.id(), actor.userId());

        ProjectResponse created = find(organizationId, id, authentication);
        changes.record(
                new ChangeRecorder.AuditEntry(organizationId, actor.userId(), "project.created", "PROJECT", UUID.fromString(id),
                        null, null, snapshot(created)),
                new ChangeRecorder.DomainEvent(organizationId, "PROJECT", UUID.fromString(id), 0L, "ProjectCreated",
                        snapshot(created)));
        events.publishEvent(new ProjectScheduleChanged(organizationId, id)); // task 2.3: first occurrences, same transaction
        return created;
    }

    /* ================================================================== read */

    public CursorPage<ProjectResponse> list(UUID organizationId, Authentication authentication, ListQuery query) {
        Access access = access(organizationId, authentication);
        int limit = query.limit() == null ? DEFAULT_LIMIT : Math.max(1, Math.min(MAX_LIMIT, query.limit()));
        StringBuilder sql = new StringBuilder(SELECT).append(" WHERE p.org_id = ?");
        List<Object> args = new ArrayList<>();
        args.add(organizationId);
        appendReadable(sql, args, access);
        if (!Boolean.TRUE.equals(query.includeArchived())) sql.append(" AND p.archived = FALSE");
        if (query.q() != null && !query.q().isBlank()) {
            String like = "%" + query.q().trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%")
                    .replace("_", "\\_") + "%";
            sql.append(" AND (lower(p.name) LIKE ? OR lower(p.key) LIKE ?)");
            args.add(like);
            args.add(like);
        }
        if (query.owner() != null) {
            sql.append(" AND (p.project_manager_membership_id = ? OR p.accountable_membership_id = ?)");
            args.add(query.owner());
            args.add(query.owner());
        }
        if (query.team() != null) {
            sql.append(" AND p.team_id = ?");
            args.add(query.team());
        }
        if (query.status() != null && !query.status().isBlank()) {
            sql.append(" AND p.lifecycle = ?");
            args.add(query.status().trim().toUpperCase(Locale.ROOT));
        }
        if (query.mode() != null && !query.mode().isBlank()) {
            sql.append(" AND p.mode = ?");
            args.add(query.mode().trim().toUpperCase(Locale.ROOT));
        }
        if (query.from() != null) {
            sql.append(" AND p.target_on >= ?");
            args.add(sqlDate(query.from()));
        }
        if (query.to() != null) {
            sql.append(" AND p.target_on <= ?");
            args.add(sqlDate(query.to()));
        }
        Cursor cursor = Cursor.decode(query.cursor());
        if (cursor != null) {
            sql.append(" AND (lower(p.name), p.id) > (?, ?)");
            args.add(cursor.name());
            args.add(cursor.id());
        }
        sql.append(" ORDER BY lower(p.name), p.id LIMIT ?");
        args.add(limit + 1);
        List<Row> rows = jdbc.query(sql.toString(), (rs, n) -> row(rs), args.toArray());
        boolean more = rows.size() > limit;
        List<Row> page = more ? rows.subList(0, limit) : rows;
        List<ProjectResponse> items = responses(organizationId, authentication, page);
        String next = more ? new Cursor(page.get(page.size() - 1).sortName(),
                page.get(page.size() - 1).id()).encode() : null;
        return new CursorPage<>(items, next, more);
    }

    public ProjectResponse get(UUID organizationId, String projectId, Authentication authentication) {
        return find(organizationId, projectId, authentication);
    }

    /**
     * Every project the caller may read (same rule as the list), optionally one mode, without archived ones. For
     * cross-project views: unreadable projects are simply absent, never probed one by one.
     */
    public List<ProjectResponse> readable(UUID organizationId, Authentication authentication, String mode) {
        List<ProjectResponse> all = new ArrayList<>();
        String cursor = null;
        do {
            CursorPage<ProjectResponse> page = list(organizationId, authentication,
                    new ListQuery(cursor, MAX_LIMIT, null, null, null, null, mode, null, null, false));
            all.addAll(page.items());
            cursor = page.hasMore() ? page.nextCursor() : null;
        } while (cursor != null);
        return all;
    }

    public List<DateChange> dateHistory(UUID organizationId, String projectId, Authentication authentication) {
        find(organizationId, projectId, authentication);
        return jdbc.query("""
                SELECT h.previous_target_on, h.new_target_on, h.reason, u.email AS actor_email, h.occurred_at
                FROM project_date_history h LEFT JOIN users u ON u.id = h.actor_id
                WHERE h.org_id = ? AND h.project_id = ? ORDER BY h.occurred_at DESC
                """, (rs, n) -> new DateChange(localDate(rs, "previous_target_on"), localDate(rs, "new_target_on"),
                        rs.getString("reason"), rs.getString("actor_email"), rs.getTimestamp("occurred_at").toInstant()),
                organizationId, projectId);
    }

    /**
     * People and teams a project can be assigned to (setup and edit forms). A Project Manager may lack
     * role.manage / team.manage, so this read is tied to project.create or project.edit instead.
     */
    public ProjectOptions options(UUID organizationId, Authentication authentication) {
        permissions.requireMembership(authentication, organizationId);
        if (!permissions.can(authentication, organizationId, PermissionKey.PROJECT_CREATE.value())
                && !permissions.can(authentication, organizationId, PermissionKey.PROJECT_EDIT.value())) {
            throw PermissionService.forbidden();
        }
        List<AssignableMember> members = jdbc.query("""
                SELECT m.id, u.email, m.role_template FROM memberships m JOIN users u ON u.id = m.user_id
                WHERE m.org_id = ? AND m.status = 'ACTIVE' ORDER BY lower(u.email), m.id
                """, (rs, n) -> new AssignableMember(rs.getObject("id", UUID.class), rs.getString("email"),
                        rs.getString("role_template")), organizationId);
        List<TeamOption> teams = jdbc.query("""
                SELECT id, name FROM teams WHERE org_id = ? AND status = 'ACTIVE' ORDER BY lower(name), id
                """, (rs, n) -> new TeamOption(rs.getObject("id", UUID.class), rs.getString("name")), organizationId);
        return new ProjectOptions(members, teams, organizationTimezone(organizationId));
    }

    /* ================================================================== edit */

    @Transactional
    public ProjectResponse update(UUID organizationId, String projectId, Authentication authentication,
            UpdateProjectRequest request) {
        ProjectResponse before = find(organizationId, projectId, authentication);
        if (!permissions.canOnProject(authentication, organizationId, projectId, PermissionKey.PROJECT_EDIT.value())) {
            throw PermissionService.forbidden();
        }
        AuthPrincipal actor = permissions.principal(authentication);
        if (request == null || request.expectedVersion() == null) throw validation("expected_version", "is required");
        Long current = jdbc.queryForObject("SELECT version FROM projects WHERE id = ? AND org_id = ? FOR UPDATE",
                Long.class, projectId, organizationId);
        ExpectedVersion.check(current == null ? -1 : current, request.expectedVersion());
        if (before.archived()) {
            throw new ApiException(HttpStatus.CONFLICT, "PROJECT_ARCHIVED", "Archived projects are read-only.");
        }
        if (request.mode() != null && !request.mode().equalsIgnoreCase(before.mode())) {
            throw new ApiException(HttpStatus.CONFLICT, "MODE_CHANGE_NOT_ALLOWED",
                    "Switching mode is a separate, approved transition.");
        }

        String name = request.name() == null ? before.name() : name(request.name());
        String description = request.description() == null ? before.description() : description(request.description());
        String priority = request.priority() == null ? before.priority() : oneOf("priority", request.priority(), PRIORITIES, null);
        String timezone = request.timezone() == null ? before.timezone() : timezone(request.timezone(), null);
        LocalDate startOn = request.startOn() == null ? before.startOn() : request.startOn();
        LocalDate targetOn = request.targetOn() == null ? before.targetOn() : request.targetOn();
        dateRange(startOn, targetOn);
        boolean targetChanged = request.targetOn() != null && !request.targetOn().equals(before.targetOn());
        String targetReason = null;
        if (targetChanged) {
            if (!Objects.equals(request.previousTargetOn(), before.targetOn())) {
                throw validation("previous_target_on", "must equal the current target date ("
                        + (before.targetOn() == null ? "none" : before.targetOn()) + ")");
            }
            targetReason = request.targetDateReason() == null ? "" : request.targetDateReason().trim();
            if (targetReason.isEmpty()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "TARGET_DATE_REASON_REQUIRED",
                        "Changing the target date needs a reason.",
                        List.of(new ApiError.FieldError("target_date_reason", "is required")));
            }
            if (targetReason.length() > 500) throw validation("target_date_reason", "must be at most 500 characters");
        }
        String lifecycle = before.lifecycle();
        String lifecycleReason = null;
        if (request.lifecycle() != null && !request.lifecycle().equalsIgnoreCase(before.lifecycle())) {
            String next = request.lifecycle().trim().toUpperCase(Locale.ROOT);
            if (!TRANSITIONS.getOrDefault(before.lifecycle(), Set.of()).contains(next)) {
                throw new ApiException(HttpStatus.CONFLICT, "LIFECYCLE_TRANSITION_NOT_ALLOWED",
                        "A project cannot move from " + before.lifecycle() + " to " + next + " here.");
            }
            lifecycleReason = request.lifecycleReason() == null ? "" : request.lifecycleReason().trim();
            if (lifecycleReason.isEmpty()) throw validation("lifecycle_reason", "is required to change the status");
            lifecycle = next;
        }

        UUID pmId = request.projectManagerMembershipId() == null ? membershipId(before.projectManager())
                : activeMember(organizationId, request.projectManagerMembershipId(), "project_manager_membership_id").id();
        UUID accountableId = request.accountableMembershipId() == null ? membershipId(before.accountable())
                : activeMember(organizationId, request.accountableMembershipId(), "accountable_membership_id").id();
        Member pm = pmId == null ? null : member(organizationId, pmId);
        Member accountable = accountableId == null ? null : member(organizationId, accountableId);
        UUID teamId = request.teamId() == null ? before.teamId() : request.teamId();
        if (request.teamId() != null) activeTeam(organizationId, teamId);

        List<Member> members;
        if (request.memberMembershipIds() != null) {
            members = members(organizationId, request.memberMembershipIds(), pm, accountable);
        } else {
            List<UUID> keep = new ArrayList<>(before.members().stream().map(PersonRef::membershipId).toList());
            members = members(organizationId, keep, null, null);
            for (Member required : java.util.Arrays.asList(pm, accountable)) {
                if (required != null && members.stream().noneMatch(m -> m.id().equals(required.id()))) members.add(required);
            }
        }

        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE projects SET name = ?, description = ?, priority = ?, timezone = ?, start_on = ?, target_on = ?,
                    start_date = ?, target_date = ?, lifecycle = ?, project_manager_membership_id = ?,
                    accountable_membership_id = ?, project_manager_id = ?, accountable_owner_id = ?, member_ids = ?,
                    team_id = ?, version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, name, description, priority, timezone, sqlDate(startOn), sqlDate(targetOn),
                startOfDay(startOn, timezone), startOfDay(targetOn, timezone), lifecycle, pmId, accountableId,
                pm == null ? null : pm.userId().toString(), accountable == null ? null : accountable.userId().toString(),
                legacyMemberIds(members), teamId, projectId, organizationId, request.expectedVersion()));
        jdbc.update("DELETE FROM project_members WHERE project_id = ? AND org_id = ?", projectId, organizationId);
        for (Member member : members) addMember(organizationId, projectId, member.id(), actor.userId());
        if (targetChanged) {
            jdbc.update("""
                    INSERT INTO project_date_history (id, org_id, project_id, previous_target_on, new_target_on, reason, actor_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, UUID.randomUUID(), organizationId, projectId, sqlDate(before.targetOn()), sqlDate(targetOn),
                    targetReason, actor.userId());
        }

        ProjectResponse after = find(organizationId, projectId, authentication);
        Map<String, Object> previous = new LinkedHashMap<>(snapshot(before));
        Map<String, Object> next = new LinkedHashMap<>(snapshot(after));
        String reason = targetReason != null && lifecycleReason != null ? targetReason + " · " + lifecycleReason
                : targetReason != null ? targetReason : lifecycleReason;
        changes.record(
                new ChangeRecorder.AuditEntry(organizationId, actor.userId(), "project.updated", "PROJECT",
                        UUID.fromString(projectId), reason, previous, next),
                new ChangeRecorder.DomainEvent(organizationId, "PROJECT", UUID.fromString(projectId), after.version(),
                        targetChanged ? "ProjectTargetDateChanged" : "ProjectUpdated", next));
        // Task 2.3: a new target, start, zone or lifecycle supersedes and recomputes occurrences in this transaction.
        events.publishEvent(new ProjectScheduleChanged(organizationId, projectId));
        return after;
    }

    /* ================================================================== access */

    private record Access(UUID userId, UUID membershipId, boolean portfolio, boolean orgRead, boolean orgEdit) {}

    private Access access(UUID organizationId, Authentication authentication) {
        UUID membershipId = permissions.requireMembership(authentication, organizationId);
        AuthPrincipal principal = permissions.principal(authentication);
        boolean orgRead = permissions.can(authentication, organizationId, PermissionKey.PROJECT_READ.value());
        boolean portfolio = orgRead && permissions.can(authentication, organizationId, PermissionKey.PROJECT_CREATE.value());
        boolean orgEdit = permissions.can(authentication, organizationId, PermissionKey.PROJECT_EDIT.value());
        return new Access(principal.userId(), membershipId, portfolio, orgRead, orgEdit);
    }

    private static void appendReadable(StringBuilder sql, List<Object> args, Access access) {
        sql.append("""
                 AND (? OR p.id IN (
                        SELECT CAST(g.scope_id AS text) FROM grants g
                        JOIN memberships gm ON gm.id = g.membership_id AND gm.org_id = g.org_id
                        JOIN role_permissions rp ON rp.role_id = COALESCE(g.template_role_id, g.org_role_id)
                        WHERE g.org_id = p.org_id AND gm.user_id = ? AND gm.status = 'ACTIVE' AND g.scope = 'PROJECT'
                          AND rp.permission_key = 'project.read' AND (g.expires_at IS NULL OR g.expires_at > now()))
                      OR (? AND (p.accountable_membership_id = ? OR p.project_manager_membership_id = ?
                          OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.org_id = p.org_id
                                     AND pm.membership_id = ?)
                          OR EXISTS (SELECT 1 FROM teams lt WHERE lt.id = p.team_id AND lt.org_id = p.org_id
                                     AND lt.lead_membership_id = ?))))
                """);
        args.add(access.portfolio());
        args.add(access.userId());
        args.add(access.orgRead());
        args.add(access.membershipId());
        args.add(access.membershipId());
        args.add(access.membershipId());
        args.add(access.membershipId()); // task 2.2: the lead of the project's team reads it (to approve check-ins)
    }

    /** One readable project, or 404 with no metadata (and a security evidence row). */
    private ProjectResponse find(UUID organizationId, String projectId, Authentication authentication) {
        Access access = access(organizationId, authentication);
        StringBuilder sql = new StringBuilder(SELECT).append(" WHERE p.org_id = ? AND p.id = ?");
        List<Object> args = new ArrayList<>(List.of(organizationId, projectId == null ? "" : projectId));
        appendReadable(sql, args, access);
        List<Row> rows = jdbc.query(sql.toString(), (rs, n) -> row(rs), args.toArray());
        if (rows.isEmpty()) {
            evidence.recordDenied(permissions.principal(authentication), SecurityEvidenceService.ACCESS_DENIED, "PROJECT",
                    projectId == null ? null : projectId.substring(0, Math.min(projectId.length(), 100)),
                    "Project not readable");
            throw PermissionService.notFound();
        }
        return responses(organizationId, authentication, rows).get(0);
    }

    /* ================================================================== mapping */

    private static final String SELECT = """
            SELECT p.id, p.key, p.name, lower(p.name) AS sort_name, p.description, p.mode, p.lifecycle, p.archived, p.priority,
                   p.project_manager_membership_id, pmu.email AS pm_email,
                   p.accountable_membership_id, acu.email AS accountable_email,
                   p.team_id, t.name AS team_name, p.start_on, p.target_on, p.timezone, p.active_baseline_id,
                   p.last_progress_percent, p.last_reported_at, p.version, p.created_at, p.updated_at,
                   (SELECT count(*) FROM work_items w WHERE w.org_id = p.org_id AND w.project_id = p.id) AS task_count
            FROM projects p
            LEFT JOIN memberships pmm ON pmm.id = p.project_manager_membership_id AND pmm.org_id = p.org_id
            LEFT JOIN users pmu ON pmu.id = pmm.user_id
            LEFT JOIN memberships acm ON acm.id = p.accountable_membership_id AND acm.org_id = p.org_id
            LEFT JOIN users acu ON acu.id = acm.user_id
            LEFT JOIN teams t ON t.id = p.team_id AND t.org_id = p.org_id
            """;

    private record Row(String id, String key, String name, String description, String mode, String lifecycle,
            boolean archived, String priority, PersonRef projectManager, PersonRef accountable, UUID teamId,
            String teamName, LocalDate startOn, LocalDate targetOn, String timezone, UUID activeBaselineId,
            BigDecimal percent, Instant reportedAt, long version, Instant createdAt, Instant updatedAt, long taskCount, String sortName) {}

    private static Row row(ResultSet rs) throws SQLException {
        UUID pm = rs.getObject("project_manager_membership_id", UUID.class);
        UUID accountable = rs.getObject("accountable_membership_id", UUID.class);
        return new Row(rs.getString("id"), rs.getString("key"), rs.getString("name"), rs.getString("description"),
                rs.getString("mode"), rs.getString("lifecycle"), rs.getBoolean("archived"), rs.getString("priority"),
                pm == null ? null : new PersonRef(pm, rs.getString("pm_email")),
                accountable == null ? null : new PersonRef(accountable, rs.getString("accountable_email")),
                rs.getObject("team_id", UUID.class), rs.getString("team_name"), localDate(rs, "start_on"),
                localDate(rs, "target_on"), rs.getString("timezone"), rs.getObject("active_baseline_id", UUID.class),
                rs.getBigDecimal("last_progress_percent"), instant(rs, "last_reported_at"), rs.getLong("version"), rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant(), rs.getLong("task_count"), rs.getString("sort_name"));
    }

    private List<ProjectResponse> responses(UUID organizationId, Authentication authentication, List<Row> rows) {
        if (rows.isEmpty()) return List.of();
        Map<String, List<PersonRef>> members = new HashMap<>();
        String placeholders = String.join(",", rows.stream().map(r -> "?").toList());
        List<Object> args = new ArrayList<>();
        args.add(organizationId);
        rows.forEach(r -> args.add(r.id()));
        jdbc.query("""
                SELECT pm.project_id, pm.membership_id, u.email FROM project_members pm
                JOIN memberships m ON m.id = pm.membership_id AND m.org_id = pm.org_id
                JOIN users u ON u.id = m.user_id
                WHERE pm.org_id = ? AND pm.project_id IN (""" + placeholders + ") ORDER BY lower(u.email)", rs -> {
            members.computeIfAbsent(rs.getString("project_id"), k -> new ArrayList<>())
                    .add(new PersonRef(rs.getObject("membership_id", UUID.class), rs.getString("email")));
        }, args.toArray());
        boolean orgEdit = permissions.can(authentication, organizationId, PermissionKey.PROJECT_EDIT.value());
        return rows.stream().map(r -> {
            boolean canEdit = !r.archived() && (orgEdit
                    || permissions.canOnProject(authentication, organizationId, r.id(), PermissionKey.PROJECT_EDIT.value()));
            Progress progress = r.percent() == null
                    ? new Progress(null, "STRUCTURED".equals(r.mode()) ? com.prowise.domain.AcceptedWork.NOT_MEASURABLE : NOT_REPORTED, null)
                    : new Progress(r.percent(), "INDIVIDUAL".equals(r.mode()) ? IndividualProgress.LABEL : "Calculated", r.reportedAt());
            return new ProjectResponse(r.id(), r.key(), r.name(), r.description(), r.mode(), r.lifecycle(), r.archived(),
                    r.priority(), r.projectManager(), r.accountable(), members.getOrDefault(r.id(), List.of()), r.teamId(),
                    r.teamName(), r.startOn(), r.targetOn(), r.timezone(), r.activeBaselineId(), r.taskCount(), progress,
                    canEdit, r.version(), r.createdAt(), r.updatedAt());
        }).toList();
    }

    private static Map<String, Object> snapshot(ProjectResponse p) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("key", p.key());
        s.put("name", p.name());
        s.put("mode", p.mode());
        s.put("lifecycle", p.lifecycle());
        s.put("priority", p.priority());
        s.put("project_manager_membership_id", p.projectManager() == null ? null : p.projectManager().membershipId().toString());
        s.put("accountable_membership_id", p.accountable() == null ? null : p.accountable().membershipId().toString());
        s.put("team_id", p.teamId() == null ? null : p.teamId().toString());
        s.put("start_on", p.startOn() == null ? null : p.startOn().toString());
        s.put("target_on", p.targetOn() == null ? null : p.targetOn().toString());
        s.put("timezone", p.timezone());
        s.put("member_count", p.members().size());
        return s;
    }

    /* ================================================================== validation helpers */

    private record Member(UUID id, UUID userId) {}

    /** Owners, PM and members must be ACTIVE memberships of this organization; a foreign id is a 404. */
    private Member activeMember(UUID organizationId, UUID membershipId, String field) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, user_id, status FROM memberships WHERE id = ? AND org_id = ?", membershipId, organizationId);
        if (rows.isEmpty()) throw PermissionService.notFound();
        if (!"ACTIVE".equals(rows.get(0).get("status"))) {
            throw new ApiException(HttpStatus.CONFLICT, "MEMBER_INACTIVE", "Only active members can be assigned.",
                    List.of(new ApiError.FieldError(field, "is not an active member")));
        }
        return new Member(membershipId, (UUID) rows.get(0).get("user_id"));
    }

    private Member member(UUID organizationId, UUID membershipId) {
        UUID userId = jdbc.queryForObject("SELECT user_id FROM memberships WHERE id = ? AND org_id = ?", UUID.class,
                membershipId, organizationId);
        return new Member(membershipId, userId);
    }

    private List<Member> members(UUID organizationId, List<UUID> ids, Member pm, Member accountable) {
        Set<UUID> wanted = new LinkedHashSet<>();
        if (pm != null) wanted.add(pm.id());
        if (accountable != null) wanted.add(accountable.id());
        if (ids != null) {
            if (ids.size() > 200) throw validation("member_membership_ids", "at most 200 members");
            for (UUID id : ids) if (id != null) wanted.add(id);
        }
        List<Member> result = new ArrayList<>();
        for (UUID id : wanted) {
            if (pm != null && id.equals(pm.id())) result.add(pm);
            else if (accountable != null && id.equals(accountable.id())) result.add(accountable);
            else result.add(activeOrKnownMember(organizationId, id, ids));
        }
        return result;
    }

    /** New members must be active; members kept from before may since have been disabled and stay listed. */
    private Member activeOrKnownMember(UUID organizationId, UUID id, List<UUID> requested) {
        return requested != null ? activeMember(organizationId, id, "member_membership_ids") : member(organizationId, id);
    }

    private void addMember(UUID organizationId, String projectId, UUID membershipId, UUID actorId) {
        jdbc.update("""
                INSERT INTO project_members (project_id, org_id, membership_id, added_by) VALUES (?, ?, ?, ?)
                ON CONFLICT DO NOTHING
                """, projectId, organizationId, membershipId, actorId);
    }

    private void activeTeam(UUID organizationId, UUID teamId) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM teams WHERE id = ? AND org_id = ? AND status = 'ACTIVE'",
                Integer.class, teamId, organizationId);
        if (count == null || count != 1) throw PermissionService.notFound();
    }

    private String organizationTimezone(UUID organizationId) {
        return jdbc.queryForObject("SELECT timezone FROM organizations WHERE id = ?", String.class, organizationId);
    }

    private static UUID membershipId(PersonRef ref) {
        return ref == null ? null : ref.membershipId();
    }

    private static String legacyMemberIds(List<Member> members) {
        return members.isEmpty() ? null : String.join(",", members.stream().map(m -> m.userId().toString()).toList());
    }

    private static String name(String value) {
        String name = value == null ? "" : value.trim();
        if (name.isEmpty() || name.length() > 200) throw validation("name", "must be 1 to 200 characters");
        return name;
    }

    private static String key(String value) {
        String key = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (!KEY.matcher(key).matches()) {
            throw validation("key", "must be 2 to 10 letters or digits and start with a letter (for example CRM)");
        }
        return key;
    }

    private static String description(String value) {
        if (value == null || value.isBlank()) return null;
        if (value.trim().length() > 5000) throw validation("description", "must be at most 5000 characters");
        return value.trim();
    }

    private static String oneOf(String field, String value, Set<String> allowed, String fallback) {
        if (value == null || value.isBlank()) {
            if (fallback != null) return fallback;
            throw validation(field, "is required");
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(normalized)) throw validation(field, "must be one of " + String.join(", ", allowed.stream().sorted().toList()));
        return normalized;
    }

    private static String timezone(String value, String fallback) {
        String zone = value == null || value.isBlank() ? fallback : value.trim();
        if (zone == null || !ZoneId.getAvailableZoneIds().contains(zone)) {
            throw validation("timezone", "must be an IANA time zone such as Europe/London");
        }
        return zone;
    }

    private static void dateRange(LocalDate start, LocalDate target) {
        if (start != null && target != null && target.isBefore(start)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "The target date is before the start date.",
                    List.of(new ApiError.FieldError("target_on", "must be on or after the start date")));
        }
    }

    private static Date sqlDate(LocalDate date) {
        return date == null ? null : Date.valueOf(date);
    }

    /** Legacy timestamp columns: the local date at the start of the day in the project zone (no 24h arithmetic). */
    private static Timestamp startOfDay(LocalDate date, String timezone) {
        return date == null ? null : Timestamp.from(date.atStartOfDay(ZoneId.of(timezone)).toInstant());
    }

    private static LocalDate localDate(ResultSet rs, String column) throws SQLException {
        Date value = rs.getDate(column);
        return value == null ? null : value.toLocalDate();
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private static ApiException duplicateKey() {
        return new ApiException(HttpStatus.CONFLICT, "DUPLICATE_PROJECT_KEY", "This project key is already used in the workspace.",
                List.of(new ApiError.FieldError("key", "is already in use")));
    }

    private static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The request has invalid fields.",
                List.of(new ApiError.FieldError(field, message)));
    }

    /** Keyset cursor over (lower(name), id); opaque to clients. */
    record Cursor(String name, String id) {
        String encode() {
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString((name + "\u0000" + id).getBytes(StandardCharsets.UTF_8));
        }

        static Cursor decode(String value) {
            if (value == null || value.isBlank()) return null;
            try {
                String raw = new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8);
                int split = raw.indexOf('\u0000');
                if (split < 0) throw new IllegalArgumentException();
                return new Cursor(raw.substring(0, split), raw.substring(split + 1));
            } catch (IllegalArgumentException exception) {
                throw validation("cursor", "is invalid");
            }
        }
    }

    /* ================================================================== API records */

    public record CreateProjectRequest(String name, String key, String description, String mode, String status,
            String priority, UUID projectManagerMembershipId, UUID accountableMembershipId, List<UUID> memberMembershipIds,
            UUID teamId, LocalDate startOn, LocalDate targetOn, String timezone) {}

    public record UpdateProjectRequest(String name, String description, String priority, UUID projectManagerMembershipId,
            UUID accountableMembershipId, List<UUID> memberMembershipIds, UUID teamId, LocalDate startOn,
            LocalDate targetOn, LocalDate previousTargetOn, String targetDateReason, String timezone, String lifecycle,
            String lifecycleReason, String mode, Long expectedVersion) {}

    public record ListQuery(String cursor, Integer limit, String q, UUID owner, UUID team, String status, String mode,
            LocalDate from, LocalDate to, Boolean includeArchived) {}

    public record PersonRef(UUID membershipId, String email) {}

    /** percent is null until someone reports progress; label is then "Not reported". */
    public record Progress(BigDecimal percent, String label, Instant reportedAt) {}

    public record ProjectResponse(String id, String key, String name, String description, String mode, String lifecycle,
            boolean archived, String priority, PersonRef projectManager, PersonRef accountable, List<PersonRef> members,
            UUID teamId, String teamName, LocalDate startOn, LocalDate targetOn, String timezone, UUID activeBaselineId,
            long taskCount, Progress progress, boolean canEdit, long version, Instant createdAt, Instant updatedAt) {}

    public record AssignableMember(UUID membershipId, String email, String roleTemplate) {}

    public record TeamOption(UUID id, String name) {}

    public record ProjectOptions(List<AssignableMember> members, List<TeamOption> teams, String defaultTimezone) {}

    public record DateChange(LocalDate previousTargetOn, LocalDate newTargetOn, String reason, String actorEmail,
            Instant occurredAt) {}
}
