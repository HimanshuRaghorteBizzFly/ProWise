package com.prowise.identity;

import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.Cookie;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.ResponseCookie;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.security.access.prepost.PreAuthorize;
import com.prowise.org.OrganizationService;

@RestController
@RequestMapping({"/v1", "/api"})
@Profile("!test")
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class AuthController {

    private static final String REFRESH_COOKIE = "prowise_refresh_token";
    private static final String ACCESS_COOKIE = "prowise_access_token";
    /** HTTPS-only auth cookies; on in production (application-prod.yml), off for plain-HTTP local development. */
    private static volatile boolean secureCookies;
    private final AuthService authService;

    public AuthController(AuthService authService,
            @org.springframework.beans.factory.annotation.Value("${prowise.auth.secure-cookies:false}") boolean secureCookiesSetting) {
        this.authService = authService;
        secureCookies = secureCookiesSetting;
    }

    @PostMapping("/auth/signup")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Register an account; a single-use link emailed to the address activates it (no session is issued)")
    public ResponseEntity<MessageResponse> signup(HttpServletRequest httpRequest, @RequestBody SignupRequest request) {
        authService.signup(request.email(), request.password(), request.name(), extractClientIp(httpRequest));
        // Same answer whether or not the address was already registered.
        return ResponseEntity.accepted().body(new MessageResponse(SIGNUP_ACCEPTED));
    }

    @PostMapping({"/auth/verify-email", "/auth/email-verification/confirm"})
    @PreAuthorize("permitAll()")
    @Operation(summary = "Activate a self-registered account with its single-use emailed link")
    public ResponseEntity<Void> verifyEmail(@RequestBody TokenRequest request) {
        authService.verifyEmail(request.token());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/auth/signin")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Sign in and rotate a refresh session")
    public ResponseEntity<AccessTokenResponse> signin(@RequestBody Credentials request) {
        return withRefreshCookie(authService.signin(request.email(), request.password()), 200);
    }

    @PostMapping("/auth/login")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Authenticate user with email and password, returning tokens and role-based redirect target")
    public ResponseEntity<AuthService.AuthResponse> login(
            HttpServletRequest request,
            @RequestBody Credentials credentials) {
        String ip = extractClientIp(request);
        String userAgent = request.getHeader(HttpHeaders.USER_AGENT);
        AuthService.AuthResponse response = authService.login(credentials.email(), credentials.password(),
                credentials.organizationId(), ip, userAgent);

        ResponseCookie accessCookie = ResponseCookie.from(ACCESS_COOKIE, response.accessToken())
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite("Lax")
                .path("/")
                .maxAge(java.time.Duration.ofMinutes(15))
                .build();

        ResponseCookie refreshCookie = ResponseCookie.from(REFRESH_COOKIE, response.refreshToken())
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite("Lax")
                .path("/")
                .maxAge(java.time.Duration.ofDays(30))
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, accessCookie.toString())
                .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                .body(response);
    }

    @PostMapping("/auth/refresh")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Rotate the refresh session")
    public ResponseEntity<AccessTokenResponse> refresh(HttpServletRequest request, @RequestBody(required = false) RefreshRequest body) {
        String refreshToken = body == null ? null : body.refreshToken();
        if (refreshToken == null) refreshToken = cookieValue(request, REFRESH_COOKIE);
        if (refreshToken == null) refreshToken = "";
        return withRefreshCookie(authService.refresh(refreshToken), 200);
    }

    @PostMapping({"/auth/logout", "/auth/signout"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Revoke the current session and clear auth cookies")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        authService.signout(principal);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, clearCookie(ACCESS_COOKIE).toString())
                .header(HttpHeaders.SET_COOKIE, clearCookie(REFRESH_COOKIE).toString())
                .build();
    }

    @PostMapping({"/auth/change-password", "/auth/password/change"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Change password for the authenticated user")
    public ResponseEntity<AuthService.TokenPair> changePassword(
            HttpServletRequest request,
            @RequestBody ChangePasswordRequest body) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        String ip = extractClientIp(request);
        AuthService.TokenPair newTokens = authService.changePassword(
                principal.userId(),
                principal.organizationId(),
                body.currentPassword(),
                body.newPassword(),
                ip
        );

        ResponseCookie accessCookie = ResponseCookie.from(ACCESS_COOKIE, newTokens.accessToken())
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite("Lax")
                .path("/")
                .maxAge(java.time.Duration.ofMinutes(15))
                .build();

        ResponseCookie refreshCookie = ResponseCookie.from(REFRESH_COOKIE, newTokens.refreshToken())
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite("Lax")
                .path("/")
                .maxAge(java.time.Duration.ofDays(30))
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, accessCookie.toString())
                .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                .body(newTokens);
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

    @GetMapping("/me/sessions")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "List my signed-in devices (open sessions); the current one is marked")
    public java.util.List<AuthService.SessionView> sessions(HttpServletRequest request) {
        return authService.sessions(AuthPrincipal.require(request));
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/me/sessions/{sessionId}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Sign one of my devices out")
    public ResponseEntity<Void> revokeSession(HttpServletRequest request,
            @org.springframework.web.bind.annotation.PathVariable UUID sessionId) {
        authService.revokeSession(AuthPrincipal.require(request), sessionId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/me/sessions/revoke-others")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Sign every other device out; this session stays")
    public java.util.Map<String, Integer> revokeOtherSessions(HttpServletRequest request) {
        return java.util.Map.of("revoked", authService.revokeOtherSessions(AuthPrincipal.require(request)));
    }

    static final String SIGNUP_ACCEPTED =
            "If this address can be registered, we have emailed a link to activate the account. Use it, then sign in.";

    /** {@code organizationId} is optional: it signs straight into one of the caller's organizations. */
    public record Credentials(String email, String password, UUID organizationId) {}
    public record SignupRequest(String email, String password, String name) {}
    public record TokenRequest(String token) {}
    public record MessageResponse(String message) {}
    public record RefreshRequest(String refreshToken) {}
    public record EmailRequest(String email) {}
    public record PasswordResetRequest(String token, String password) {}
    public record ChangePasswordRequest(String currentPassword, String newPassword) {}
    public record AccessTokenResponse(String accessToken) {}

    static ResponseEntity<AccessTokenResponse> withRefreshCookie(AuthService.TokenPair tokens, int status) {
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, refreshCookie(tokens.refreshToken()).toString())
                .header(HttpHeaders.SET_COOKIE, accessCookie(tokens.accessToken()).toString())
                .body(new AccessTokenResponse(tokens.accessToken()));
    }

    private static String cookieValue(HttpServletRequest request, String name) {
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (name.equals(cookie.getName())) return cookie.getValue();
            }
        }
        return null;
    }

    private static ResponseCookie accessCookie(String value) {
        return ResponseCookie.from(ACCESS_COOKIE, value)
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite("Lax")
                .path("/")
                .maxAge(java.time.Duration.ofMinutes(15))
                .build();
    }

    private static ResponseCookie refreshCookie(String value) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite("Lax")
                .path("/")
                .maxAge(java.time.Duration.ofDays(30))
                .build();
    }

    private static ResponseCookie clearCookie(String name) {
        return ResponseCookie.from(name, "")
                .httpOnly(true)
                .secure(secureCookies)
                .sameSite("Lax")
                .path("/")
                .maxAge(java.time.Duration.ZERO)
                .build();
    }

    private static String extractClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
    }
}
