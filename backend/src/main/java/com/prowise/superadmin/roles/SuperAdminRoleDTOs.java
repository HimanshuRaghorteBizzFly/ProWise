package com.prowise.superadmin.roles;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Roles &amp; Permissions Governance (Super Admin). JSON is snake_case. Every update/state change carries
 * expected_version (409 STALE_VERSION when stale); DELETE takes ?expectedVersion=.
 */
public final class SuperAdminRoleDTOs {

    private SuperAdminRoleDTOs() {}

    /**
     * One role of the hierarchy. {@code enforcement} says what editing does:
     * ORGANIZATION_TEMPLATE (role_permissions of a global template, effective through tenant grants),
     * PLATFORM_AUTHORITY (Super Admin, enforced in code, locked), OPERATOR_DEPARTMENTS (derived live from operator
     * department permissions, edited under Operators), DEFINITION_ONLY (platform custom role, not assignable).
     */
    public record AdminRoleResponse(
            UUID id,
            String slug,
            String name,
            String subtitle,
            String description,
            String kind,
            String scope,
            int tier,
            String tierName,
            Integer rank,
            String rankLabel,
            boolean isSystem,
            boolean isActive,
            boolean isProtected,
            boolean permissionsEditable,
            boolean assignable,
            String enforcement,
            String enforcementNote,
            String color,
            String icon,
            String templateName,
            List<String> permissions,
            int capabilityCount,
            int catalogSize,
            long userCount,
            long organizationCount,
            Boolean baselineDrift,
            List<String> baselinePermissions,
            String createdBy,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {}

    @Schema(name = "CreateAdminRoleRequest")
    public record CreateRoleRequest(
            @NotBlank String name,
            @Schema(description = "Lowercase letters, digits and dashes; derived from the name when empty") String slug,
            String subtitle,
            String description,
            @Schema(description = "PLATFORM or ORGANIZATION (default ORGANIZATION)") String scope,
            @Schema(description = "1-6; 1 = Platform Governance (platform scope), 2-5 = organization tiers, 6 = Custom Roles (default)") Integer tier,
            String color,
            String icon,
            @Schema(description = "Copy this role's capabilities when permissions is empty") UUID baseRoleId,
            List<String> permissions
    ) {}

    @Schema(name = "UpdateAdminRoleRequest")
    public record UpdateRoleRequest(
            String name,
            String subtitle,
            String description,
            Integer tier,
            String color,
            String icon,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long expectedVersion
    ) {}

    @Schema(name = "UpdateAdminRolePermissionsRequest")
    public record UpdatePermissionsRequest(
            List<String> permissions,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long expectedVersion
    ) {}

    @Schema(name = "CloneAdminRoleRequest")
    public record CloneRoleRequest(
            @NotBlank String newName,
            String newSlug,
            String description,
            Integer tier
    ) {}

    public record CapabilityResponse(
            String key,
            String action,
            String label,
            String description,
            String risk,
            String scope,
            boolean superAdminOnly
    ) {}

    public record CapabilityModuleResponse(
            String id,
            String name,
            String group,
            String scope,
            List<CapabilityResponse> capabilities
    ) {}

    public record PermissionCatalogResponse(
            int total,
            int moduleCount,
            List<CapabilityModuleResponse> modules
    ) {}

    public record RoleHolderResponse(
            String id,
            String name,
            String email,
            String organizationName,
            String detail
    ) {}

    public record HolderMatchResponse(
            UUID roleId,
            String name,
            String email,
            String organizationName
    ) {}

    public record RoleHistoryEntry(
            UUID id,
            String action,
            String summary,
            String actorEmail,
            String targetLabel,
            String severity,
            Instant timestamp
    ) {}

    public record CompareRow(
            String key,
            String label,
            String moduleName,
            List<Boolean> held,
            boolean differs
    ) {}

    public record CompareResponse(
            List<AdminRoleResponse> roles,
            List<CompareRow> rows
    ) {}

    public record ResyncResponse(
            List<String> changed,
            List<AdminRoleResponse> roles
    ) {}
}
