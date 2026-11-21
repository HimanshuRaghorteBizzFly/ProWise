package com.prowise.common.api;

import java.io.ByteArrayInputStream;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import com.fasterxml.jackson.databind.ObjectMapper;

import com.prowise.identity.AuthPrincipal;

/**
 * Idempotency-Key for retriable mutations (task 1.4), scoped to caller + organization + route + key.
 *
 * <ul>
 *   <li>Same key and same body: the earlier response is returned again ({@code Idempotent-Replayed: true});
 *       no second record is created.</li>
 *   <li>Same key and a different body: 409 {@code IDEMPOTENCY_KEY_REUSED}.</li>
 *   <li>Same key while the first request is still running: 409 {@code IDEMPOTENCY_IN_PROGRESS}.</li>
 *   <li>Only successful (2xx) responses are stored; a failed attempt can be retried with the same key.</li>
 * </ul>
 * Token-issuing routes are excluded so access tokens are never stored. Requests without an authenticated
 * caller are passed through unchanged.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class IdempotencyFilter extends OncePerRequestFilter {

    public static final String HEADER = "Idempotency-Key";
    public static final String REPLAYED_HEADER = "Idempotent-Replayed";
    private static final Set<String> MUTATIONS = Set.of("POST", "PUT", "PATCH", "DELETE");
    private static final List<String> EXCLUDED_PREFIXES = List.of("/v1/auth/", "/api/v1/auth/", "/v1/me/organizations/");
    private static final int MAX_BODY_BYTES = 1_048_576;
    private static final UUID NO_ORG = new UUID(0L, 0L);

    private final ObjectProvider<JdbcTemplate> jdbcProvider;
    private final ObjectMapper objectMapper;

    public IdempotencyFilter(ObjectProvider<JdbcTemplate> jdbcProvider, ObjectMapper objectMapper) {
        this.jdbcProvider = jdbcProvider;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !MUTATIONS.contains(request.getMethod())
                || request.getHeader(HEADER) == null
                || EXCLUDED_PREFIXES.stream().anyMatch(path::startsWith);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        JdbcTemplate jdbc = jdbcProvider.getIfAvailable();
        AuthPrincipal caller = AuthPrincipal.current(request);
        if (jdbc == null || caller == null || caller.isOperator()) {
            chain.doFilter(request, response);
            return;
        }
        String key = request.getHeader(HEADER).trim();
        if (key.isEmpty() || key.length() > 200) {
            writeError(request, response, 400, ErrorCodes.VALIDATION_FAILED, "Idempotency-Key must be 1 to 200 characters.");
            return;
        }
        byte[] body = request.getInputStream().readNBytes(MAX_BODY_BYTES + 1);
        if (body.length > MAX_BODY_BYTES) {
            writeError(request, response, 413, ErrorCodes.VALIDATION_FAILED, "The request body is too large.");
            return;
        }
        String route = request.getMethod() + " " + request.getRequestURI()
                + (request.getQueryString() == null ? "" : "?" + request.getQueryString());
        String hash = sha256(body);
        UUID orgId = caller.organizationId();

        UUID id = UUID.randomUUID();
        int inserted = jdbc.update("""
                INSERT INTO idempotency_key (id, org_id, caller_id, route, idem_key, request_hash)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT DO NOTHING
                """, id, orgId, caller.userId(), route, key, hash);
        if (inserted == 0) {
            replayOrReject(jdbc, request, response, caller.userId(), orgId, route, key, hash);
            return;
        }

        ContentCachingResponseWrapper wrapped = new ContentCachingResponseWrapper(response);
        boolean stored = false;
        try {
            chain.doFilter(new CachedBodyRequest(request, body), wrapped);
            int status = wrapped.getStatus();
            if (status >= 200 && status < 300) {
                jdbc.update("""
                        UPDATE idempotency_key
                        SET status = 'COMPLETED', response_status = ?, response_body = ?, response_content_type = ?,
                            completed_at = now()
                        WHERE id = ?
                        """, status, new String(wrapped.getContentAsByteArray(), StandardCharsets.UTF_8),
                        wrapped.getContentType(), id);
                stored = true;
            }
        } finally {
            if (!stored) {
                jdbc.update("DELETE FROM idempotency_key WHERE id = ?", id);
            }
            wrapped.copyBodyToResponse();
        }
    }

    private void replayOrReject(
            JdbcTemplate jdbc,
            HttpServletRequest request,
            HttpServletResponse response,
            UUID callerId,
            UUID orgId,
            String route,
            String key,
            String hash) throws IOException {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT request_hash, status, response_status, response_body, response_content_type
                FROM idempotency_key
                WHERE caller_id = ? AND COALESCE(org_id, ?) = ? AND route = ? AND idem_key = ?
                """, callerId, NO_ORG, orgId == null ? NO_ORG : orgId, route, key);
        if (rows.isEmpty()) {
            writeError(request, response, 409, "IDEMPOTENCY_IN_PROGRESS", "A request with this Idempotency-Key is still running.");
            return;
        }
        Map<String, Object> row = rows.get(0);
        if (!hash.equals(row.get("request_hash"))) {
            writeError(request, response, 409, "IDEMPOTENCY_KEY_REUSED",
                    "This Idempotency-Key was already used with a different request.");
            return;
        }
        if (!"COMPLETED".equals(row.get("status"))) {
            writeError(request, response, 409, "IDEMPOTENCY_IN_PROGRESS", "A request with this Idempotency-Key is still running.");
            return;
        }
        response.setStatus(((Number) row.get("response_status")).intValue());
        response.setHeader(REPLAYED_HEADER, "true");
        response.setHeader(ApiHeaders.REQUEST_ID, RequestIdFilter.currentRequestId(request));
        Object contentType = row.get("response_content_type");
        if (contentType != null) response.setContentType(contentType.toString());
        Object stored = row.get("response_body");
        if (stored != null) response.getOutputStream().write(stored.toString().getBytes(StandardCharsets.UTF_8));
    }

    private void writeError(HttpServletRequest request, HttpServletResponse response, int status, String code, String message)
            throws IOException {
        String requestId = RequestIdFilter.currentRequestId(request);
        response.setStatus(status);
        response.setHeader(ApiHeaders.REQUEST_ID, requestId);
        response.setContentType("application/json");
        objectMapper.writeValue(response.getOutputStream(), new ApiError(code, message, requestId, List.of()));
    }

    private static String sha256(byte[] body) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(body));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    /** Lets the controller read the body that was already consumed for hashing. */
    private static final class CachedBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;

        CachedBodyRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream input = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override
                public boolean isFinished() {
                    return input.available() == 0;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener listener) {
                    throw new UnsupportedOperationException();
                }

                @Override
                public int read() {
                    return input.read();
                }

                @Override
                public int read(byte[] b, int off, int len) {
                    return input.read(b, off, len);
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            return new BufferedReader(new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
        }
    }
}
