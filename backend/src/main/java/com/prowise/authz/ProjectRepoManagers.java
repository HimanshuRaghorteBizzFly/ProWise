package com.prowise.authz;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.change.ChangeRecorder;

/**
 * Owner decision 2026-11-25: a project's creator and its Project Manager may connect THAT project's GitHub repository.
 * Stored as a PROJECT-scoped grant of the narrow PROJECT_REPO_MANAGER template (project.read, repo.connect, repo.read);
 * nobody gets organization-wide repo.connect from it. Owner/Admin (who already hold it org-wide) are skipped.
 */
@Component
public class ProjectRepoManagers {

    public static final UUID TEMPLATE_ID = UUID.fromString("10000000-0000-0000-0000-000000000010");
    private static final Set<String> SKIPPED = Set.of("ORGANIZATION_OWNER", "ORGANIZATION_ADMIN", "PLATFORM_OPERATOR");

    private final JdbcTemplate jdbc;
    private final ChangeRecorder changes;

    public ProjectRepoManagers(JdbcTemplate jdbc, ChangeRecorder changes) {
        this.jdbc = jdbc;
        this.changes = changes;
    }

    /** Grants the project-scoped repository role to each membership (if active and not Owner/Admin); idempotent. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void grant(UUID orgId, String projectId, UUID actorId, List<UUID> membershipIds) {
        UUID project;
        try {
            project = UUID.fromString(projectId);
        } catch (IllegalArgumentException legacyId) {
            return; // legacy text ids cannot carry PROJECT grants
        }
        for (UUID membershipId : membershipIds) {
            if (membershipId == null) continue;
            List<String> roles = jdbc.queryForList(
                    "SELECT role_template FROM memberships WHERE id = ? AND org_id = ? AND status = 'ACTIVE'", String.class,
                    membershipId, orgId);
            if (roles.isEmpty() || SKIPPED.contains(roles.get(0))) continue;
            int added = jdbc.update("""
                    INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, scope_id, granted_by)
                    VALUES (?, ?, ?, ?, 'PROJECT', ?, ?)
                    ON CONFLICT DO NOTHING
                    """, UUID.randomUUID(), orgId, membershipId, TEMPLATE_ID, project, actorId);
            if (added > 0) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("membership_id", membershipId.toString());
                data.put("role", "PROJECT_REPO_MANAGER");
                data.put("project_id", projectId);
                changes.record(new ChangeRecorder.AuditEntry(orgId, actorId, "role.granted", "MEMBERSHIP", membershipId,
                        "Project creator or project manager may connect this project's repository", null, data),
                        new ChangeRecorder.DomainEvent(orgId, "GRANT", membershipId, 0L, "RoleGranted", data));
            }
        }
    }

    /** The caller's active membership in the organization, or null. */
    public UUID membershipOf(UUID orgId, UUID userId) {
        return jdbc.query("SELECT id FROM memberships WHERE org_id = ? AND user_id = ? AND status = 'ACTIVE'",
                (rs, n) -> rs.getObject(1, UUID.class), orgId, userId).stream().findFirst().orElse(null);
    }
}
