package com.prowise.superadmin.roles;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping({"/v1/admin/permissions", "/api/v1/admin/permissions"})
@Tag(name = "Super Admin Permissions", description = "Capability catalog grouped by module, built from what the "
        + "system enforces (PermissionKey, operator permissions, platform root authority)")
public class SuperAdminPermissionController {

    private final SuperAdminRoleService roleService;

    public SuperAdminPermissionController(SuperAdminRoleService roleService) {
        this.roleService = roleService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Capability catalog grouped by module")
    public SuperAdminRoleDTOs.PermissionCatalogResponse getPermissions() {
        return roleService.getPermissionsCatalog();
    }
}
