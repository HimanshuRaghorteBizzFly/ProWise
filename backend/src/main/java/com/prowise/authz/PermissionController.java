package com.prowise.authz;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;

@RestController
@RequestMapping("/v1/me")
public class PermissionController {

    private final PermissionService permissions;

    public PermissionController(PermissionService permissions) {
        this.permissions = permissions;
    }

    @GetMapping("/permissions")
    @PreAuthorize("@permissionService.member(authentication, #organizationId)")
    @Operation(summary = "Effective permissions of the caller in the selected organization (ORG keys plus scoped grants)")
    PermissionsResponse permissions(
            Authentication authentication,
            @RequestParam("org") UUID organizationId) {
        List<PermissionService.EffectiveGrant> grants = permissions.grants(authentication, organizationId);
        List<String> orgKeys = grants.stream()
                .filter(grant -> "ORG".equals(grant.scope()))
                .map(PermissionService.EffectiveGrant::key)
                .distinct()
                .sorted()
                .toList();
        return new PermissionsResponse(organizationId, orgKeys, grants);
    }

    /**
     * {@code permissions}: keys granted at ORG scope (kept for older clients).
     * {@code grants}: every effective grant with its scope; PROJECT grants carry the project id.
     */
    public record PermissionsResponse(UUID organizationId, List<String> permissions, List<PermissionService.EffectiveGrant> grants) {}
}
