package com.prowise.identity;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiHeaders;
import com.prowise.common.api.RequestIdFilter;

/**
 * CSRF defence for cookie authentication. Auth cookies are HttpOnly and SameSite=Lax; on top of that, a state-changing
 * request (POST, PUT, PATCH, DELETE) that would be authenticated by an auth cookie rather than an Authorization header
 * is refused with 403 CSRF_REJECTED when its {@code Origin} is not one of the configured application origins (or the
 * API's own origin). Browsers always send Origin on cross-site writes and cannot attach a custom Authorization header
 * cross-site without a CORS preflight, so a forged form or script on another site is stopped here. Requests without
 * an Origin header (server-to-server clients, the Next.js rewrite proxy) and bearer-token requests are unaffected.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class CookieOriginFilter extends OncePerRequestFilter {

    static final String CODE = "CSRF_REJECTED";
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS", "TRACE");
    private static final Set<String> AUTH_COOKIES = Set.of(
            "prowise_access_token", "prowise_refresh_token",
            "prowise_operator_access_token", "prowise_operator_refresh_token");

    private final Set<String> allowedOrigins;
    private final ObjectMapper objectMapper;

    public CookieOriginFilter(@Value("${prowise.cors.allowed-origins:}") String configuredOrigins, ObjectMapper objectMapper) {
        this.allowedOrigins = Arrays.stream(configuredOrigins.split(","))
                .map(String::trim).filter(origin -> !origin.isEmpty()).map(CookieOriginFilter::normalize)
                .collect(Collectors.toUnmodifiableSet());
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (SAFE_METHODS.contains(request.getMethod().toUpperCase(Locale.ROOT)) || hasBearer(request)
                || !hasAuthCookie(request)) {
            chain.doFilter(request, response);
            return;
        }
        String origin = request.getHeader("Origin");
        if (origin == null || origin.isBlank() || isAllowed(origin, request)) {
            chain.doFilter(request, response);
            return;
        }
        String requestId = RequestIdFilter.currentRequestId(request);
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setHeader(ApiHeaders.REQUEST_ID, requestId);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), new ApiError(CODE,
                "This request came from a site that is not allowed to act on your session.", requestId, List.of()));
    }

    private boolean isAllowed(String origin, HttpServletRequest request) {
        String normalized = normalize(origin);
        if (allowedOrigins.contains(normalized)) return true;
        String self = request.getScheme() + "://" + request.getServerName()
                + (isDefaultPort(request) ? "" : ":" + request.getServerPort());
        return normalize(self).equals(normalized);
    }

    private static boolean isDefaultPort(HttpServletRequest request) {
        int port = request.getServerPort();
        return ("http".equalsIgnoreCase(request.getScheme()) && port == 80)
                || ("https".equalsIgnoreCase(request.getScheme()) && port == 443);
    }

    private static boolean hasBearer(HttpServletRequest request) {
        String header = request.getHeader(ApiHeaders.AUTHORIZATION);
        return header != null && header.startsWith("Bearer ") && header.length() > "Bearer ".length();
    }

    private static boolean hasAuthCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return false;
        for (Cookie cookie : cookies) {
            if (AUTH_COOKIES.contains(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                return true;
            }
        }
        return false;
    }

    private static String normalize(String origin) {
        String value = origin.trim().toLowerCase(Locale.ROOT);
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
