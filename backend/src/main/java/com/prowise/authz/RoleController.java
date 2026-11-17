package com.prowise.authz;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/organizations/{orgId}")
public class RoleController {

    private final RoleService roles;

    public RoleController(RoleService roles) {
        this.roles = roles;
    }

    @GetMapping("/roles")
    @PreAuthorize("@permissionService.can(authentication, #orgId, 'role.manage')")
    List<RoleService.RoleResponse> listRoles(@PathVariable UUID orgId, Authentication authentication) {
        return roles.list(orgId, authentication);
    }

    @PostMapping("/roles")
    @PreAuthorize("@permissionService.can(authentication, #orgId, 'role.manage')")
    ResponseEntity<RoleService.RoleResponse> createRole(
            @PathVariable UUID orgId,
            Authentication authentication,
            @RequestBody RoleService.RoleRequest request) {
        return ResponseEntity.status(201).body(roles.create(orgId, authentication, request));
    }

    @PatchMapping("/roles/{roleId}")
    @PreAuthorize("@permissionService.can(authentication, #orgId, 'role.manage')")
    RoleService.RoleResponse updateRole(
            @PathVariable UUID orgId,
            @PathVariable UUID roleId,
            Authentication authentication,
            @RequestBody RoleService.RoleRequest request) {
        return roles.update(orgId, roleId, authentication, request);
    }

    @DeleteMapping("/roles/{roleId}")
    @PreAuthorize("@permissionService.can(authentication, #orgId, 'role.manage')")
    ResponseEntity<Void> deleteRole(
            @PathVariable UUID orgId,
            @PathVariable UUID roleId,
            Authentication authentication) {
        roles.delete(orgId, roleId, authentication);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/members")
    @PreAuthorize("@permissionService.can(authentication, #orgId, 'role.manage')")
    List<RoleService.MemberResponse> members(
            @PathVariable UUID orgId,
            Authentication authentication,
            @RequestParam(required = false) String cursor) {
        return roles.members(orgId, authentication, cursor);
    }

    @GetMapping("/members/{membershipId}/permissions")
    @PreAuthorize("@permissionService.can(authentication, #orgId, 'role.manage')")
    List<String> memberPermissions(
            @PathVariable UUID orgId,
            @PathVariable UUID membershipId,
            Authentication authentication) {
        return roles.effectivePermissions(orgId, membershipId, authentication);
    }

    @PostMapping("/grants")
    @PreAuthorize("@permissionService.can(authentication, #orgId, 'role.manage')")
    ResponseEntity<RoleService.GrantResponse> grant(
            @PathVariable UUID orgId,
            Authentication authentication,
            @RequestBody RoleService.GrantRequest request) {
        return ResponseEntity.status(201).body(roles.grant(orgId, authentication, request));
    }

    @DeleteMapping("/grants/{grantId}")
    @PreAuthorize("@permissionService.can(authentication, #orgId, 'role.manage')")
    ResponseEntity<Void> revoke(
            @PathVariable UUID orgId,
            @PathVariable UUID grantId,
            @RequestParam long expectedVersion,
            Authentication authentication) {
        roles.revoke(orgId, grantId, expectedVersion, authentication);
        return ResponseEntity.noContent().build();
    }
}
