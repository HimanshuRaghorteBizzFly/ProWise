package com.prowise.identity;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.hibernate.Session;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiHeaders;
import com.prowise.common.api.ErrorCodes;
import com.prowise.common.api.RequestIdFilter;
import com.prowise.authz.TenantContext;

@Component
@org.springframework.core.annotation.Order(org.springframework.core.Ordered.LOWEST_PRECEDENCE - 10) // before IdempotencyFilter
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class AuthFilter extends OncePerRequestFilter {

    public static final String PRINCIPAL_ATTRIBUTE = AuthFilter.class.getName() + ".PRINCIPAL";

    private final JwtService jwtService;
    private final ObjectProvider<JdbcTemplate> jdbc;
    private final ObjectMapper objectMapper;

    @PersistenceContext
    private EntityManager entityManager;

    public AuthFilter(JwtService jwtService, ObjectProvider<JdbcTemplate> jdbc, ObjectMapper objectMapper) {
        this.jwtService = jwtService;
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String token = null;
        String header = request.getHeader(ApiHeaders.AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ")) {
            token = header.substring("Bearer ".length()).trim();
        } else if (request.getCookies() != null) {
            for (Cookie c : request.getCookies()) {
                // Tenant access tokens travel only as Authorization: Bearer (kept in memory by the client); only the
                // separate platform-operator console still uses its cookie.
                if ("prowise_operator_access_token".equals(c.getName())) {
                    token = c.getValue();
                    break;
                }
            }
        }

        // Sign-up, sign-in, refresh, password reset and sign-out must work with a stale access token (expired, or its
        // session revoked by a refresh or workspace switch) still in the Authorization header or the httpOnly cookie:
        // there the stale token is ignored and the request continues as anonymous. Everywhere else it is still a 401.
        // Sign-out continues anonymously too: the controller then revokes the session found from the refresh cookie.
        if (token != null && !token.isBlank() && isLenientPath(request) && !tokenUsable(token)) {
            token = null;
        }

        if (token == null || token.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            AuthPrincipal principal = jwtService.parse(token);
            JdbcTemplate jdbcTemplate = jdbc.getIfAvailable();
            if (jdbcTemplate == null) {
                filterChain.doFilter(request, response);
                return;
            }

            if (principal.isOperator()) {
                Integer opActive = null;
                try {
                    opActive = jdbcTemplate.queryForObject(
                            "SELECT count(*) FROM operator_sessions s JOIN platform_operators o ON o.id = s.operator_id "
                                    + "WHERE s.id = ? AND s.operator_id = ? AND s.revoked = false "
                                    + "AND s.expires_at > now() AND o.status = 'ACTIVE'",
                            Integer.class, principal.sessionId(), principal.operatorId());
                } catch (Exception ignored) {
                }

                if (opActive == null || opActive != 1) {
                    Integer userActive = null;
                    try {
                        userActive = jdbcTemplate.queryForObject(
                                "SELECT count(*) FROM sessions s JOIN users u ON u.id = s.user_id "
                                        + "WHERE s.id = ? AND lower(u.email) = lower(?) AND s.revoked_at IS NULL "
                                        + "AND s.expires_at > now() AND u.status = 'ACTIVE'",
                                Integer.class, principal.sessionId(), principal.email());
                    } catch (Exception ignored) {
                    }

                    if (userActive == null || userActive != 1) {
                        writeUnauthorized(request, response);
                        return;
                    }
                }
                List<GrantedAuthority> authorities = new ArrayList<>();
                authorities.add(new SimpleGrantedAuthority("ROLE_PLATFORM_OPERATOR"));
                authorities.add(new SimpleGrantedAuthority("PLATFORM_OPERATOR"));
                if (principal.role() != null && !principal.role().isBlank()) {
                    authorities.add(new SimpleGrantedAuthority("ROLE_" + principal.role().toUpperCase().replace("-", "_")));
                }
                if (principal.departmentId() != null && !principal.departmentId().isBlank()) {
                    authorities.add(new SimpleGrantedAuthority("DEPT_" + principal.departmentId().toUpperCase().replace("-", "_").replace(" ", "_")));
                }
                request.setAttribute(PRINCIPAL_ATTRIBUTE, principal);
                SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken(principal, null, authorities));
                filterChain.doFilter(request, response);
                return;
            }

            Integer active = jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM sessions s JOIN users u ON u.id = s.user_id "
                            + "WHERE s.id = ? AND s.user_id = ? AND s.revoked_at IS NULL "
                            + "AND s.expires_at > now() AND u.status = 'ACTIVE'",
                    Integer.class, principal.sessionId(), principal.userId());
            if (active == null || active != 1) {
                writeUnauthorized(request, response);
                return;
            }
            if (principal.organizationId() != null) {
                Integer member = jdbcTemplate.queryForObject(
                        "SELECT count(*) FROM memberships WHERE org_id = ? AND user_id = ? AND status = 'ACTIVE'",
                        Integer.class, principal.organizationId(), principal.userId());
                if (member == null || member != 1) {
                    writeUnauthorized(request, response);
                    return;
                }
                TenantContext.setOrganizationId(principal.organizationId());
                entityManager.unwrap(Session.class).enableFilter("tenantFilter")
                        .setParameter("orgId", principal.organizationId());
            }
            List<GrantedAuthority> userAuthorities = new ArrayList<>();
            if (principal.role() != null && !principal.role().isBlank()) {
                String cleanRole = principal.role().toUpperCase().replace("-", "_");
                userAuthorities.add(new SimpleGrantedAuthority("ROLE_" + cleanRole));
                userAuthorities.add(new SimpleGrantedAuthority(cleanRole));
                if ("SUPER_ADMIN".equalsIgnoreCase(cleanRole)) {
                    userAuthorities.add(new SimpleGrantedAuthority("PLATFORM_SUPER_ADMIN"));
                    userAuthorities.add(new SimpleGrantedAuthority("ROLE_PLATFORM_SUPER_ADMIN"));
                }
            }

            request.setAttribute(PRINCIPAL_ATTRIBUTE, principal);
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(principal, null, userAuthorities));
            filterChain.doFilter(request, response);
        } catch (RuntimeException exception) {
            writeUnauthorized(request, response);
        } finally {
            SecurityContextHolder.clearContext();
            TenantContext.clear();
        }
    }

    private static final java.util.Set<String> LENIENT_AUTH_ROUTES = java.util.Set.of(
            "/auth/signup", "/auth/signin", "/auth/login", "/auth/refresh", "/auth/logout", "/auth/signout",
            "/auth/forgot-password", "/auth/reset-password", "/auth/password-reset/request",
            "/auth/password-reset/confirm", "/auth/operator/login");

    /** Public authentication routes (and sign-out), under /v1, /api or /api/v1. */
    static boolean isLenientPath(HttpServletRequest request) {
        String path = request.getRequestURI();
        String context = request.getContextPath();
        if (context != null && !context.isEmpty() && path.startsWith(context)) path = path.substring(context.length());
        for (String prefix : new String[] {"/api/v1", "/v1", "/api"}) {
            if (path.startsWith(prefix + "/") && LENIENT_AUTH_ROUTES.contains(path.substring(prefix.length()))) {
                return true;
            }
        }
        return false;
    }

    /** True when the token parses and its session (user or operator) is still active. */
    private boolean tokenUsable(String token) {
        try {
            AuthPrincipal principal = jwtService.parse(token);
            JdbcTemplate jdbcTemplate = jdbc.getIfAvailable();
            if (jdbcTemplate == null) return false;
            if (principal.isOperator()) {
                Integer active = jdbcTemplate.queryForObject(
                        "SELECT count(*) FROM operator_sessions WHERE id = ? AND revoked = false AND expires_at > now()",
                        Integer.class, principal.sessionId());
                return active != null && active == 1;
            }
            Integer active = jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM sessions s JOIN users u ON u.id = s.user_id "
                            + "WHERE s.id = ? AND s.user_id = ? AND s.revoked_at IS NULL "
                            + "AND s.expires_at > now() AND u.status = 'ACTIVE'",
                    Integer.class, principal.sessionId(), principal.userId());
            if (active == null || active != 1) return false;
            if (principal.organizationId() == null) return true;
            Integer member = jdbcTemplate.queryForObject(
                    "SELECT count(*) FROM memberships WHERE org_id = ? AND user_id = ? AND status = 'ACTIVE'",
                    Integer.class, principal.organizationId(), principal.userId());
            return member != null && member == 1;
        } catch (RuntimeException invalid) {
            return false;
        }
    }

    private void writeUnauthorized(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String requestId = RequestIdFilter.currentRequestId(request);
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setHeader(ApiHeaders.REQUEST_ID, requestId);
        response.setContentType("application/json");
        objectMapper.writeValue(response.getWriter(),
                new ApiError(ErrorCodes.UNAUTHORIZED, "Authentication is required.", requestId, java.util.List.of()));
    }
}
