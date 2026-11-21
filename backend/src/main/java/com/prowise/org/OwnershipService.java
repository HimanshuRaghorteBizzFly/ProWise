package com.prowise.org;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
import com.prowise.identity.AuthPrincipal;

/**
 * Task 1.2: organization ownership transfer. Only the current Owner may transfer, only to a different ACTIVE
 * member of the same organization, and only with an explicit confirmation (the organization slug typed back).
 * The organization row is locked, the old owner becomes an Organization Admin and the new owner receives the
 * owner grant in one transaction; unique indexes guarantee exactly one owner membership and one owner grant.
 */
@Service
public class OwnershipService {

    static final UUID OWNER_TEMPLATE_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");
    static final UUID ADMIN_TEMPLATE_ID = UUID.fromString("10000000-0000-0000-0000-000000000002");
    private static final String OWNER = "ORGANIZATION_OWNER";
    private static final String ADMIN = "ORGANIZATION_ADMIN";

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;
    private final ChangeRecorder changes;
    private final PeopleHistory history;

    public OwnershipService(JdbcTemplate jdbc, PermissionService permissions, ChangeRecorder changes,
            PeopleHistory history) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.changes = changes;
        this.history = history;
    }

    public OwnershipResponse current(UUID organizationId, Authentication authentication) {
        permissions.require(authentication, organizationId, PermissionKey.ORG_MANAGE.value());
        Map<String, Object> org = jdbc.queryForMap("SELECT slug, version FROM organizations WHERE id = ?", organizationId);
        Map<String, Object> owner = jdbc.queryForMap("""
                SELECT m.id, u.email FROM memberships m JOIN users u ON u.id = m.user_id
                WHERE m.org_id = ? AND m.role_template = ?
                """, organizationId, OWNER);
        AuthPrincipal actor = permissions.principal(authentication);
        boolean callerIsOwner = jdbc.queryForObject("""
                SELECT count(*) FROM memberships WHERE org_id = ? AND user_id = ? AND role_template = ? AND status = 'ACTIVE'
                """, Integer.class, organizationId, actor.userId(), OWNER) == 1;
        List<EligibleMember> eligible = jdbc.query("""
                SELECT m.id, u.email, m.role_template FROM memberships m JOIN users u ON u.id = m.user_id
                WHERE m.org_id = ? AND m.status = 'ACTIVE' AND m.role_template <> ?
                ORDER BY lower(u.email)
                """, (rs, n) -> new EligibleMember(rs.getObject("id", UUID.class), rs.getString("email"),
                        rs.getString("role_template")), organizationId, OWNER);
        return new OwnershipResponse((UUID) owner.get("id"), (String) owner.get("email"), (String) org.get("slug"),
                ((Number) org.get("version")).longValue(), callerIsOwner, eligible);
    }

    @Transactional
    public TransferResponse transfer(UUID organizationId, Authentication authentication, TransferRequest request) {
        permissions.require(authentication, organizationId, PermissionKey.ORG_MANAGE.value());
        AuthPrincipal actor = permissions.principal(authentication);
        if (request == null || request.newOwnerMembershipId() == null) {
            throw validation("new_owner_membership_id", "is required");
        }
        // Serialize transfers of this organization.
        Map<String, Object> org = jdbc.queryForMap("SELECT slug, version FROM organizations WHERE id = ? FOR UPDATE",
                organizationId);
        List<Map<String, Object>> owners = jdbc.queryForList("""
                SELECT id, user_id, version FROM memberships
                WHERE org_id = ? AND role_template = ? AND status = 'ACTIVE' FOR UPDATE
                """, organizationId, OWNER);
        if (owners.size() != 1 || !actor.userId().equals(owners.get(0).get("user_id"))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "OWNER_ONLY", "Only the current owner can transfer ownership.");
        }
        ExpectedVersion.check(((Number) org.get("version")).longValue(), request.expectedVersion());
        String slug = (String) org.get("slug");
        if (request.confirmation() == null || !slug.equals(request.confirmation().trim())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "CONFIRMATION_REQUIRED",
                    "Type the workspace slug to confirm the transfer.",
                    List.of(new ApiError.FieldError("confirmation", "must equal the workspace slug")));
        }
        UUID oldOwner = (UUID) owners.get(0).get("id");
        UUID newOwner = request.newOwnerMembershipId();
        List<Map<String, Object>> targets = jdbc.queryForList("""
                SELECT user_id, status, role_template FROM memberships WHERE id = ? AND org_id = ? FOR UPDATE
                """, newOwner, organizationId);
        if (targets.isEmpty()) throw PermissionService.notFound();
        Map<String, Object> target = targets.get(0);
        if (newOwner.equals(oldOwner)) {
            throw validation("new_owner_membership_id", "must be a different member");
        }
        if (!"ACTIVE".equals(target.get("status"))) {
            throw new ApiException(HttpStatus.CONFLICT, "MEMBER_INACTIVE", "The new owner must be an active member.");
        }
        String targetPreviousRole = (String) target.get("role_template");

        // 1. Old owner steps down to Organization Admin (membership + grant).
        jdbc.update("UPDATE memberships SET role_template = ?, version = version + 1, updated_at = now() WHERE id = ?",
                ADMIN, oldOwner);
        jdbc.update("DELETE FROM grants WHERE org_id = ? AND template_role_id = ?", organizationId, OWNER_TEMPLATE_ID);
        jdbc.update("""
                INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by)
                SELECT ?, ?, ?, ?, 'ORG', ? WHERE NOT EXISTS (
                    SELECT 1 FROM grants WHERE org_id = ? AND membership_id = ? AND template_role_id = ? AND scope = 'ORG')
                """, UUID.randomUUID(), organizationId, oldOwner, ADMIN_TEMPLATE_ID, actor.userId(), organizationId,
                oldOwner, ADMIN_TEMPLATE_ID);
        // 2. New owner gets the owner membership role and the single owner grant.
        jdbc.update("UPDATE memberships SET role_template = ?, version = version + 1, updated_at = now() WHERE id = ?",
                OWNER, newOwner);
        jdbc.update("""
                INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by)
                VALUES (?, ?, ?, ?, 'ORG', ?)
                """, UUID.randomUUID(), organizationId, newOwner, OWNER_TEMPLATE_ID, actor.userId());
        ExpectedVersion.requireUpdated(jdbc.update(
                "UPDATE organizations SET version = version + 1, updated_at = now() WHERE id = ? AND version = ?",
                organizationId, request.expectedVersion()));

        String reason = request.reason() == null || request.reason().isBlank() ? null : request.reason().trim();
        history.ownership(organizationId, "ORGANIZATION", organizationId.toString(), oldOwner, newOwner, "TRANSFER",
                actor.userId(), reason);
        history.membership(organizationId, oldOwner, actor.userId(), "ROLE_CHANGED", "ACTIVE", "ACTIVE", OWNER, ADMIN,
                actor.userId(), "Ownership transferred");
        history.membership(organizationId, newOwner, (UUID) target.get("user_id"), "ROLE_CHANGED", "ACTIVE", "ACTIVE",
                targetPreviousRole, OWNER, actor.userId(), "Ownership received");
        long version = ((Number) org.get("version")).longValue() + 1;
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("previous_owner_membership_id", oldOwner.toString());
        payload.put("new_owner_membership_id", newOwner.toString());
        changes.record(
                new ChangeRecorder.AuditEntry(organizationId, actor.userId(), "organization.ownership_transferred",
                        "ORGANIZATION", organizationId, reason, Map.of("owner_membership_id", oldOwner.toString()),
                        Map.of("owner_membership_id", newOwner.toString())),
                new ChangeRecorder.DomainEvent(organizationId, "ORGANIZATION", organizationId, version,
                        "OwnershipTransferred", payload));
        return new TransferResponse(organizationId, newOwner, oldOwner, version);
    }

    private static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The request has invalid fields.",
                List.of(new ApiError.FieldError(field, message)));
    }

    public record TransferRequest(UUID newOwnerMembershipId, String confirmation, String reason, long expectedVersion) {}

    public record EligibleMember(UUID membershipId, String email, String roleTemplate) {}

    public record OwnershipResponse(UUID ownerMembershipId, String ownerEmail, String organizationSlug, long version,
            boolean callerIsOwner, List<EligibleMember> eligible) {}

    public record TransferResponse(UUID organizationId, UUID ownerMembershipId, UUID previousOwnerMembershipId,
            long version) {}
}
