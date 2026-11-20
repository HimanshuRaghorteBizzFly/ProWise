package com.prowise.superadmin.roles;

import java.util.List;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.identity.AuthPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping({"/v1/admin/roles", "/api/v1/admin/roles"})
@Tag(name = "Super Admin Roles", description = "Platform and organization role-based access control management")
public class SuperAdminRoleController {

    private final SuperAdminRoleService roleService;

    public SuperAdminRoleController(SuperAdminRoleService roleService) {
        this.roleService = roleService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('roles.manage')")
    @Operation(summary = "List all RBAC roles (system and custom)")
    public ResponseEntity<List<SuperAdminRoleDTOs.AdminRoleResponse>> listRoles() {
        return ResponseEntity.ok(roleService.listRoles());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('roles.manage')")
    @Operation(summary = "Get single role details by ID")
    public ResponseEntity<SuperAdminRoleDTOs.AdminRoleResponse> getRole(@PathVariable String id) {
        return ResponseEntity.ok(roleService.getRole(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('roles.manage')")
    @Operation(summary = "Create a custom RBAC role")
    public ResponseEntity<SuperAdminRoleDTOs.AdminRoleResponse> createRole(
            HttpServletRequest request,
            @Valid @RequestBody SuperAdminRoleDTOs.CreateRoleRequest body
    ) {
        AuthPrincipal principal = AuthPrincipal.current(request);
        String actor = principal != null ? principal.email() : "superadmin@prowise.io";
        return ResponseEntity.status(HttpStatus.CREATED).body(roleService.createRole(body, actor));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('roles.manage')")
    @Operation(summary = "Update an existing role permissions or metadata")
    public ResponseEntity<SuperAdminRoleDTOs.AdminRoleResponse> updateRole(
            HttpServletRequest request,
            @PathVariable String id,
            @Valid @RequestBody SuperAdminRoleDTOs.UpdateRoleRequest body
    ) {
        AuthPrincipal principal = AuthPrincipal.current(request);
        String actor = principal != null ? principal.email() : "superadmin@prowise.io";
        return ResponseEntity.ok(roleService.updateRole(id, body, actor));
    }

    @PostMapping("/{id}/clone")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('roles.manage')")
    @Operation(summary = "Clone an existing role into a new custom role")
    public ResponseEntity<SuperAdminRoleDTOs.AdminRoleResponse> cloneRole(
            HttpServletRequest request,
            @PathVariable String id,
            @Valid @RequestBody SuperAdminRoleDTOs.CloneRoleRequest body
    ) {
        AuthPrincipal principal = AuthPrincipal.current(request);
        String actor = principal != null ? principal.email() : "superadmin@prowise.io";
        return ResponseEntity.status(HttpStatus.CREATED).body(roleService.cloneRole(id, body, actor));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('roles.manage')")
    @Operation(summary = "Delete a custom RBAC role (system roles protected)")
    public ResponseEntity<Void> deleteRole(
            HttpServletRequest request,
            @PathVariable String id
    ) {
        AuthPrincipal principal = AuthPrincipal.current(request);
        String actor = principal != null ? principal.email() : "superadmin@prowise.io";
        roleService.deleteRole(id, actor);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/toggle-active")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('roles.manage')")
    @Operation(summary = "Toggle active state of a custom role")
    public ResponseEntity<SuperAdminRoleDTOs.AdminRoleResponse> toggleActive(
            HttpServletRequest request,
            @PathVariable String id
    ) {
        AuthPrincipal principal = AuthPrincipal.current(request);
        String actor = principal != null ? principal.email() : "superadmin@prowise.io";
        return ResponseEntity.ok(roleService.toggleActive(id, actor));
    }
}
