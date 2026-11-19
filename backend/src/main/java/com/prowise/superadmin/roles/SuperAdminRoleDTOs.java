package com.prowise.superadmin.roles;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public final class SuperAdminRoleDTOs {

    private SuperAdminRoleDTOs() {}

    public record RoleAssignedUserDTO(
            String id,
            String name,
            String email,
            String department,
            String avatarUrl
    ) {}

    public record AdminRoleResponse(
            String id,
            String name,
            String slug,
            String description,
            boolean isSystem,
            String scope,
            String color,
            String icon,
            List<String> permissions,
            int userCount,
            List<RoleAssignedUserDTO> assignedUsers,
            Integer hierarchyRank,
            String hierarchyTier,
            String hierarchyTitle,
            boolean isActive,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record CreateRoleRequest(
            @NotBlank String name,
            @NotBlank String slug,
            String description,
            String scope,
            String color,
            String icon,
            @NotEmpty List<String> permissions
    ) {}

    public record UpdateRoleRequest(
            String name,
            String description,
            String color,
            String icon,
            List<String> permissions,
            Boolean isActive
    ) {}

    public record CloneRoleRequest(
            @NotBlank String newName,
            @NotBlank String newSlug,
            String description
    ) {}

    public record AssignUsersRequest(
            @NotNull List<String> userIds
    ) {}

    public record PermissionCatalogItem(
            String key,
            String moduleId,
            String actionId,
            String label,
            String description,
            String riskLevel,
            boolean isSensitive,
            boolean isPlatformOnly
    ) {}

    public record PermissionModuleDTO(
            String id,
            String name,
            String description,
            String category,
            List<String> supportedActions
    ) {}
}
