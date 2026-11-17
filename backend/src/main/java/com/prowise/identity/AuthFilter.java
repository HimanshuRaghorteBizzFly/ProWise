package com.prowise.identity;

import java.io.IOException;
import java.time.Instant;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiHeaders;
import com.prowise.common.api.ErrorCodes;
import com.prowise.common.api.RequestIdFilter;

@Component
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class AuthFilter extends OncePerRequestFilter {

    public static final String PRINCIPAL_ATTRIBUTE = AuthFilter.class.getName() + ".PRINCIPAL";

    private final JwtService jwtService;
    private final ObjectProvider<JdbcTemplate> jdbc;
    private final ObjectMapper objectMapper;

    public AuthFilter(JwtService jwtService, ObjectProvider<JdbcTemplate> jdbc, ObjectMapper objectMapper) {
        this.jwtService = jwtService;
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String header = request.getHeader(ApiHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }
        try {
            AuthPrincipal principal = jwtService.parse(header.substring("Bearer ".length()));
            JdbcTemplate jdbcTemplate = jdbc.getIfAvailable();
            if (jdbcTemplate == null) {
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
            request.setAttribute(PRINCIPAL_ATTRIBUTE, principal);
            filterChain.doFilter(request, response);
        } catch (RuntimeException exception) {
            writeUnauthorized(request, response);
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
