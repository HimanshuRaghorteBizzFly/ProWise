package com.prowise.common.api;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerMapping;

import com.prowise.identity.AuthPrincipal;

/**
 * Records every 5xx and every 4xx except 401 and 404 in {@code api_error_logs} for the operator console.
 *
 * <p>Only metadata is stored: method, the route template (or the path with id-like segments masked, never the
 * query string), status, the error code, the caller type/id and the request id. Bodies, headers, tokens and
 * query strings are never read. The write runs after the response is complete, in its own transaction, and
 * any failure is swallowed: recording can neither change nor fail a response. Retention: 90 days, purge not
 * automated yet (see docs/progress.md).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class ApiErrorRecordingFilter extends OncePerRequestFilter {

    public static final String ERROR_CODE_ATTRIBUTE = ApiErrorRecordingFilter.class.getName() + ".CODE";

    private static final Logger log = LoggerFactory.getLogger(ApiErrorRecordingFilter.class);
    private static final Pattern UUID_LIKE = Pattern.compile("(?i)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    private static final Pattern VERSION_SEGMENT = Pattern.compile("v\\d{1,2}");

    private final ObjectProvider<JdbcTemplate> jdbc;
    private final ObjectProvider<PlatformTransactionManager> transactions;

    public ApiErrorRecordingFilter(ObjectProvider<JdbcTemplate> jdbc, ObjectProvider<PlatformTransactionManager> transactions) {
        this.jdbc = jdbc;
        this.transactions = transactions;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            chain.doFilter(request, response);
        } catch (IOException | ServletException | RuntimeException failure) {
            // Escaped every handler: the container answers 500 through the error controller.
            record(request, 500);
            throw failure;
        }
        record(request, response.getStatus());
    }

    static boolean recorded(int status) {
        return status >= 500 || (status >= 400 && status != 401 && status != 404);
    }

    private void record(HttpServletRequest request, int status) {
        if (!recorded(status)) {
            return;
        }
        try {
            JdbcTemplate template = jdbc.getIfAvailable();
            PlatformTransactionManager manager = transactions.getIfAvailable();
            if (template == null || manager == null) {
                return;
            }
            AuthPrincipal principal = AuthPrincipal.current(request);
            String actorType = principal == null ? "ANONYMOUS" : principal.isOperator() ? "OPERATOR" : "USER";
            String actorId = principal == null ? null
                    : principal.isOperator() ? principal.operatorId() : String.valueOf(principal.userId());
            UUID orgId = principal == null ? null : principal.organizationId();
            Object code = request.getAttribute(ERROR_CODE_ATTRIBUTE);
            String method = truncate(request.getMethod(), 10);
            String path = truncate(pathTemplate(request), 300);
            Object requestIdAttribute = request.getAttribute(RequestIdFilter.REQUEST_ID_ATTRIBUTE);
            String requestId = requestIdAttribute == null ? null : truncate(requestIdAttribute.toString(), 100);
            TransactionTemplate tx = new TransactionTemplate(manager);
            tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            tx.executeWithoutResult(s -> template.update("""
                    INSERT INTO api_error_logs (id, org_id, request_id, method, path_template, status, error_code,
                                                actor_type, actor_id, occurred_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, now())
                    """, UUID.randomUUID(), orgId, requestId, method, path, status,
                    code == null ? null : truncate(code.toString(), 80), actorType, truncate(actorId, 100)));
        } catch (RuntimeException ignored) {
            // Best effort: the error log must never break or alter the response. No details logged.
            log.debug("API error log write skipped ({})", ignored.getClass().getSimpleName());
        }
    }

    /** The matched route template, otherwise the path with id-like segments replaced by {id}. Never the query. */
    public static String pathTemplate(HttpServletRequest request) {
        Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        if (pattern instanceof String template && !template.isBlank() && !"/**".equals(template)) {
            return template;
        }
        String uri = request.getRequestURI();
        if (uri == null || uri.isBlank()) {
            return "/";
        }
        StringBuilder out = new StringBuilder();
        for (String segment : uri.split("/")) {
            if (segment.isEmpty()) {
                continue;
            }
            out.append('/').append(idLike(segment) ? "{id}" : segment);
        }
        return out.length() == 0 ? "/" : out.toString();
    }

    private static boolean idLike(String segment) {
        if (VERSION_SEGMENT.matcher(segment).matches()) {
            return false;
        }
        return UUID_LIKE.matcher(segment).find() || segment.length() > 40 || segment.chars().anyMatch(Character::isDigit)
                || segment.contains("%") || segment.contains(";");
    }

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
