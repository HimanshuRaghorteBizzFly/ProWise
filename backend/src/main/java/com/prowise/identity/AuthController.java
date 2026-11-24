package com.prowise.identity;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.org.OrganizationService;

import io.swagger.v3.oas.annotations.Operation;

/**
 * Sessions: a 15-minute access token (JWT, org-bound) in the JSON body, sent back as Authorization: Bearer; a 7-day
 * opaque refresh token only in the httpOnly refresh cookie (SessionCookies), rotated on every refresh.
 */
@RestController
@RequestMapping({"/v1", "/api"})
@Profile("!test")
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class AuthController {

    private final AuthService authService;
    private final SessionCookies cookies;

    public AuthController(AuthService authService, SessionCookies cookies) {
        this.authService = authService;
        this.cookies = cookies;
    }

    @PostMapping("/auth/signup")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Create an organization owner and workspace, then start a session")
    public ResponseEntity<SignupResponse> signup(@RequestBody SignupRequest request) {
        AuthService.SignupResult result = authService.signup(request.email(), request.password(), request.name(),
                request.organization());
        // The session is already bound to the new organization; the client goes straight to the Owner dashboard.
        return cookies.apply(ResponseEntity.status(201), result.tokens().refreshToken())
                .body(new SignupResponse(result.tokens().accessToken(), result.organizationId(),
                        "ORGANIZATION_OWNER", result.targetDashboardUrl()));
    }

    @PostMapping("/auth/signin")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Sign in and start a session")
    public ResponseEntity<AccessTokenResponse> signin(@RequestBody Credentials request) {
        return cookies.withTokens(authService.signin(request.email(), request.password()), 200);
    }

    @PostMapping("/auth/login")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Authenticate with email and password, returning the access token and role-based landing page")
    public ResponseEntity<AuthService.AuthResponse> login(HttpServletRequest request, @RequestBody Credentials credentials) {
        AuthService.AuthResponse response = authService.login(credentials.email(), credentials.password(), extractClientIp(request),
                request.getHeader(HttpHeaders.USER_AGENT));
        return cookies.apply(ResponseEntity.ok(), response.refreshToken()).body(response);
    }

    /** Refresh token only from the httpOnly cookie (never a request body). Rotates it; keeps the org binding. */
    @PostMapping("/auth/refresh")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Rotate the refresh session and get a new access token")
    public ResponseEntity<AccessTokenResponse> refresh(HttpServletRequest request, jakarta.servlet.http.HttpServletResponse response) {
        try {
            return cookies.withTokens(authService.refresh(SessionCookies.refreshToken(request), extractClientIp(request)), 200);
        } catch (com.prowise.common.api.ApiException ended) {
            // An unusable refresh cookie is removed so the browser stops sending it; the error keeps the standard shape.
            cookies.clearOn(response);
            throw ended;
        }
    }

    /** Works with an expired access token too: the session is found from the refresh cookie. Always clears the cookie. */
    @PostMapping({"/auth/logout", "/auth/signout"})
    @PreAuthorize("permitAll()")
    @Operation(summary = "Revoke the current session and clear the refresh cookie")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        AuthPrincipal principal = (AuthPrincipal) request.getAttribute(AuthFilter.PRINCIPAL_ATTRIBUTE);
        authService.signout(principal, SessionCookies.refreshToken(request), extractClientIp(request));
        return cookies.clear(ResponseEntity.status(204)).build();
    }

    @PostMapping({"/auth/logout-all", "/auth/signout-everywhere"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Log out everywhere: revoke every session of the signed-in user")
    public ResponseEntity<Void> logoutEverywhere(HttpServletRequest request) {
        authService.signoutEverywhere(AuthPrincipal.require(request), extractClientIp(request));
        return cookies.clear(ResponseEntity.status(204)).build();
    }

    @PostMapping({"/auth/change-password", "/auth/password/change"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Change password for the authenticated user (other sessions are revoked)")
    public ResponseEntity<AccessTokenResponse> changePassword(HttpServletRequest request, @RequestBody ChangePasswordRequest body) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        AuthService.TokenPair newTokens = authService.changePassword(principal.userId(), body.currentPassword(), body.newPassword(),
                extractClientIp(request));
        return cookies.withTokens(newTokens, 200);
    }

    @PostMapping({"/auth/forgot-password", "/auth/password-reset/request"})
    @PreAuthorize("permitAll()")
    @Operation(summary = "Request password reset instructions")
    public ResponseEntity<Void> forgotPassword(@RequestBody EmailRequest request) {
        authService.requestPasswordReset(request.email());
        return ResponseEntity.accepted().build();
    }

    @PostMapping({"/auth/reset-password", "/auth/password-reset/confirm"})
    @PreAuthorize("permitAll()")
    @Operation(summary = "Confirm a password reset")
    public ResponseEntity<Void> resetPassword(@RequestBody PasswordResetRequest request) {
        authService.confirmPasswordReset(request.token(), request.password());
        return ResponseEntity.noContent().build();
    }

    @PostMapping({"/auth/activate-account", "/auth/account-setup/confirm"})
    @PreAuthorize("permitAll()")
    @Operation(summary = "Activate a pending account with its emailed single-use setup link and a self-chosen password")
    public ResponseEntity<Void> activateAccount(@RequestBody PasswordResetRequest request) {
        authService.activateAccount(request.token(), request.password());
        return ResponseEntity.noContent().build();
    }

    @GetMapping({"/me", "/auth/me"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get the authenticated identity and active memberships")
    public AuthService.ExtendedMeResponse me(HttpServletRequest request) {
        return authService.me(AuthPrincipal.require(request));
    }

    /** Registration result. The request body never chooses the role or organization id. */
    public record SignupResponse(String accessToken, java.util.UUID organizationId, String role,
            String targetDashboardUrl) {}

    public record SignupRequest(String email, String password, String name,
            OrganizationService.CreateOrganizationRequest organization) {}
    public record Credentials(String email, String password) {}
    public record EmailRequest(String email) {}
    public record PasswordResetRequest(String token, String password) {}
    public record ChangePasswordRequest(String currentPassword, String newPassword) {}
    public record AccessTokenResponse(String accessToken) {}

    private static String extractClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
    }
}
