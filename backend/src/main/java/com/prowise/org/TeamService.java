package com.prowise.org;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.dao.DuplicateKeyException;
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

/**
 * Task 1.2 (FR-003 / T03): teams, members and leads. Member and lead IDs from another organization are
 * refused as 404 (and the composite foreign keys reject them in the database too). Every change bumps the
 * team version, writes an audit row and an outbox event; lead changes also go to ownership_history.
 */
@Service
public class TeamService {

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;
    private final ChangeRecorder changes;
    private final PeopleHistory history;

    public TeamService(JdbcTemplate jdbc, PermissionService permissions, ChangeRecorder changes, PeopleHistory history) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.changes = changes;
        this.history = history;
    }

    public List<TeamResponse> list(UUID organizationId, Authentication authentication) {
        permissions.require(authentication, organizationId, PermissionKey.TEAM_MANAGE.value());
        List<TeamRow> rows = jdbc.query(TEAM_SELECT + " WHERE t.org_id = ? ORDER BY t.status, lower(t.name)",
                (rs, n) -> teamRow(rs), organizationId);
        Map<UUID, List<TeamMember>> members = new HashMap<>();
        jdbc.query(MEMBER_SELECT + " WHERE tm.org_id = ? ORDER BY lower(u.email)", rs -> {
            members.computeIfAbsent(rs.getObject("team_id", UUID.class), k -> new java.util.ArrayList<>()).add(member(rs));
        }, organizationId);
        return rows.stream().map(row -> row.with(members.getOrDefault(row.id(), List.of()))).toList();
    }

    public TeamResponse get(UUID organizationId, UUID teamId, Authentication authentication) {
        permissions.require(authentication, organizationId, PermissionKey.TEAM_MANAGE.value());
        return find(organizationId, teamId);
    }

    @Transactional
    public TeamResponse create(UUID organizationId, Authentication authentication, TeamRequest request) {
        permissions.require(authentication, organizationId, PermissionKey.TEAM_MANAGE.value());
        UUID actor = permissions.principal(authentication).userId();
        if (request == null) throw validation("name", "is required");
        String name = name(request.name());
        UUID id = UUID.randomUUID();
        try {
            jdbc.update("INSERT INTO teams (id, org_id, name, description) VALUES (?, ?, ?, ?)",
                    id, organizationId, name, description(request.description()));
        } catch (DuplicateKeyException exception) {
            throw duplicate();
        }
        if (request.leadMembershipId() != null) {
            activeMember(organizationId, request.leadMembershipId());
            addMember(organizationId, id, request.leadMembershipId(), actor);
            jdbc.update("UPDATE teams SET lead_membership_id = ? WHERE id = ?", request.leadMembershipId(), id);
            history.ownership(organizationId, "TEAM_LEAD", id.toString(), null, request.leadMembershipId(), "ASSIGNED",
                    actor, null);
        }
        TeamResponse team = find(organizationId, id);
        record(organizationId, actor, "team.created", team, null, snapshot(team), "TeamCreated");
        return team;
    }

    @Transactional
    public TeamResponse update(UUID organizationId, UUID teamId, Authentication authentication, TeamRequest request) {
        TeamResponse before = editable(organizationId, teamId, authentication, request == null ? null : request.expectedVersion());
        String name = name(request.name());
        try {
            bump(organizationId, teamId, request.expectedVersion(),
                    "name = ?, description = ?", name, description(request.description()));
        } catch (DuplicateKeyException exception) {
            throw duplicate();
        }
        TeamResponse team = find(organizationId, teamId);
        record(organizationId, actor(authentication), "team.updated", team, snapshot(before), snapshot(team), "TeamUpdated");
        return team;
    }

    @Transactional
    public TeamResponse archive(UUID organizationId, UUID teamId, Authentication authentication, VersionRequest request) {
        TeamResponse before = editable(organizationId, teamId, authentication, request == null ? null : request.expectedVersion());
        bump(organizationId, teamId, request.expectedVersion(), "status = 'ARCHIVED'");
        TeamResponse team = find(organizationId, teamId);
        record(organizationId, actor(authentication), "team.archived", team, Map.of("status", before.status()),
                Map.of("status", "ARCHIVED"), "TeamArchived");
        return team;
    }

    @Transactional
    public TeamResponse addMember(UUID organizationId, UUID teamId, Authentication authentication, MemberRequest request) {
        editable(organizationId, teamId, authentication, request == null ? null : request.expectedVersion());
        if (request.membershipId() == null) throw validation("membership_id", "is required");
        activeMember(organizationId, request.membershipId());
        UUID actor = actor(authentication);
        Integer existing = jdbc.queryForObject("SELECT count(*) FROM team_members WHERE team_id = ? AND membership_id = ?",
                Integer.class, teamId, request.membershipId());
        if (existing != null && existing > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_TEAM_MEMBER", "This member is already on the team.");
        }
        bump(organizationId, teamId, request.expectedVersion(), null);
        addMember(organizationId, teamId, request.membershipId(), actor);
        TeamResponse team = find(organizationId, teamId);
        record(organizationId, actor, "team.member_added", team, null,
                Map.of("membership_id", request.membershipId().toString()), "TeamMemberAdded");
        return team;
    }

    @Transactional
    public TeamResponse removeMember(UUID organizationId, UUID teamId, UUID membershipId, long expectedVersion,
            Authentication authentication) {
        TeamResponse before = editable(organizationId, teamId, authentication, expectedVersion);
        if (before.members().stream().noneMatch(m -> m.membershipId().equals(membershipId))) {
            throw PermissionService.notFound();
        }
        UUID actor = actor(authentication);
        boolean wasLead = membershipId.equals(before.leadMembershipId());
        bump(organizationId, teamId, expectedVersion, wasLead ? "lead_membership_id = NULL" : null);
        jdbc.update("DELETE FROM team_members WHERE team_id = ? AND org_id = ? AND membership_id = ?",
                teamId, organizationId, membershipId);
        if (wasLead) {
            history.ownership(organizationId, "TEAM_LEAD", teamId.toString(), membershipId, null, "CLEARED", actor,
                    "Lead removed from team");
        }
        TeamResponse team = find(organizationId, teamId);
        record(organizationId, actor, "team.member_removed", team, Map.of("membership_id", membershipId.toString()), null,
                "TeamMemberRemoved");
        return team;
    }

    @Transactional
    public TeamResponse changeLead(UUID organizationId, UUID teamId, Authentication authentication, LeadRequest request) {
        TeamResponse before = editable(organizationId, teamId, authentication, request == null ? null : request.expectedVersion());
        UUID actor = actor(authentication);
        UUID next = request.leadMembershipId();
        if (next != null) activeMember(organizationId, next);
        if (java.util.Objects.equals(next, before.leadMembershipId())) return before;
        bump(organizationId, teamId, request.expectedVersion(), "lead_membership_id = ?", next);
        if (next != null && before.members().stream().noneMatch(m -> m.membershipId().equals(next))) {
            addMember(organizationId, teamId, next, actor);
        }
        history.ownership(organizationId, "TEAM_LEAD", teamId.toString(), before.leadMembershipId(), next,
                next == null ? "CLEARED" : "CHANGED", actor, null);
        TeamResponse team = find(organizationId, teamId);
        Map<String, Object> previous = new LinkedHashMap<>();
        previous.put("lead_membership_id", before.leadMembershipId() == null ? null : before.leadMembershipId().toString());
        Map<String, Object> now = new LinkedHashMap<>();
        now.put("lead_membership_id", next == null ? null : next.toString());
        record(organizationId, actor, "team.lead_changed", team, previous, now, "TeamLeadChanged");
        return team;
    }

    /* ------------------------------------------------------------------ helpers */

    private TeamResponse editable(UUID organizationId, UUID teamId, Authentication authentication, Long expectedVersion) {
        permissions.require(authentication, organizationId, PermissionKey.TEAM_MANAGE.value());
        if (expectedVersion == null) throw validation("expected_version", "is required");
        List<Long> versions = jdbc.queryForList("SELECT version FROM teams WHERE id = ? AND org_id = ? FOR UPDATE",
                Long.class, teamId, organizationId);
        if (versions.isEmpty()) throw PermissionService.notFound();
        ExpectedVersion.check(versions.get(0), expectedVersion);
        TeamResponse team = find(organizationId, teamId);
        if ("ARCHIVED".equals(team.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "TEAM_ARCHIVED", "Archived teams cannot be changed.");
        }
        return team;
    }

    private void bump(UUID organizationId, UUID teamId, long expectedVersion, String set, Object... args) {
        String assignments = (set == null ? "" : set + ", ") + "version = version + 1, updated_at = now()";
        Object[] all = new Object[args.length + 3];
        System.arraycopy(args, 0, all, 0, args.length);
        all[args.length] = teamId;
        all[args.length + 1] = organizationId;
        all[args.length + 2] = expectedVersion;
        ExpectedVersion.requireUpdated(jdbc.update("UPDATE teams SET " + assignments
                + " WHERE id = ? AND org_id = ? AND version = ?", all));
    }

    private void addMember(UUID organizationId, UUID teamId, UUID membershipId, UUID actor) {
        jdbc.update("INSERT INTO team_members (team_id, org_id, membership_id, added_by) VALUES (?, ?, ?, ?)",
                teamId, organizationId, membershipId, actor);
    }

    /** T03: a member or lead must be an ACTIVE membership of this organization; anything else is 404. */
    private void activeMember(UUID organizationId, UUID membershipId) {
        List<String> status = jdbc.queryForList("SELECT status FROM memberships WHERE id = ? AND org_id = ?",
                String.class, membershipId, organizationId);
        if (status.isEmpty()) throw PermissionService.notFound();
        if (!"ACTIVE".equals(status.get(0))) {
            throw new ApiException(HttpStatus.CONFLICT, "MEMBER_INACTIVE", "Only active members can join or lead a team.");
        }
    }

    private void record(UUID organizationId, UUID actor, String action, TeamResponse team, Map<String, ?> previous,
            Map<String, ?> next, String eventType) {
        changes.record(
                new ChangeRecorder.AuditEntry(organizationId, actor, action, "TEAM", team.id(), null, previous, next),
                new ChangeRecorder.DomainEvent(organizationId, "TEAM", team.id(), team.version(), eventType,
                        next == null ? Map.of("team_id", team.id().toString()) : next));
    }

    private UUID actor(Authentication authentication) {
        return permissions.principal(authentication).userId();
    }

    private TeamResponse find(UUID organizationId, UUID teamId) {
        List<TeamRow> rows = jdbc.query(TEAM_SELECT + " WHERE t.org_id = ? AND t.id = ?", (rs, n) -> teamRow(rs),
                organizationId, teamId);
        if (rows.isEmpty()) throw PermissionService.notFound();
        List<TeamMember> members = jdbc.query(MEMBER_SELECT + " WHERE tm.org_id = ? AND tm.team_id = ? ORDER BY lower(u.email)",
                (rs, n) -> member(rs), organizationId, teamId);
        return rows.get(0).with(members);
    }

    private static Map<String, Object> snapshot(TeamResponse team) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("name", team.name());
        snapshot.put("description", team.description());
        return snapshot;
    }

    private static String name(String value) {
        String name = value == null ? "" : value.trim();
        if (name.isEmpty() || name.length() > 120) throw validation("name", "must be 1 to 120 characters");
        return name;
    }

    private static String description(String value) {
        if (value == null || value.isBlank()) return null;
        if (value.trim().length() > 500) throw validation("description", "must be at most 500 characters");
        return value.trim();
    }

    private static ApiException duplicate() {
        return new ApiException(HttpStatus.CONFLICT, "DUPLICATE_TEAM", "A team with this name already exists.");
    }

    private static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The request has invalid fields.",
                List.of(new ApiError.FieldError(field, message)));
    }

    private static final String TEAM_SELECT = """
            SELECT t.id, t.name, t.description, t.status, t.lead_membership_id, lu.email AS lead_email,
                   t.version, t.created_at, t.updated_at
            FROM teams t
            LEFT JOIN memberships lm ON lm.id = t.lead_membership_id AND lm.org_id = t.org_id
            LEFT JOIN users lu ON lu.id = lm.user_id
            """;

    private static final String MEMBER_SELECT = """
            SELECT tm.team_id, tm.membership_id, u.email, m.status, m.role_template, tm.added_at
            FROM team_members tm
            JOIN memberships m ON m.id = tm.membership_id AND m.org_id = tm.org_id
            JOIN users u ON u.id = m.user_id
            """;

    private static TeamRow teamRow(ResultSet rs) throws SQLException {
        return new TeamRow(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("description"),
                rs.getString("status"), rs.getObject("lead_membership_id", UUID.class), rs.getString("lead_email"),
                rs.getLong("version"), rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant());
    }

    private static TeamMember member(ResultSet rs) throws SQLException {
        return new TeamMember(rs.getObject("membership_id", UUID.class), rs.getString("email"), rs.getString("status"),
                rs.getString("role_template"), rs.getTimestamp("added_at").toInstant());
    }

    private record TeamRow(UUID id, String name, String description, String status, UUID leadMembershipId,
            String leadEmail, long version, Instant createdAt, Instant updatedAt) {
        TeamResponse with(List<TeamMember> members) {
            return new TeamResponse(id, name, description, status, leadMembershipId, leadEmail, members, version,
                    createdAt, updatedAt);
        }
    }

    public record TeamRequest(String name, String description, UUID leadMembershipId, Long expectedVersion) {}

    public record VersionRequest(Long expectedVersion) {}

    public record MemberRequest(UUID membershipId, Long expectedVersion) {}

    public record LeadRequest(UUID leadMembershipId, Long expectedVersion) {}

    public record TeamMember(UUID membershipId, String email, String status, String roleTemplate, Instant addedAt) {}

    public record TeamResponse(UUID id, String name, String description, String status, UUID leadMembershipId,
            String leadEmail, List<TeamMember> members, long version, Instant createdAt, Instant updatedAt) {}
}
