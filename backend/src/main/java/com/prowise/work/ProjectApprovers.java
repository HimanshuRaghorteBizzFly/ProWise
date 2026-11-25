package com.prowise.work;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.authz.RoleService;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;

/**
 * Who approves a project's work (owner decision 2026-11-25): chosen per project by its creator, stored as a
 * PROJECT-scoped grant of the narrow PROJECT_APPROVER template (project.read + task.review) for that project only.
 *
 * <ul>
 *   <li>Eligible: ACTIVE members of the organization except Organization Owner, Organization Admin and platform
 *       accounts (never offered, never accepted).</li>
 *   <li>Approving needs that project grant: an organization-wide task.review does not count, and nobody approves
 *       their own work (checked where the decision is made).</li>
 *   <li>Every change writes its audit row and outbox event in the caller's transaction.</li>
 * </ul>
 */
@Component
public class ProjectApprovers {

    /** Role templates never offered as assignees or approvers. */
    public static final Set<String> EXCLUDED_ROLES = Set.of("ORGANIZATION_OWNER", "ORGANIZATION_ADMIN", "PLATFORM_OPERATOR");

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;
    private final ChangeRecorder changes;

    public ProjectApprovers(JdbcTemplate jdbc, PermissionService permissions, ChangeRecorder changes) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.changes = changes;
    }

    /**
     * Whether the caller approves this project's work: a PROJECT-scoped task.review grant on exactly this project, or
     * being the project's Project Manager (owner decision 2026-11-25: submissions go to the PM, who accepts or
     * rejects). Self-approval is refused where the decision is made.
     */
    public boolean isApprover(Authentication authentication, UUID orgId, String projectId) {
        if (permissions.hasProjectGrant(authentication, orgId, projectId, PermissionKey.TASK_REVIEW.value())) return true;
        UUID manager = projectManagerUser(orgId, projectId);
        return manager != null && manager.equals(permissions.principal(authentication).userId())
                && permissions.hasActiveMembership(manager, orgId);
    }

    /** The active Project Manager of the project as a user id, or null. */
    public UUID projectManagerUser(UUID orgId, String projectId) {
        return jdbc.query("""
                SELECT m.user_id FROM projects p
                JOIN memberships m ON m.id = p.project_manager_membership_id AND m.org_id = p.org_id AND m.status = 'ACTIVE'
                WHERE p.id = ? AND p.org_id = ?
                """, (rs, n) -> rs.getObject(1, UUID.class), projectId, orgId).stream().findFirst().orElse(null);
    }

    /**
     * An eligible person for assignment or approval: ACTIVE in this organization and not Owner/Admin. Unknown and
     * foreign memberships are 404 (no metadata); an excluded role or inactive member is 422 on {@code field}.
     */
    public UUID eligibleUser(UUID orgId, UUID membershipId, String field) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT user_id, status, role_template FROM memberships WHERE id = ? AND org_id = ?", membershipId, orgId);
        if (rows.isEmpty()) throw PermissionService.notFound();
        Map<String, Object> row = rows.get(0);
        if (!"ACTIVE".equals(row.get("status"))) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "MEMBER_INACTIVE", "Only active members can be chosen.",
                    List.of(new ApiError.FieldError(field, "is not an active member")));
        }
        if (EXCLUDED_ROLES.contains(String.valueOf(row.get("role_template")))) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "ROLE_NOT_ASSIGNABLE",
                    "Organization owners and admins are not assigned to project work.",
                    List.of(new ApiError.FieldError(field, "is an organization owner or admin")));
        }
        return (UUID) row.get("user_id");
    }

    /** Replaces the project's approvers with {@code membershipIds} (validated), recording the change. */
    @Transactional(propagation = Propagation.MANDATORY)
    public List<Approver> replace(UUID orgId, UUID actorId, String projectId, List<UUID> membershipIds) {
        Set<UUID> wanted = new LinkedHashSet<>(membershipIds == null ? List.of() : membershipIds);
        wanted.remove(null);
        if (wanted.size() > 20) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The request has invalid fields.",
                    List.of(new ApiError.FieldError("approver_membership_ids", "at most 20 approvers")));
        }
        for (UUID membershipId : wanted) eligibleUser(orgId, membershipId, "approver_membership_ids");

        List<UUID> before = membershipIds(orgId, projectId);
        for (UUID membershipId : before) {
            if (!wanted.contains(membershipId)) {
                jdbc.update("""
                        DELETE FROM grants WHERE org_id = ? AND membership_id = ? AND scope = 'PROJECT'
                          AND CAST(scope_id AS text) = ? AND template_role_id = ?
                        """, orgId, membershipId, projectId, RoleService.PROJECT_APPROVER_TEMPLATE_ID);
            }
        }
        for (UUID membershipId : wanted) {
            if (before.contains(membershipId)) continue;
            jdbc.update("""
                    INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, scope_id, granted_by)
                    VALUES (?, ?, ?, ?, 'PROJECT', ?, ?)
                    ON CONFLICT DO NOTHING
                    """, UUID.randomUUID(), orgId, membershipId, RoleService.PROJECT_APPROVER_TEMPLATE_ID,
                    UUID.fromString(projectId), actorId);
        }
        List<UUID> after = membershipIds(orgId, projectId);
        if (!new LinkedHashSet<>(before).equals(new LinkedHashSet<>(after))) {
            Map<String, Object> previous = new LinkedHashMap<>();
            previous.put("approver_membership_ids", before.stream().map(UUID::toString).toList());
            Map<String, Object> next = new LinkedHashMap<>();
            next.put("approver_membership_ids", after.stream().map(UUID::toString).toList());
            Map<String, Object> payload = new LinkedHashMap<>(next);
            payload.put("project_id", projectId);
            changes.record(
                    new ChangeRecorder.AuditEntry(orgId, actorId, "project.approvers_changed", "PROJECT",
                            UUID.fromString(projectId), null, previous, next),
                    new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(projectId), after.size(),
                            "ProjectApproversChanged", payload));
        }
        return list(orgId, projectId);
    }

    public List<Approver> list(UUID orgId, String projectId) {
        return jdbc.query("""
                SELECT m.id AS membership_id, u.id AS user_id, u.email, u.name, m.role_template
                FROM grants g JOIN memberships m ON m.id = g.membership_id AND m.org_id = g.org_id
                JOIN users u ON u.id = m.user_id
                WHERE g.org_id = ? AND g.scope = 'PROJECT' AND CAST(g.scope_id AS text) = ? AND g.template_role_id = ?
                  AND m.status = 'ACTIVE'
                ORDER BY lower(COALESCE(u.name, u.email)), m.id
                """, (rs, n) -> new Approver(rs.getObject("membership_id", UUID.class), rs.getObject("user_id", UUID.class),
                        rs.getString("email"), rs.getString("name"), rs.getString("role_template")),
                orgId, projectId, RoleService.PROJECT_APPROVER_TEMPLATE_ID);
    }

    /** Active approvers' user ids (for notifications and queues). */
    public List<UUID> approverUserIds(UUID orgId, String projectId) {
        List<UUID> users = new ArrayList<>(list(orgId, projectId).stream().map(Approver::userId).toList());
        UUID manager = projectManagerUser(orgId, projectId);
        if (manager != null && !users.contains(manager)) users.add(0, manager);
        return users;
    }

    private List<UUID> membershipIds(UUID orgId, String projectId) {
        return jdbc.queryForList("""
                SELECT membership_id FROM grants
                WHERE org_id = ? AND scope = 'PROJECT' AND CAST(scope_id AS text) = ? AND template_role_id = ?
                ORDER BY created_at, membership_id
                """, UUID.class, orgId, projectId, RoleService.PROJECT_APPROVER_TEMPLATE_ID);
    }

    public record Approver(UUID membershipId, UUID userId, String email, String name, String roleTemplate) {}
}
