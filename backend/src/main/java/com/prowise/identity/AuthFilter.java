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
        // Sign-in, sign-up, refresh and the emailed-link endpoints start or renew a session; whatever access token
        // the browser still carries (expired, from an old signing key, or a session that must change its password)
        // must never block them. They read no principal; each one does its own credential check.
        if (isSessionEntryPoint(request)) {
            filterChain.doFilter(request, response);
            return;
        }
        String token = null;
        String header = request.getHeader(ApiHeaders.AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ")) {
            token = header.substring("Bearer ".length()).trim();
        } else if (request.getCookies() != null) {
            token = sessionCookie(request);
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

            List<Boolean> active = jdbcTemplate.queryForList(
                    "SELECT u.must_change_password FROM sessions s JOIN users u ON u.id = s.user_id "
                            + "WHERE s.id = ? AND s.user_id = ? AND s.revoked_at IS NULL "
                            + "AND s.expires_at > now() AND u.status = 'ACTIVE'",
                    Boolean.class, principal.sessionId(), principal.userId());
            if (active.size() != 1) {
                writeUnauthorized(request, response);
                return;
            }
            // A forced password change is enforced here, from the account row (not the token claim), so neither an
            // older token nor an organization-switched one can skip it: until the password is changed the session
            // can only read its own identity, change the password, refresh or sign out.
            if (Boolean.TRUE.equals(active.get(0)) && !allowedWhilePasswordChangeRequired(request)) {
                writeForbidden(request, response, "PASSWORD_CHANGE_REQUIRED",
                        "Choose a new password before continuing.");
                return;
            }
            // "My sessions" shows when each device was last active; at most one write per session per minute.
            jdbcTemplate.update("UPDATE sessions SET last_used_at = now() WHERE id = ? "
                    + "AND (last_used_at IS NULL OR last_used_at < now() - interval '1 minute')", principal.sessionId());
            if (principal.organizationId() != null) {
                // The membership must be active and the organization not suspended or archived: either change
                // ends the organization-bound session on its next request.
                Integer member = jdbcTemplate.queryForObject(
                        "SELECT count(*) FROM memberships m JOIN organizations o ON o.id = m.org_id "
                                + "WHERE m.org_id = ? AND m.user_id = ? AND m.status = 'ACTIVE' AND o.state = 'ACTIVE'",
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
            // Operator authority comes only from an operator token (an active platform_operators row with a
            // completed setup, see AuthService.issueSession). A plain user token whose users.role still says
            // PLATFORM_OPERATOR gets no operator authority from that column.
            if (principal.role() != null && !principal.role().isBlank()
                    && !"PLATFORM_OPERATOR".equalsIgnoreCase(principal.role().trim())) {
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

    /** Paths (under /v1 or /api) a session may use while its account must change its password. */
    private static final java.util.Set<String> PASSWORD_CHANGE_PATHS = java.util.Set.of(
            "/auth/change-password", "/auth/password/change", "/auth/logout", "/auth/signout", "/auth/refresh",
            "/me", "/auth/me");

    static boolean allowedWhilePasswordChangeRequired(HttpServletRequest request) {
        return PASSWORD_CHANGE_PATHS.contains(apiPath(request));
    }

    /** Public endpoints (all {@code permitAll}) that create or renew a session; an existing access token is ignored. */
    private static final java.util.Set<String> SESSION_ENTRY_PATHS = java.util.Set.of(
            "/auth/login", "/auth/signin", "/auth/signup", "/auth/refresh",
            "/auth/verify-email", "/auth/email-verification/confirm",
            "/auth/activate-account", "/auth/account-setup/confirm",
            "/auth/forgot-password", "/auth/password-reset/request",
            "/auth/reset-password", "/auth/password-reset/confirm",
            "/auth/operator/login", "/auth/operator/refresh", "/auth/operator/forgot-password",
            "/auth/operator/reset-password", "/auth/operator/accept-invitation",
            "/invitations/public-preview", "/invitations/activate");

    static boolean isSessionEntryPoint(HttpServletRequest request) {
        return "POST".equalsIgnoreCase(request.getMethod()) && SESSION_ENTRY_PATHS.contains(apiPath(request));
    }

    /**
     * One browser can hold both a user session cookie and a platform operator session cookie (the same person signed
     * in both ways). The choice must not depend on the order the browser sends them: the operator session is used for
     * the operator's own session endpoints, the user session everywhere else; either one alone is used as it is.
     */
    private static String sessionCookie(HttpServletRequest request) {
        String user = null;
        String operator = null;
        for (Cookie c : request.getCookies()) {
            if ("prowise_access_token".equals(c.getName()) && user == null) user = c.getValue();
            else if ("prowise_operator_access_token".equals(c.getName()) && operator == null) operator = c.getValue();
        }
        String path = apiPath(request);
        boolean operatorOwnSession = path.startsWith("/auth/operator/") || "/operator/me".equals(path);
        if (operatorOwnSession && operator != null && !operator.isBlank()) return operator;
        return user != null && !user.isBlank() ? user : operator;
    }

    /** The request path without the context path and the /v1, /api/v1 or /api prefix. */
    private static String apiPath(HttpServletRequest request) {
        String path = request.getRequestURI();
        String context = request.getContextPath();
        if (context != null && !context.isEmpty() && path.startsWith(context)) path = path.substring(context.length());
        if (path.startsWith("/api/v1/")) path = path.substring("/api/v1".length());
        else if (path.startsWith("/v1/")) path = path.substring("/v1".length());
        else if (path.startsWith("/api/")) path = path.substring("/api".length());
        if (path.length() > 1 && path.endsWith("/")) path = path.substring(0, path.length() - 1);
        return path;
    }

    private void writeForbidden(HttpServletRequest request, HttpServletResponse response, String code, String message)
            throws IOException {
        String requestId = RequestIdFilter.currentRequestId(request);
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setHeader(ApiHeaders.REQUEST_ID, requestId);
        response.setContentType("application/json");
        objectMapper.writeValue(response.getWriter(), new ApiError(code, message, requestId, java.util.List.of()));
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
