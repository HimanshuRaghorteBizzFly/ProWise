package com.prowise.superadmin.roles;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.prowise.common.api.ApiException;
import com.prowise.superadmin.audit.AuditService;

@Service
public class SuperAdminRoleService {

    private final AuditService auditService;
    private final Map<String, SuperAdminRoleDTOs.AdminRoleResponse> roleStore = new ConcurrentHashMap<>();

    public SuperAdminRoleService(AuditService auditService) {
        this.auditService = auditService;
        initializeSystemRoles();
    }

    private void initializeSystemRoles() {
        // 1. Platform Super Admin (Rank 1)
        roleStore.put("role-super-admin", new SuperAdminRoleDTOs.AdminRoleResponse(
                "role-super-admin",
                "Platform Super Admin",
                "super-admin",
                "Unrestricted governance root across all tenant workspaces, billing engines, and infrastructure.",
                true,
                "PLATFORM",
                "amber",
                "ShieldAlert",
                List.of(
                        "organizations.view", "organizations.create", "organizations.edit", "organizations.delete", "organizations.manage",
                        "billing.view", "billing.manage", "billing.refund",
                        "security.view", "security.manage", "platform.view", "platform.manage", "audit.view"
                ),
                3,
                List.of(
                        new SuperAdminRoleDTOs.RoleAssignedUserDTO("usr-1", "Marcus Vance", "marcus@prowise.io", "Executive Leadership", null),
                        new SuperAdminRoleDTOs.RoleAssignedUserDTO("usr-2", "Elena Rostova", "elena@prowise.io", "Security Operations", null)
                ),
                1,
                "Platform Governance",
                "Platform Root Authority",
                true,
                Instant.now(),
                Instant.now()
        ));

        // 2. Platform Operations Specialist (Rank 2)
        roleStore.put("role-platform-ops", new SuperAdminRoleDTOs.AdminRoleResponse(
                "role-platform-ops",
                "Platform Operations Specialist",
                "platform-ops",
                "Operational oversight over infrastructure health, tenant escalations, and maintenance banners.",
                true,
                "PLATFORM",
                "blue",
                "Activity",
                List.of(
                        "organizations.view", "organizations.manage",
                        "incidents.view", "incidents.manage",
                        "platform.view", "communication.view", "communication.manage"
                ),
                8,
                List.of(
                        new SuperAdminRoleDTOs.RoleAssignedUserDTO("usr-3", "Devon Lee", "devon@prowise.io", "Platform Operations", null)
                ),
                2,
                "Platform Governance",
                "Platform Operations Authority",
                true,
                Instant.now(),
                Instant.now()
        ));

        // 3. Site Reliability Engineer (Rank 3)
        roleStore.put("role-sre", new SuperAdminRoleDTOs.AdminRoleResponse(
                "role-sre",
                "Site Reliability Engineer",
                "sre",
                "Direct management of webhook queues, event telemetry, database backups, and health alerts.",
                true,
                "PLATFORM",
                "emerald",
                "Terminal",
                List.of(
                        "integrations.view", "integrations.manage",
                        "incidents.view", "incidents.manage",
                        "security.view", "platform.view"
                ),
                5,
                List.of(
                        new SuperAdminRoleDTOs.RoleAssignedUserDTO("usr-4", "Jordan Mercer", "jordan@prowise.io", "Site Reliability", null)
                ),
                3,
                "Platform Governance",
                "Infrastructure Reliability Authority",
                true,
                Instant.now(),
                Instant.now()
        ));

        // 4. Organization Owner (Rank 4)
        roleStore.put("role-org-owner", new SuperAdminRoleDTOs.AdminRoleResponse(
                "role-org-owner",
                "Organization Owner",
                "org-owner",
                "Full authority inside the tenant boundary: license quotas, team workspaces, and SSO settings.",
                true,
                "ORGANIZATION",
                "violet",
                "Building2",
                List.of(
                        "workspaces.view", "workspaces.create", "workspaces.manage",
                        "projects.view", "projects.create", "projects.manage",
                        "billing.view", "billing.manage"
                ),
                12,
                List.of(),
                4,
                "Tenant Administration",
                "Tenant Root Authority",
                true,
                Instant.now(),
                Instant.now()
        ));

        // 5. Workspace Administrator (Rank 5)
        roleStore.put("role-workspace-admin", new SuperAdminRoleDTOs.AdminRoleResponse(
                "role-workspace-admin",
                "Workspace Administrator",
                "workspace-admin",
                "Manages project templates, team member permissions, and project allocation within a workspace.",
                true,
                "ORGANIZATION",
                "blue",
                "Briefcase",
                List.of(
                        "projects.view", "projects.create", "projects.manage",
                        "tasks.view", "tasks.create", "tasks.manage"
                ),
                24,
                List.of(),
                5,
                "Tenant Administration",
                "Workspace Management Authority",
                true,
                Instant.now(),
                Instant.now()
        ));

        // 6. Delivery Project Manager (Rank 6)
        roleStore.put("role-project-manager", new SuperAdminRoleDTOs.AdminRoleResponse(
                "role-project-manager",
                "Delivery Project Manager",
                "project-manager",
                "Authoritative oversight over sprint cadence, milestone baselines, and resource scheduling.",
                true,
                "ORGANIZATION",
                "emerald",
                "Calendar",
                List.of(
                        "projects.view", "projects.edit",
                        "tasks.view", "tasks.create", "tasks.edit", "tasks.manage",
                        "reports.view"
                ),
                45,
                List.of(),
                6,
                "Project Execution",
                "Delivery Governance Authority",
                true,
                Instant.now(),
                Instant.now()
        ));

        // 7. QA & Verification Engineer (Rank 7)
        roleStore.put("role-qa-engineer", new SuperAdminRoleDTOs.AdminRoleResponse(
                "role-qa-engineer",
                "QA & Verification Engineer",
                "qa-engineer",
                "Validates verification criteria, conducts exploratory reviews, and approves test evidence.",
                true,
                "ORGANIZATION",
                "amber",
                "CheckCircle2",
                List.of(
                        "tasks.view", "reviews.view", "reviews.create", "reviews.edit", "reviews.approve"
                ),
                38,
                List.of(),
                7,
                "Project Execution",
                "Quality Verification Authority",
                true,
                Instant.now(),
                Instant.now()
        ));

        // 8. Full-Stack Developer (Rank 8)
        roleStore.put("role-developer", new SuperAdminRoleDTOs.AdminRoleResponse(
                "role-developer",
                "Full-Stack Developer",
                "developer",
                "Owns sprint task check-ins, attaches git commits, and submits code review evidence.",
                true,
                "ORGANIZATION",
                "blue",
                "Code",
                List.of(
                        "projects.view", "tasks.view", "tasks.edit"
                ),
                110,
                List.of(),
                8,
                "Project Execution",
                "Contributor Authority",
                true,
                Instant.now(),
                Instant.now()
        ));

        // 9. Executive Delivery Viewer (Rank 9)
        roleStore.put("role-viewer", new SuperAdminRoleDTOs.AdminRoleResponse(
                "role-viewer",
                "Executive Delivery Viewer",
                "viewer",
                "Read-only visibility into milestone roadmaps, executive progress summaries, and velocity trends.",
                true,
                "ORGANIZATION",
                "slate",
                "Eye",
                List.of(
                        "projects.view", "reports.view"
                ),
                22,
                List.of(),
                9,
                "Stakeholder Visibility",
                "Observer Authority",
                true,
                Instant.now(),
                Instant.now()
        ));
    }

