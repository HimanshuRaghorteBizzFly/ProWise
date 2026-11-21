package com.prowise.org;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.authz.RoleService;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.identity.AuthPrincipal;

/**
 * Member status, role and departure handover (tasks 1.4 and 1.2).
 *
 * <p>Disable is immediate: the membership turns DISABLED and the member's sessions for this organization are
 * revoked, so the next request is refused. What the person owned (team leads, accountable or managing role on
 * projects) must not be left silently orphaned: a planned departure reassigns all of it to a named ACTIVE
 * member in the same transaction; an emergency disable is allowed without a replacement and opens a visible
 * NEEDS_OWNER handover item per orphaned object. Every step writes membership/ownership history, an audit row
 * and an outbox event.
 */
@Service
public class MembershipService {

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;
    private final RoleService roles;
    private final ChangeRecorder changes;
    private final PeopleHistory history;

    public MembershipService(JdbcTemplate jdbc, PermissionService permissions, RoleService roles, ChangeRecorder changes,
            PeopleHistory history) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.roles = roles;
        this.changes = changes;
        this.history = history;
    }

    /* ------------------------------------------------------------------ status + handover */

    @Transactional
    public MemberStatusResponse changeStatus(UUID organizationId, UUID membershipId, Authentication authentication,
            MemberStatusRequest request) {
        permissions.require(authentication, organizationId, PermissionKey.MEMBER_DISABLE.value());
        AuthPrincipal actor = permissions.principal(authentication);
        String target = request == null || request.status() == null
                ? "" : request.status().trim().toUpperCase(Locale.ROOT);
        if (request == null || (!target.equals("ACTIVE") && !target.equals("DISABLED"))) {
            throw validation("status", "must be ACTIVE or DISABLED");
        }
        String reason = request.reason() == null || request.reason().isBlank() ? null : request.reason().trim();
        if (reason != null && reason.length() > 500) throw validation("reason", "must be at most 500 characters");
        Member member = lockMember(organizationId, membershipId);
        ExpectedVersion.check(member.version(), request.expectedVersion());
        if (actor.userId().equals(member.userId())) {
            throw new ApiException(HttpStatus.CONFLICT, "SELF_DISABLE_DENIED", "You cannot change your own membership status.");
        }
        if ("ORGANIZATION_OWNER".equals(member.roleTemplate())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "OWNER_TRANSFER_REQUIRED",
                    "The owner can only change through ownership transfer.");
        }
        if (target.equals(member.status())) {
            return new MemberStatusResponse(membershipId, member.status(), member.version(), List.of());
        }
        boolean disabling = target.equals("DISABLED");
        List<OwnedItem> owned = disabling ? owned(organizationId, member) : List.of();
        Member replacement = null;
        boolean emergency = Boolean.TRUE.equals(request.emergency());
        if (disabling && request.replacementMembershipId() != null) {
            replacement = eligibleReplacement(organizationId, request.replacementMembershipId(), membershipId);
        } else if (disabling && !owned.isEmpty() && !emergency) {
            throw new ApiException(HttpStatus.CONFLICT, "HANDOVER_REQUIRED",
                    "This member still owns work. Choose a replacement, or use emergency disable.",
                    List.of(new ApiError.FieldError("replacement_membership_id",
                            owned.size() + " item(s) need a new owner")));
        }

        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE memberships SET status = ?, version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, target, membershipId, organizationId, request.expectedVersion()));
        long next = member.version() + 1;
        List<HandoverItem> opened = new ArrayList<>();
        String historyReason = reason;
        if (disabling) {
            // Immediate revocation: sessions bound to this organization end now (the membership check also
            // refuses every later request, including ones holding a still-valid access token).
            jdbc.update("UPDATE sessions SET revoked_at = now() WHERE user_id = ? AND org_id = ? AND revoked_at IS NULL",
                    member.userId(), organizationId);
            if (replacement != null) {
                for (OwnedItem item : owned) {
                    reassign(organizationId, item, member, replacement, actor.userId(), "HANDOVER", reason);
                }
                historyReason = join(reason, "Planned handover to " + replacement.email());
            } else if (emergency) {
                opened = openHandoverItems(organizationId, member, owned, actor.userId());
                historyReason = join(reason, "Emergency disable without a replacement");
            }
        }
        history.membership(organizationId, membershipId, member.userId(), disabling ? "DISABLED" : "ENABLED",
                member.status(), target, member.roleTemplate(), member.roleTemplate(), actor.userId(), historyReason);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("membership_id", membershipId.toString());
        payload.put("user_id", member.userId().toString());
        payload.put("status", target);
        if (disabling) {
            payload.put("handover", replacement != null ? "PLANNED" : emergency ? "EMERGENCY" : "NONE");
            payload.put("replacement_membership_id", replacement == null ? null : replacement.id().toString());
            payload.put("open_handover_items", opened.size());
        }
        changes.record(
                new ChangeRecorder.AuditEntry(organizationId, actor.userId(), disabling ? "member.disabled" : "member.enabled",
                        "MEMBERSHIP", membershipId, historyReason, Map.of("status", member.status()), payload),
                new ChangeRecorder.DomainEvent(organizationId, "MEMBERSHIP", membershipId, next,
                        disabling ? "MemberDisabled" : "MemberEnabled", payload));
        return new MemberStatusResponse(membershipId, target, next, opened);
    }

    /** What a member currently owns (shown before the disable step so the handover can be planned). */
    public MemberOwnershipResponse ownership(UUID organizationId, UUID membershipId, Authentication authentication) {
        permissions.require(authentication, organizationId, PermissionKey.MEMBER_DISABLE.value());
        Member member = member(organizationId, membershipId, false);
        return new MemberOwnershipResponse(member.id(), member.email(), member.status(), member.roleTemplate(),
                member.version(), owned(organizationId, member));
    }

    public List<HandoverItem> handoverItems(UUID organizationId, Authentication authentication, String status) {
        permissions.require(authentication, organizationId, PermissionKey.MEMBER_DISABLE.value());
        String filter = status == null || status.isBlank() ? null : status.trim().toUpperCase(Locale.ROOT);
        return jdbc.query(HANDOVER_SELECT + " WHERE h.org_id = ? AND (CAST(? AS text) IS NULL OR h.status = ?)"
                + " ORDER BY h.status DESC, h.created_at DESC LIMIT 200", (rs, n) -> handover(rs), organizationId, filter,
                filter);
    }

    @Transactional
    public HandoverItem resolveHandover(UUID organizationId, UUID itemId, Authentication authentication,
            ResolveHandoverRequest request) {
        permissions.require(authentication, organizationId, PermissionKey.MEMBER_DISABLE.value());
        AuthPrincipal actor = permissions.principal(authentication);
        if (request == null || request.replacementMembershipId() == null) {
            throw validation("replacement_membership_id", "is required");
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM handover_items WHERE id = ? AND org_id = ? FOR UPDATE", itemId, organizationId);
        if (rows.isEmpty()) throw PermissionService.notFound();
        Map<String, Object> row = rows.get(0);
        ExpectedVersion.check(((Number) row.get("version")).longValue(), request.expectedVersion());
        if (!"NEEDS_OWNER".equals(row.get("status"))) {
            throw new ApiException(HttpStatus.CONFLICT, "HANDOVER_RESOLVED", "This handover item is already resolved.");
        }
        UUID departedId = (UUID) row.get("departed_membership_id");
        Member departed = member(organizationId, departedId, false);
        Member replacement = eligibleReplacement(organizationId, request.replacementMembershipId(), departedId);
        OwnedItem item = new OwnedItem((String) row.get("subject_type"), (String) row.get("subject_id"),
                (String) row.get("subject_label"));
        reassign(organizationId, item, departed, replacement, actor.userId(), "HANDOVER_RESOLVED", null);
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE handover_items SET status = 'RESOLVED', replacement_membership_id = ?, resolved_by = ?,
                    resolved_at = now(), version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, replacement.id(), actor.userId(), itemId, organizationId, request.expectedVersion()));
        HandoverItem resolved = jdbc.query(HANDOVER_SELECT + " WHERE h.id = ? AND h.org_id = ?", (rs, n) -> handover(rs),
                itemId, organizationId).get(0);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("subject_type", item.subjectType());
        payload.put("subject_id", item.subjectId());
        payload.put("replacement_membership_id", replacement.id().toString());
        changes.record(
                new ChangeRecorder.AuditEntry(organizationId, actor.userId(), "handover.resolved", "HANDOVER_ITEM", itemId,
                        null, Map.of("status", "NEEDS_OWNER"), payload),
                new ChangeRecorder.DomainEvent(organizationId, "HANDOVER_ITEM", itemId, resolved.version(),
                        "HandoverResolved", payload));
        return resolved;
    }

    /* ------------------------------------------------------------------ role */

    /**
     * Change a member's role template. Goes through grants (1.3 least privilege): the actor must hold every key
     * of the new role and of the role being removed. The owner role moves only by ownership transfer.
     */
    @Transactional
    public MemberStatusResponse changeRole(UUID organizationId, UUID membershipId, Authentication authentication,
            MemberRoleRequest request) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        AuthPrincipal actor = permissions.principal(authentication);
        if (request == null) throw validation("template_role_id", "is required");
        Member member = lockMember(organizationId, membershipId);
        ExpectedVersion.check(member.version(), request.expectedVersion());
        if ("ORGANIZATION_OWNER".equals(member.roleTemplate())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "OWNER_TRANSFER_REQUIRED",
                    "The owner role can only change through ownership transfer.");
        }
        if (!"ACTIVE".equals(member.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "MEMBER_INACTIVE", "Only active members can change role.");
        }
        boolean self = actor.userId().equals(member.userId());
        String newRole = roles.requireAssignableTemplate(organizationId, authentication, request.templateRoleId(), self,
                "MEMBERSHIP", membershipId.toString());
        roles.requireHoldsTemplate(organizationId, authentication, member.roleTemplate(), "MEMBERSHIP",
                membershipId.toString());
        if (newRole.equals(member.roleTemplate())) {
            return new MemberStatusResponse(membershipId, member.status(), member.version(), List.of());
        }
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE memberships SET role_template = ?, version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, newRole, membershipId, organizationId, request.expectedVersion()));
        // The organization-wide template grant follows the role; project grants and custom roles stay.
        jdbc.update("""
                DELETE FROM grants WHERE org_id = ? AND membership_id = ? AND scope = 'ORG' AND template_role_id IS NOT NULL
                """, organizationId, membershipId);
        jdbc.update("""
                INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by)
                VALUES (?, ?, ?, ?, 'ORG', ?)
                """, UUID.randomUUID(), organizationId, membershipId, request.templateRoleId(), actor.userId());
        history.membership(organizationId, membershipId, member.userId(), "ROLE_CHANGED", member.status(), member.status(),
                member.roleTemplate(), newRole, actor.userId(), null);
        long next = member.version() + 1;
        changes.record(
                new ChangeRecorder.AuditEntry(organizationId, actor.userId(), "member.role_changed", "MEMBERSHIP",
                        membershipId, null, Map.of("role", member.roleTemplate()), Map.of("role", newRole)),
                new ChangeRecorder.DomainEvent(organizationId, "MEMBERSHIP", membershipId, next, "MemberRoleChanged",
                        Map.of("membership_id", membershipId.toString(), "role", newRole)));
        return new MemberStatusResponse(membershipId, member.status(), next, List.of());
    }

    /* ------------------------------------------------------------------ helpers */

    /** Team leads and active project ownership held by this member in this organization. */
    List<OwnedItem> owned(UUID organizationId, Member member) {
        List<OwnedItem> items = new ArrayList<>(jdbc.query("""
                SELECT id, name FROM teams WHERE org_id = ? AND lead_membership_id = ? AND status = 'ACTIVE' ORDER BY name
                """, (rs, n) -> new OwnedItem("TEAM_LEAD", rs.getString("id"), "Lead of team " + rs.getString("name")),
                organizationId, member.id()));
        String user = member.userId().toString();
        items.addAll(jdbc.query("""
                SELECT id, name, accountable_owner_id, project_manager_id FROM projects
                WHERE org_id = ? AND (accountable_owner_id = ? OR project_manager_id = ?)
                  AND lifecycle NOT IN ('DELIVERED', 'CLOSED', 'CANCELLED')
                ORDER BY name
                """, rs -> {
                    List<OwnedItem> projects = new ArrayList<>();
                    while (rs.next()) {
                        if (user.equals(rs.getString("accountable_owner_id"))) {
                            projects.add(new OwnedItem("PROJECT_OWNER", rs.getString("id"),
                                    "Accountable owner of project " + rs.getString("name")));
                        }
                        if (user.equals(rs.getString("project_manager_id"))) {
                            projects.add(new OwnedItem("PROJECT_MANAGER", rs.getString("id"),
                                    "Project manager of " + rs.getString("name")));
                        }
                    }
                    return projects;
                }, organizationId, user, user));
        return items;
    }

    private void reassign(UUID organizationId, OwnedItem item, Member from, Member to, UUID actorId, String changeType,
            String reason) {
        switch (item.subjectType()) {
            case "TEAM_LEAD" -> {
                UUID teamId = UUID.fromString(item.subjectId());
                jdbc.update("""
                        INSERT INTO team_members (team_id, org_id, membership_id, added_by)
                        SELECT ?, ?, ?, ? WHERE NOT EXISTS
                            (SELECT 1 FROM team_members WHERE team_id = ? AND membership_id = ?)
                        """, teamId, organizationId, to.id(), actorId, teamId, to.id());
                jdbc.update("""
                        UPDATE teams SET lead_membership_id = ?, version = version + 1, updated_at = now()
                        WHERE id = ? AND org_id = ? AND status = 'ACTIVE'
                        """, to.id(), teamId, organizationId);
            }
            // Task 2.1: the membership column is the source of truth; the legacy user-id column stays in sync.
            case "PROJECT_OWNER" -> {
                jdbc.update("""
                        UPDATE projects SET accountable_membership_id = ?, accountable_owner_id = ?, version = version + 1,
                            updated_at = now()
                        WHERE id = ? AND org_id = ?
                        """, to.id(), to.userId().toString(), item.subjectId(), organizationId);
                addProjectMember(organizationId, item.subjectId(), to.id(), actorId);
            }
            case "PROJECT_MANAGER" -> {
                jdbc.update("""
                        UPDATE projects SET project_manager_membership_id = ?, project_manager_id = ?, version = version + 1,
                            updated_at = now()
                        WHERE id = ? AND org_id = ?
                        """, to.id(), to.userId().toString(), item.subjectId(), organizationId);
                addProjectMember(organizationId, item.subjectId(), to.id(), actorId);
            }
            default -> { /* MEMBER: nothing to move, the item records that someone checked the departure */ }
        }
        history.ownership(organizationId, item.subjectType(), item.subjectId(), from.id(), to.id(), changeType, actorId,
                reason);
    }

    private void addProjectMember(UUID organizationId, String projectId, UUID membershipId, UUID actorId) {
        jdbc.update("""
                INSERT INTO project_members (project_id, org_id, membership_id, added_by) VALUES (?, ?, ?, ?)
                ON CONFLICT DO NOTHING
                """, projectId, organizationId, membershipId, actorId);
    }

    private List<HandoverItem> openHandoverItems(UUID organizationId, Member member, List<OwnedItem> owned, UUID actorId) {
        List<OwnedItem> items = owned.isEmpty()
                ? List.of(new OwnedItem("MEMBER", member.id().toString(),
                        "Confirm nothing is left without an owner after " + member.email() + " left"))
                : owned;
        for (OwnedItem item : items) {
            jdbc.update("""
                    INSERT INTO handover_items (id, org_id, departed_membership_id, subject_type, subject_id, subject_label)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, UUID.randomUUID(), organizationId, member.id(), item.subjectType(), item.subjectId(),
                    truncate(item.label(), 250));
            if ("TEAM_LEAD".equals(item.subjectType())) {
                // The departed lead no longer leads; the team shows "needs owner" until resolved.
                jdbc.update("""
                        UPDATE teams SET lead_membership_id = NULL, version = version + 1, updated_at = now()
                        WHERE id = ? AND org_id = ?
                        """, UUID.fromString(item.subjectId()), organizationId);
            }
            history.ownership(organizationId, item.subjectType(), item.subjectId(), member.id(), null, "OWNER_UNAVAILABLE",
                    actorId, "Emergency disable");
        }
        return jdbc.query(HANDOVER_SELECT + " WHERE h.org_id = ? AND h.departed_membership_id = ? AND h.status = 'NEEDS_OWNER'"
                + " ORDER BY h.created_at", (rs, n) -> handover(rs), organizationId, member.id());
    }

    private Member eligibleReplacement(UUID organizationId, UUID replacementId, UUID departingId) {
        if (replacementId.equals(departingId)) {
            throw validation("replacement_membership_id", "must be a different member");
        }
        Member replacement = member(organizationId, replacementId, false);
        if (!"ACTIVE".equals(replacement.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "MEMBER_INACTIVE", "The replacement must be an active member.");
        }
        return replacement;
    }

    private Member lockMember(UUID organizationId, UUID membershipId) {
        return member(organizationId, membershipId, true);
    }

    private Member member(UUID organizationId, UUID membershipId, boolean lock) {
        List<Member> rows = jdbc.query("""
                SELECT m.id, m.user_id, u.email, m.status, m.role_template, m.version
                FROM memberships m JOIN users u ON u.id = m.user_id
                WHERE m.id = ? AND m.org_id = ?
                """ + (lock ? " FOR UPDATE OF m" : ""), (rs, n) -> new Member(rs.getObject("id", UUID.class),
                        rs.getObject("user_id", UUID.class), rs.getString("email"), rs.getString("status"),
                        rs.getString("role_template"), rs.getLong("version")), membershipId, organizationId);
        if (rows.isEmpty()) throw PermissionService.notFound();
        return rows.get(0);
    }

    private static final String HANDOVER_SELECT = """
            SELECT h.id, h.departed_membership_id, du.email AS departed_email, h.subject_type, h.subject_id,
                   h.subject_label, h.status, h.replacement_membership_id, ru.email AS replacement_email,
                   h.created_at, h.resolved_at, h.version
            FROM handover_items h
            JOIN memberships dm ON dm.id = h.departed_membership_id AND dm.org_id = h.org_id
            JOIN users du ON du.id = dm.user_id
            LEFT JOIN memberships rm ON rm.id = h.replacement_membership_id AND rm.org_id = h.org_id
            LEFT JOIN users ru ON ru.id = rm.user_id
            """;

    private static HandoverItem handover(java.sql.ResultSet rs) throws java.sql.SQLException {
        Timestamp resolved = rs.getTimestamp("resolved_at");
        return new HandoverItem(rs.getObject("id", UUID.class), rs.getObject("departed_membership_id", UUID.class),
                rs.getString("departed_email"), rs.getString("subject_type"), rs.getString("subject_id"),
                rs.getString("subject_label"), rs.getString("status"),
                rs.getObject("replacement_membership_id", UUID.class), rs.getString("replacement_email"),
                rs.getTimestamp("created_at").toInstant(), resolved == null ? null : resolved.toInstant(),
                rs.getLong("version"));
    }

    private static String join(String first, String second) {
        return first == null ? second : truncate(first + " · " + second, 500);
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The request has invalid fields.",
                List.of(new ApiError.FieldError(field, message)));
    }

    record Member(UUID id, UUID userId, String email, String status, String roleTemplate, long version) {}

    public record OwnedItem(String subjectType, String subjectId, String label) {}

    public record MemberStatusRequest(String status, String reason, long expectedVersion, UUID replacementMembershipId,
            Boolean emergency) {}

    public record MemberRoleRequest(UUID templateRoleId, long expectedVersion) {}

    public record ResolveHandoverRequest(UUID replacementMembershipId, long expectedVersion) {}

    public record MemberStatusResponse(UUID id, String status, long version, List<HandoverItem> openHandoverItems) {}

    public record MemberOwnershipResponse(UUID id, String email, String status, String roleTemplate, long version,
            List<OwnedItem> owned) {}

    public record HandoverItem(UUID id, UUID departedMembershipId, String departedEmail, String subjectType,
            String subjectId, String subjectLabel, String status, UUID replacementMembershipId, String replacementEmail,
            Instant createdAt, Instant resolvedAt, long version) {}
}
