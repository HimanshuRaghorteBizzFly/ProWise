package com.prowise.operator.auth;

import java.util.UUID;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.identity.AuthPrincipal;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping
@Tag(name = "Platform Operator Authentication", description = "Platform operator login, token rotation, and security sessions")
public class OperatorAuthController {

    public static final String REFRESH_COOKIE_NAME = "prowise_operator_refresh_token";
    public static final String ACCESS_COOKIE_NAME = "prowise_operator_access_token";

    private final OperatorAuthService operatorAuthService;

    /** HTTPS-only cookies, from the same setting as user auth (AUTH_SECURE_COOKIES; on in production). */
    private static volatile boolean secureCookies;

    public OperatorAuthController(OperatorAuthService operatorAuthService,
            @org.springframework.beans.factory.annotation.Value("${prowise.auth.secure-cookies:false}") boolean secureCookiesSetting) {
        secureCookies = secureCookiesSetting;
        this.operatorAuthService = operatorAuthService;
    }

    @PostMapping({"/v1/auth/operator/login", "/api/v1/auth/operator/login"})
    @PreAuthorize("permitAll()")
    @Operation(summary = "Authenticate a platform operator with email and password")
    public ResponseEntity<OperatorAuthDTOs.OperatorAuthResponse> login(
            @RequestBody OperatorAuthDTOs.LoginRequest request,
            HttpServletRequest httpRequest
    ) {
        String ip = extractClientIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");

        OperatorAuthDTOs.OperatorAuthResponse response = operatorAuthService.login(
                request.email(),
                request.password(),
                request.rememberMe(),
                ip,
                userAgent
        );

        long cookieMaxAge = Boolean.TRUE.equals(request.rememberMe()) ? 30L * 24 * 3600 : 7L * 24 * 3600;

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, createCookie(REFRESH_COOKIE_NAME, response.refreshToken(), cookieMaxAge).toString())
                .header(HttpHeaders.SET_COOKIE, createCookie(ACCESS_COOKIE_NAME, response.accessToken(), response.expiresIn()).toString())
                .body(response);
    }

    @PostMapping({"/v1/auth/operator/refresh", "/api/v1/auth/operator/refresh"})
    @PreAuthorize("permitAll()")
    @Operation(summary = "Rotate platform operator refresh token and generate new access token")
    public ResponseEntity<OperatorAuthDTOs.OperatorAuthResponse> refresh(
            @RequestBody(required = false) OperatorAuthDTOs.RefreshRequest request,
            HttpServletRequest httpRequest
    ) {
        String token = (request != null && request.refreshToken() != null && !request.refreshToken().isBlank())
                ? request.refreshToken()
                : extractCookieValue(httpRequest, REFRESH_COOKIE_NAME);

        if (token == null) {
            token = extractCookieValue(httpRequest, "prowise_refresh_token");
        }

        String ip = extractClientIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");

        OperatorAuthDTOs.OperatorAuthResponse response = operatorAuthService.refresh(token, ip, userAgent);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, createCookie(REFRESH_COOKIE_NAME, response.refreshToken(), 30L * 24 * 3600).toString())
                .header(HttpHeaders.SET_COOKIE, createCookie(ACCESS_COOKIE_NAME, response.accessToken(), response.expiresIn()).toString())
                .body(response);
    }

    @PostMapping({"/v1/auth/operator/logout", "/api/v1/auth/operator/logout"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Revoke current operator session and clear authentication cookies")
    public ResponseEntity<OperatorAuthDTOs.MessageResponse> logout(HttpServletRequest httpRequest) {
        AuthPrincipal principal = AuthPrincipal.current(httpRequest);
        operatorAuthService.logout(principal);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearCookie(REFRESH_COOKIE_NAME).toString())
                .header(HttpHeaders.SET_COOKIE, clearCookie(ACCESS_COOKIE_NAME).toString())
                .body(new OperatorAuthDTOs.MessageResponse("Successfully signed out."));
    }

    @PostMapping({"/v1/auth/operator/logout-all", "/api/v1/auth/operator/logout-all"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Revoke all active sessions for current platform operator across all devices")
    public ResponseEntity<OperatorAuthDTOs.MessageResponse> logoutAll(HttpServletRequest httpRequest) {
        AuthPrincipal principal = AuthPrincipal.current(httpRequest);
        operatorAuthService.logoutAll(principal);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearCookie(REFRESH_COOKIE_NAME).toString())
                .header(HttpHeaders.SET_COOKIE, clearCookie(ACCESS_COOKIE_NAME).toString())
                .body(new OperatorAuthDTOs.MessageResponse("All active sessions revoked across all devices."));
    }

    @PostMapping({"/v1/auth/operator/forgot-password", "/api/v1/auth/operator/forgot-password"})
    @PreAuthorize("permitAll()")
    @Operation(summary = "Request password reset token for operator account")
    public ResponseEntity<OperatorAuthDTOs.MessageResponse> forgotPassword(
            @RequestBody OperatorAuthDTOs.ForgotPasswordRequest request,
            HttpServletRequest httpRequest
    ) {
        String ip = extractClientIp(httpRequest);
        operatorAuthService.forgotPassword(request.email(), ip);
        return ResponseEntity.ok(new OperatorAuthDTOs.MessageResponse(
                "If the operator account exists and is active, password reset instructions have been dispatched."
        ));
    }

    @PostMapping({"/v1/auth/operator/reset-password", "/api/v1/auth/operator/reset-password"})
    @PreAuthorize("permitAll()")
    @Operation(summary = "Reset operator password with valid single-use reset token")
    public ResponseEntity<OperatorAuthDTOs.MessageResponse> resetPassword(
            @RequestBody OperatorAuthDTOs.ResetPasswordRequest request
    ) {
        operatorAuthService.resetPassword(request.token(), request.newPassword());
        return ResponseEntity.ok(new OperatorAuthDTOs.MessageResponse(
                "Password has been reset successfully. Please sign in with your new credentials."
        ));
    }

    @PostMapping({"/v1/auth/operator/accept-invitation", "/api/v1/auth/operator/accept-invitation"})
    @PreAuthorize("permitAll()")
    @Operation(summary = "Accept operator invitation, establish password, and activate account")
    public ResponseEntity<OperatorAuthDTOs.OperatorAuthResponse> acceptInvitation(
            @RequestBody OperatorAuthDTOs.AcceptInvitationRequest request
    ) {
        OperatorAuthDTOs.OperatorAuthResponse response = operatorAuthService.acceptInvitation(
                request.token(),
                request.newPassword(),
                request.name()
        );

        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, createCookie(REFRESH_COOKIE_NAME, response.refreshToken(), 30L * 24 * 3600).toString())
                .header(HttpHeaders.SET_COOKIE, createCookie(ACCESS_COOKIE_NAME, response.accessToken(), response.expiresIn()).toString())
                .body(response);
    }

    private static ResponseCookie createCookie(String name, String value, long maxAge) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(secureCookies)
                .path("/")
                .sameSite("Lax")
                .maxAge(maxAge)
                .build();
    }

    private static ResponseCookie clearCookie(String name) {
        return ResponseCookie.from(name, "")
                .httpOnly(true)
                .secure(secureCookies)
                .path("/")
                .sameSite("Lax")
                .maxAge(0)
                .build();
    }

    private static String extractCookieValue(HttpServletRequest request, String cookieName) {
        if (request.getCookies() == null) {
            return null;
        }
        for (Cookie cookie : request.getCookies()) {
            if (cookieName.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private static String extractClientIp(HttpServletRequest request) {
        return com.prowise.common.api.ClientAddress.of(request);
    }
}
