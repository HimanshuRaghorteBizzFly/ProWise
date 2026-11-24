package com.prowise.identity;

import java.time.Duration;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

/**
 * The refresh cookie: the only place the refresh token travels. httpOnly, SameSite=Lax, Secure outside local
 * development, and limited to the auth endpoints (AUTH_REFRESH_COOKIE_PATH, the browser-facing path of
 * /auth/refresh and /auth/signout). The access token is never put in a cookie: the client keeps it in memory and
 * sends it as Authorization: Bearer. Responses also clear the cookies older builds set on path "/".
 */
@Component
public class SessionCookies {

    public static final String REFRESH_COOKIE = "prowise_refresh_token";
    static final String LEGACY_ACCESS_COOKIE = "prowise_access_token";

    private final boolean secure;
    private final String path;
    private final Duration maxAge;

    public SessionCookies(@Value("${prowise.auth.cookie-secure}") boolean secure,
            @Value("${prowise.auth.refresh-cookie-path}") String path,
            @Value("${prowise.auth.refresh-token-days}") long refreshTokenDays) {
        this.secure = secure;
        this.path = path;
        this.maxAge = Duration.ofDays(refreshTokenDays);
    }

    /** Access token in the body; the rotated refresh token (if any) only as the cookie. */
    public ResponseEntity<AuthController.AccessTokenResponse> withTokens(AuthService.TokenPair tokens, int status) {
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(status);
        apply(builder, tokens.refreshToken());
        return builder.body(new AuthController.AccessTokenResponse(tokens.accessToken()));
    }

    /** Sets the refresh cookie (when a new token was issued) and clears the legacy path-"/" cookies. */
    public <B extends ResponseEntity.HeadersBuilder<B>> B apply(B builder, String refreshToken) {
        if (refreshToken != null) builder.header(HttpHeaders.SET_COOKIE, refresh(refreshToken).toString());
        return clearLegacy(builder);
    }

    public <B extends ResponseEntity.HeadersBuilder<B>> B clear(B builder) {
        builder.header(HttpHeaders.SET_COOKIE, ResponseCookie.from(REFRESH_COOKIE, "").httpOnly(true).secure(secure)
                .sameSite("Lax").path(path).maxAge(Duration.ZERO).build().toString());
        return clearLegacy(builder);
    }

    /** Clears the refresh cookie on a response that ends in an error. */
    public void clearOn(jakarta.servlet.http.HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(REFRESH_COOKIE, "").httpOnly(true).secure(secure)
                .sameSite("Lax").path(path).maxAge(Duration.ZERO).build().toString());
    }

    private <B extends ResponseEntity.HeadersBuilder<B>> B clearLegacy(B builder) {
        for (String name : new String[] {REFRESH_COOKIE, LEGACY_ACCESS_COOKIE}) {
            if (REFRESH_COOKIE.equals(name) && "/".equals(path)) continue;
            builder.header(HttpHeaders.SET_COOKIE, ResponseCookie.from(name, "").httpOnly(true).secure(secure)
                    .sameSite("Lax").path("/").maxAge(Duration.ZERO).build().toString());
        }
        return builder;
    }

    private ResponseCookie refresh(String value) {
        return ResponseCookie.from(REFRESH_COOKIE, value).httpOnly(true).secure(secure).sameSite("Lax").path(path).maxAge(maxAge).build();
    }

    /** The refresh token from the request cookie (the last one when a legacy and a new cookie are both sent). */
    public static String refreshToken(HttpServletRequest request) {
        String value = null;
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (REFRESH_COOKIE.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) value = cookie.getValue();
            }
        }
        return value;
    }
}