    public List<SuperAdminRoleDTOs.AdminRoleResponse> listRoles() {
        return new ArrayList<>(roleStore.values());
    }

    public SuperAdminRoleDTOs.AdminRoleResponse getRole(String id) {
        SuperAdminRoleDTOs.AdminRoleResponse role = roleStore.get(id);
        if (role == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "ROLE_NOT_FOUND", "Role not found: " + id);
        }
        return role;
    }

    public SuperAdminRoleDTOs.AdminRoleResponse createRole(SuperAdminRoleDTOs.CreateRoleRequest req, String actorEmail) {
        String roleId = "role-custom-" + UUID.randomUUID().toString().substring(0, 8);
        String cleanSlug = req.slug().trim().toLowerCase(java.util.Locale.ROOT);

        SuperAdminRoleDTOs.AdminRoleResponse newRole = new SuperAdminRoleDTOs.AdminRoleResponse(
                roleId,
                req.name().trim(),
                cleanSlug,
                req.description(),
                false,
                req.scope() != null ? req.scope() : "ORGANIZATION",
                req.color() != null ? req.color() : "blue",
                req.icon() != null ? req.icon() : "Shield",
                req.permissions(),
                0,
                List.of(),
                null,
                "Custom Roles",
                "Custom Authority",
                true,
                Instant.now(),
                Instant.now()
        );

        roleStore.put(roleId, newRole);

        auditService.logActivity(
                "ROLE",
                "CREATE_ROLE",
                "Created custom RBAC role: " + newRole.name() + " (" + newRole.slug() + ")",
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                newRole.name(),
                "INFO"
        );

        return newRole;
    }

    public SuperAdminRoleDTOs.AdminRoleResponse updateRole(String id, SuperAdminRoleDTOs.UpdateRoleRequest req, String actorEmail) {
        SuperAdminRoleDTOs.AdminRoleResponse existing = getRole(id);

        SuperAdminRoleDTOs.AdminRoleResponse updated = new SuperAdminRoleDTOs.AdminRoleResponse(
                existing.id(),
                req.name() != null ? req.name().trim() : existing.name(),
                existing.slug(), // Keep slug immutable for stability
                req.description() != null ? req.description() : existing.description(),
                existing.isSystem(),
                existing.scope(),
                req.color() != null ? req.color() : existing.color(),
                req.icon() != null ? req.icon() : existing.icon(),
                req.permissions() != null ? req.permissions() : existing.permissions(),
                existing.userCount(),
                existing.assignedUsers(),
                existing.hierarchyRank(),
                existing.hierarchyTier(),
                existing.hierarchyTitle(),
                req.isActive() != null ? req.isActive() : existing.isActive(),
                existing.createdAt(),
                Instant.now()
        );

        roleStore.put(id, updated);

        auditService.logActivity(
                "ROLE",
                "UPDATE_ROLE",
                "Updated RBAC permissions for role: " + updated.name(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                updated.name(),
                "INFO"
        );

        return updated;
    }

    public SuperAdminRoleDTOs.AdminRoleResponse cloneRole(String id, SuperAdminRoleDTOs.CloneRoleRequest req, String actorEmail) {
        SuperAdminRoleDTOs.AdminRoleResponse source = getRole(id);
        String cloneId = "role-custom-" + UUID.randomUUID().toString().substring(0, 8);

        SuperAdminRoleDTOs.AdminRoleResponse clone = new SuperAdminRoleDTOs.AdminRoleResponse(
                cloneId,
                req.newName().trim(),
                req.newSlug().trim().toLowerCase(java.util.Locale.ROOT),
                req.description() != null ? req.description() : ("Clone of " + source.name()),
                false,
                source.scope(),
                source.color(),
                source.icon(),
                new ArrayList<>(source.permissions()),
                0,
                List.of(),
                null,
                "Custom Roles",
                "Cloned Custom Authority",
                true,
                Instant.now(),
                Instant.now()
        );

        roleStore.put(cloneId, clone);

        auditService.logActivity(
                "ROLE",
                "CLONE_ROLE",
                "Cloned role " + source.name() + " to new custom role " + clone.name(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                clone.name(),
                "INFO"
        );

        return clone;
    }

    public void deleteRole(String id, String actorEmail) {
        SuperAdminRoleDTOs.AdminRoleResponse existing = getRole(id);
        if (existing.isSystem()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "CANNOT_DELETE_SYSTEM_ROLE", "System roles are fundamental to platform architecture and cannot be deleted.");
        }

        roleStore.remove(id);

        auditService.logActivity(
                "ROLE",
                "DELETE_ROLE",
                "Deleted custom role " + existing.name(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                existing.name(),
                "WARNING"
        );
    }

    public SuperAdminRoleDTOs.AdminRoleResponse toggleActive(String id, String actorEmail) {
        SuperAdminRoleDTOs.AdminRoleResponse existing = getRole(id);
        if (existing.isSystem()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "CANNOT_DISABLE_SYSTEM_ROLE", "System roles must remain permanently active.");
        }

        boolean newState = !existing.isActive();
        SuperAdminRoleDTOs.AdminRoleResponse updated = new SuperAdminRoleDTOs.AdminRoleResponse(
                existing.id(),
                existing.name(),
                existing.slug(),
                existing.description(),
                existing.isSystem(),
                existing.scope(),
                existing.color(),
                existing.icon(),
                existing.permissions(),
                existing.userCount(),
                existing.assignedUsers(),
                existing.hierarchyRank(),
                existing.hierarchyTier(),
                existing.hierarchyTitle(),
                newState,
                existing.createdAt(),
                Instant.now()
        );

        roleStore.put(id, updated);

        auditService.logActivity(
                "ROLE",
                "TOGGLE_ROLE_ACTIVE",
                (newState ? "Activated" : "Deactivated") + " custom role " + updated.name(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                updated.name(),
                "INFO"
        );

        return updated;
    }

    public List<SuperAdminRoleDTOs.PermissionCatalogItem> getPermissionsCatalog() {
        return List.of(
                new SuperAdminRoleDTOs.PermissionCatalogItem("orgs.view", "organizations", "view", "View Organizations", "View tenant org listings and metadata", "LOW", false, true),
                new SuperAdminRoleDTOs.PermissionCatalogItem("orgs.create", "organizations", "create", "Create Organizations", "Provision new customer organizations", "MEDIUM", false, true),
                new SuperAdminRoleDTOs.PermissionCatalogItem("orgs.edit", "organizations", "edit", "Edit Organizations", "Update organization settings and quotas", "MEDIUM", false, true),
                new SuperAdminRoleDTOs.PermissionCatalogItem("orgs.suspend", "organizations", "suspend", "Suspend Organizations", "Freeze or suspend tenant workspaces", "HIGH", true, true),
                new SuperAdminRoleDTOs.PermissionCatalogItem("orgs.delete", "organizations", "delete", "Delete Organizations", "Permanently delete tenant organization data", "HIGH", true, true),
                new SuperAdminRoleDTOs.PermissionCatalogItem("operators.view", "operators", "view", "View Operators", "List platform staff and shift telemetry", "LOW", false, true),
                new SuperAdminRoleDTOs.PermissionCatalogItem("operators.manage", "operators", "manage", "Manage Operators", "Create, edit, suspend and revoke operators", "HIGH", true, true),
                new SuperAdminRoleDTOs.PermissionCatalogItem("roles.manage", "roles", "manage", "Manage RBAC Roles", "Configure system and custom roles & permissions", "HIGH", true, false),
                new SuperAdminRoleDTOs.PermissionCatalogItem("plans.manage", "plans", "manage", "Manage Billing Plans", "Configure commercial tiers and quotas", "HIGH", false, true),
                new SuperAdminRoleDTOs.PermissionCatalogItem("subscriptions.manage", "subscriptions", "manage", "Manage Subscriptions", "Modify tenant billing cycles and renewals", "HIGH", false, true),
                new SuperAdminRoleDTOs.PermissionCatalogItem("payments.view", "payments", "view", "View Payments", "Review gateway transactions and fees", "LOW", false, true),
                new SuperAdminRoleDTOs.PermissionCatalogItem("payments.refund", "payments", "refund", "Issue Refunds", "Execute partial or full customer refunds", "HIGH", true, true),
                new SuperAdminRoleDTOs.PermissionCatalogItem("invoices.manage", "invoices", "manage", "Manage Invoices", "Create, void, and send invoice reminders", "MEDIUM", false, true),
                new SuperAdminRoleDTOs.PermissionCatalogItem("smtp.configure", "smtp", "configure", "Configure Email Relays", "Manage SMTP credentials and outbound dispatch", "HIGH", true, true),
                new SuperAdminRoleDTOs.PermissionCatalogItem("templates.manage", "templates", "manage", "Manage Email Templates", "Edit system transactional email copies", "MEDIUM", false, true),
                new SuperAdminRoleDTOs.PermissionCatalogItem("announcements.manage", "announcements", "manage", "Manage Announcements", "Publish system-wide maintenance banners", "MEDIUM", false, true),
                new SuperAdminRoleDTOs.PermissionCatalogItem("audit.view", "audit", "view", "View Audit Trails", "Inspect immutable platform audit logs", "LOW", false, true)
        );
    }
}
