package com.prowise.superadmin.roles;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping({"/v1/admin/permissions", "/api/v1/admin/permissions"})
@Tag(name = "Super Admin Permissions", description = "Granular platform and organization capabilities catalog")
public class SuperAdminPermissionController {

    private final SuperAdminRoleService roleService;

    public SuperAdminPermissionController(SuperAdminRoleService roleService) {
        this.roleService = roleService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('roles.manage') or hasAuthority('operators.manage')")
    @Operation(summary = "List all granular permissions catalog definitions")
    public ResponseEntity<List<SuperAdminRoleDTOs.PermissionCatalogItem>> getPermissions() {
        return ResponseEntity.ok(roleService.getPermissionsCatalog());
    }
}
