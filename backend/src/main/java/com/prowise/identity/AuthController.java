package com.prowise.identity;

import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.Cookie;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.http.ResponseCookie;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/v1")
@Profile("!test")
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class AuthController {

    private static final String REFRESH_COOKIE = "prowise_refresh_token";
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/auth/signup")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Create an identity and start a session")
    ResponseEntity<AccessTokenResponse> signup(@RequestBody Credentials request) {
        return withRefreshCookie(authService.signup(request.email(), request.password()), 201);
    }

    @PostMapping("/auth/signin")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Sign in and rotate a refresh session")
    ResponseEntity<AccessTokenResponse> signin(@RequestBody Credentials request) {
        return withRefreshCookie(authService.signin(request.email(), request.password()), 200);
    }

    @PostMapping("/auth/refresh")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Rotate the refresh session")
    ResponseEntity<AccessTokenResponse> refresh(HttpServletRequest request, @RequestBody(required = false) RefreshRequest body) {
        String refreshToken = body == null ? null : body.refreshToken();
        if (refreshToken == null) refreshToken = cookieValue(request, REFRESH_COOKIE);
        if (refreshToken == null) refreshToken = "";
        return withRefreshCookie(authService.refresh(refreshToken), 200);
    }

    @PostMapping("/auth/signout")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Revoke the current session")
    ResponseEntity<Void> signout(HttpServletRequest request) {
        authService.signout(AuthPrincipal.require(request));
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString()).build();
    }

    @PostMapping("/auth/password-reset/request")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Request password reset instructions")
    ResponseEntity<Void> requestPasswordReset(@RequestBody EmailRequest request) {
        authService.requestPasswordReset(request.email());
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/auth/password-reset/confirm")
    @PreAuthorize("permitAll()")
    @Operation(summary = "Confirm a password reset")
    ResponseEntity<Void> confirmPasswordReset(@RequestBody PasswordResetRequest request) {
        authService.confirmPasswordReset(request.token(), request.password());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get the authenticated identity and active memberships")
    AuthService.MeResponse me(HttpServletRequest request) {
        return authService.me(AuthPrincipal.require(request).userId());
    }

    public record Credentials(String email, String password) {}
    public record RefreshRequest(String refreshToken) {}
    public record EmailRequest(String email) {}
    public record PasswordResetRequest(String token, String password) {}
    public record AccessTokenResponse(String accessToken) {}

    static ResponseEntity<AccessTokenResponse> withRefreshCookie(AuthService.TokenPair tokens, int status) {
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, refreshCookie(tokens.refreshToken()).toString())
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

    private static ResponseCookie refreshCookie(String value) {
        return ResponseCookie.from(REFRESH_COOKIE, value)
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path("/api/v1/auth")
                .maxAge(java.time.Duration.ofDays(30))
                .build();
    }

    private static ResponseCookie clearRefreshCookie() {
        return ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path("/api/v1/auth")
                .maxAge(java.time.Duration.ZERO)
                .build();
    }
}
