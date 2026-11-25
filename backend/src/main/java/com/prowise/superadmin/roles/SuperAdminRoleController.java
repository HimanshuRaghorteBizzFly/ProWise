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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.superadmin.common.AdminRequests;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping({"/v1/admin/roles", "/api/v1/admin/roles"})
@Tag(name = "Super Admin Roles", description = "Roles & Permissions Governance: the 9 system roles and custom roles, "
        + "persisted. Organization roles are global role templates enforced through tenant grants; Super Admin is "
        + "enforced in code and protected; Platform Operator access is enforced from operator departments. Mutations "
        + "need expected_version (DELETE: ?expectedVersion=; 409 STALE_VERSION when stale) and accept Idempotency-Key.")
public class SuperAdminRoleController {

    private final SuperAdminRoleService roleService;

    public SuperAdminRoleController(SuperAdminRoleService roleService) {
        this.roleService = roleService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List every role with tier, rank, scope, real user counts, capabilities and version")
    public List<SuperAdminRoleDTOs.AdminRoleResponse> listRoles() {
        return roleService.listRoles();
    }

    @GetMapping("/audit-log")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Role and permission change history (admin audit rows, newest first)")
    public List<SuperAdminRoleDTOs.RoleHistoryEntry> auditLog() {
        return roleService.auditLog();
    }

    @GetMapping("/compare")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Side-by-side capabilities of 2 or 3 roles (?ids=a,b,c)")
    public SuperAdminRoleDTOs.CompareResponse compare(@RequestParam("ids") List<String> ids) {
        return roleService.compare(ids);
    }

    @GetMapping("/holder-search")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Roles held by real people whose name or email contains q")
    public List<SuperAdminRoleDTOs.HolderMatchResponse> holderSearch(@RequestParam("q") String q) {
        return roleService.holderSearch(q);
    }

    @PostMapping("/system/resync")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Restore every system role's capability set to the version-controlled baseline "
            + "(body: items with each system role's expected_version)")
    public SuperAdminRoleDTOs.ResyncResponse resync(HttpServletRequest request,
            @RequestBody(required = false) AdminRequests.BulkVersionedRequest body) {
        return roleService.resyncSystemRoles(body, AdminRequests.actor(request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "One role")
    public SuperAdminRoleDTOs.AdminRoleResponse getRole(@PathVariable String id) {
        return roleService.getRole(id);
    }

    @GetMapping("/{id}/holders")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Real people holding the role (up to 200)")
    public List<SuperAdminRoleDTOs.RoleHolderResponse> holders(@PathVariable String id) {
        return roleService.holders(id);
    }

    @GetMapping("/{id}/history")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Change history of one role")
    public List<SuperAdminRoleDTOs.RoleHistoryEntry> history(@PathVariable String id) {
        return roleService.history(id);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Create a custom role (organization scope = a new global template tenants can grant)")
    public ResponseEntity<SuperAdminRoleDTOs.AdminRoleResponse> createRole(HttpServletRequest request,
            @Valid @RequestBody SuperAdminRoleDTOs.CreateRoleRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(roleService.createRole(body, AdminRequests.actor(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Edit name, subtitle, description, color, icon (and tier for custom roles)")
    public SuperAdminRoleDTOs.AdminRoleResponse updateRole(HttpServletRequest request, @PathVariable String id,
            @RequestBody SuperAdminRoleDTOs.UpdateRoleRequest body) {
        return roleService.updateRole(id, body, AdminRequests.actor(request));
    }

    @PutMapping("/{id}/permissions")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Replace the role's capability set (Super Admin can never lose one)")
    public SuperAdminRoleDTOs.AdminRoleResponse updatePermissions(HttpServletRequest request, @PathVariable String id,
            @RequestBody SuperAdminRoleDTOs.UpdatePermissionsRequest body) {
        return roleService.updatePermissions(id, body, AdminRequests.actor(request));
    }

    @PostMapping("/{id}/reset-baseline")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Restore one system role to its baseline (body: expected_version)")
    public SuperAdminRoleDTOs.AdminRoleResponse resetBaseline(HttpServletRequest request, @PathVariable String id,
            @RequestBody(required = false) AdminRequests.VersionRequest body) {
        return roleService.resetToBaseline(id, AdminRequests.expected(body), AdminRequests.actor(request));
    }

    @PostMapping("/{id}/clone")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Copy a role into a new custom role (Super Admin cannot be copied)")
    public ResponseEntity<SuperAdminRoleDTOs.AdminRoleResponse> cloneRole(HttpServletRequest request,
            @PathVariable String id, @Valid @RequestBody SuperAdminRoleDTOs.CloneRoleRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(roleService.cloneRole(id, body, AdminRequests.actor(request)));
    }

    @PostMapping("/{id}/toggle-active")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Activate or deactivate a custom role (body: expected_version)")
    public SuperAdminRoleDTOs.AdminRoleResponse toggleActive(HttpServletRequest request, @PathVariable String id,
            @RequestBody(required = false) AdminRequests.VersionRequest body) {
        return roleService.toggleActive(id, AdminRequests.expected(body), AdminRequests.actor(request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Delete an unused custom role; ?expectedVersion= required")
    public ResponseEntity<Void> deleteRole(HttpServletRequest request, @PathVariable String id,
            @RequestParam(required = false) Long expectedVersion) {
        roleService.deleteRole(id, expectedVersion, AdminRequests.actor(request));
        return ResponseEntity.noContent().build();
    }
}
