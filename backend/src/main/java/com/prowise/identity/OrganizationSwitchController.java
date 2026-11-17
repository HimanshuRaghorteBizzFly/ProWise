package com.prowise.identity;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/me/organizations")
@Profile("!test")
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class OrganizationSwitchController {

    private final AuthService authService;

    public OrganizationSwitchController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/{orgId}/switch")
    @PreAuthorize("isAuthenticated()")
    ResponseEntity<AuthController.AccessTokenResponse> switchOrganization(
            @PathVariable UUID orgId,
            Authentication authentication) {
        AuthPrincipal principal = (AuthPrincipal) authentication.getPrincipal();
        return ResponseEntity.ok(new AuthController.AccessTokenResponse(
                authService.switchOrganization(principal, orgId).accessToken()));
    }
}
