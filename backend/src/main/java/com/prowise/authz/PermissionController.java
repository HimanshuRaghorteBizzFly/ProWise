package com.prowise.authz;

import java.util.List;
import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/me")
public class PermissionController {

    private final PermissionService permissions;

    public PermissionController(PermissionService permissions) {
        this.permissions = permissions;
    }

    @GetMapping("/permissions")
    @PreAuthorize("isAuthenticated()")
    PermissionsResponse permissions(
            Authentication authentication,
            @RequestParam("org") UUID organizationId) {
        return new PermissionsResponse(organizationId, permissions.permissions(authentication, organizationId));
    }

    public record PermissionsResponse(UUID organizationId, List<String> permissions) {}
}
