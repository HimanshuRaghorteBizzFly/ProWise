package com.prowise.identity;

import java.util.UUID;

import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;

/**
 * Selects the active workspace (T06). Returns an access token bound to the organization and rotates the refresh
 * cookie; the previous session is revoked so old tokens, counts and links cannot keep reading the other workspace.
 * An organization the caller is not an active member of is indistinguishable from an unknown one (404).
 */
@RestController
@RequestMapping("/v1/me/organizations")
@Profile("!test") // same lifecycle as AuthService/AuthController; exercised by TenantAccessIntegrationTest
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class OrganizationSwitchController {

    private final AuthService authService;

    public OrganizationSwitchController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/{orgId}/switch")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Switch the active organization and receive an org-bound access token")
    ResponseEntity<SwitchResponse> switchOrganization(
            @PathVariable UUID orgId,
            Authentication authentication) {
        AuthPrincipal principal = (AuthPrincipal) authentication.getPrincipal();
        AuthService.SwitchResult result = authService.switchOrganizationWithRole(principal, orgId);
        ResponseEntity<AuthController.AccessTokenResponse> withCookies = AuthController.withRefreshCookie(result.tokens(), 200);
        return ResponseEntity.status(200).headers(withCookies.getHeaders())
                .body(new SwitchResponse(result.tokens().accessToken(), result.role(), result.targetDashboardUrl()));
    }

    /** The org-bound token plus the role it carries there and the dashboard to open. */
    public record SwitchResponse(String accessToken, String role, String targetDashboardUrl) {}
}
