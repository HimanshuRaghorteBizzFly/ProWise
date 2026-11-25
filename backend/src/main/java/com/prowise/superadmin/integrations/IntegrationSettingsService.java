package com.prowise.superadmin.integrations;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.superadmin.audit.AuditService;

/**
 * Non-secret platform integration configuration (V35, one row). Secrets (GitHub App private key, client secret,
 * webhook secret) are never stored or returned here; they stay in environment variables.
 */
@Service
@Transactional
public class IntegrationSettingsService {

    static final String ROW_ID = "default";
    static final int DEFAULT_MAX_RETRIES = 5;
    static final int DEFAULT_TIMEOUT_SECONDS = 10;
    static final int MAX_EVENT_TYPES = 50;

    /** GitHub App slug: lowercase letters, digits and inner hyphens. Empty = not configured. */
    static final Pattern SLUG = Pattern.compile("^$|^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$");
    /** GitHub OAuth/App client id, for example Iv1.0123abcd or Iv23li...; public, not a secret. Empty = not configured. */
    static final Pattern CLIENT_ID = Pattern.compile("^$|^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$");
    /** GitHub webhook event name, optionally with an action: push, pull_request, pull_request.closed. */
    static final Pattern EVENT_TYPE = Pattern.compile("^[a-z][a-z_]{0,59}(\\.[a-z][a-z_]{0,59})?$");

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final AuditService auditService;

    public IntegrationSettingsService(JdbcTemplate jdbc, ObjectMapper objectMapper, AuditService auditService) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.auditService = auditService;
    }

    public record IntegrationSettingsResponse(
            String githubAppSlug,
            String githubClientId,
            int webhookMaxRetries,
            int webhookTimeoutSeconds,
            boolean webhookSignatureRequired,
            List<String> allowedEventTypes,
            Instant updatedAt,
            String updatedBy,
            long version
    ) {}

    public record UpdateIntegrationSettingsRequest(
            String githubAppSlug,
            String githubClientId,
            Integer webhookMaxRetries,
            Integer webhookTimeoutSeconds,
            Boolean webhookSignatureRequired,
            List<String> allowedEventTypes,
            Long expectedVersion
    ) {}

    /** Returns the settings, creating the default row (empty strings, 5 retries, 10 s, signature required) if missing. */
    public IntegrationSettingsResponse get() {
        ensureRow();
        return read();
    }

    public IntegrationSettingsResponse update(UpdateIntegrationSettingsRequest req, String actorEmail) {
        Valid valid = validate(req);
        long expected = ExpectedVersion.required(req.expectedVersion());
        ensureRow();
        IntegrationSettingsResponse before = read();

        int rows = jdbc.update("""
                UPDATE platform_integration_settings
                SET github_app_slug = ?, github_client_id = ?, webhook_max_retries = ?, webhook_timeout_seconds = ?,
                    webhook_signature_required = ?, allowed_event_types = ?::jsonb, updated_by = ?,
                    updated_at = now(), version = version + 1
                WHERE id = ? AND version = ?
                """, valid.slug(), valid.clientId(), valid.retries(), valid.timeout(), valid.signatureRequired(),
                toJson(valid.eventTypes()), actorEmail, ROW_ID, expected);
        ExpectedVersion.requireUpdated(rows);

        IntegrationSettingsResponse after = read();
        auditService.logActivity("INTEGRATION", "UPDATE_INTEGRATION_SETTINGS",
                "Updated platform integration settings: " + changes(before, after),
                "Super Admin", actorEmail, "Integration Settings", "WARNING");
        return after;
    }

    private record Valid(String slug, String clientId, int retries, int timeout, boolean signatureRequired, List<String> eventTypes) {}

    private Valid validate(UpdateIntegrationSettingsRequest req) {
        List<ApiError.FieldError> errors = new ArrayList<>();
        String slug = req.githubAppSlug() == null ? "" : req.githubAppSlug().trim();
        String clientId = req.githubClientId() == null ? "" : req.githubClientId().trim();
        if (!SLUG.matcher(slug).matches()) {
            errors.add(new ApiError.FieldError("github_app_slug", "use lowercase letters, digits and hyphens (max 100)"));
        }
        if (!CLIENT_ID.matcher(clientId).matches()) {
            errors.add(new ApiError.FieldError("github_client_id", "use letters, digits, '.', '_' or '-' (max 100)"));
        }
        if (req.webhookMaxRetries() == null || req.webhookMaxRetries() < 0 || req.webhookMaxRetries() > 20) {
            errors.add(new ApiError.FieldError("webhook_max_retries", "must be between 0 and 20"));
        }
        if (req.webhookTimeoutSeconds() == null || req.webhookTimeoutSeconds() < 1 || req.webhookTimeoutSeconds() > 120) {
            errors.add(new ApiError.FieldError("webhook_timeout_seconds", "must be between 1 and 120"));
        }
        if (req.webhookSignatureRequired() == null) {
            errors.add(new ApiError.FieldError("webhook_signature_required", "is required"));
        }
        List<String> events = new ArrayList<>();
        if (req.allowedEventTypes() != null) {
            LinkedHashSet<String> unique = new LinkedHashSet<>();
            for (String raw : req.allowedEventTypes()) {
                String event = raw == null ? "" : raw.trim().toLowerCase(java.util.Locale.ROOT);
                if (!EVENT_TYPE.matcher(event).matches()) {
                    errors.add(new ApiError.FieldError("allowed_event_types", "'" + abbreviate(raw) + "' is not a webhook event name"));
                } else {
                    unique.add(event);
                }
            }
            if (unique.size() > MAX_EVENT_TYPES) {
                errors.add(new ApiError.FieldError("allowed_event_types", "at most " + MAX_EVENT_TYPES + " event types"));
            }
            events.addAll(unique);
        }
        if (req.expectedVersion() == null) {
            errors.add(new ApiError.FieldError(ExpectedVersion.FIELD, "is required"));
        }
        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED,
                    "The integration settings are not valid.", errors);
        }
        return new Valid(slug, clientId, req.webhookMaxRetries(), req.webhookTimeoutSeconds(), req.webhookSignatureRequired(), events);
    }

    private void ensureRow() {
        jdbc.update("""
                INSERT INTO platform_integration_settings (id, github_app_slug, github_client_id, webhook_max_retries,
                    webhook_timeout_seconds, webhook_signature_required, allowed_event_types)
                VALUES (?, '', '', ?, ?, true, '[]'::jsonb)
                ON CONFLICT (id) DO NOTHING
                """, ROW_ID, DEFAULT_MAX_RETRIES, DEFAULT_TIMEOUT_SECONDS);
    }

    private IntegrationSettingsResponse read() {
        Map<String, Object> row = jdbc.queryForMap("""
                SELECT github_app_slug, github_client_id, webhook_max_retries, webhook_timeout_seconds,
                       webhook_signature_required, allowed_event_types::text AS events, updated_at, updated_by, version
                FROM platform_integration_settings WHERE id = ?
                """, ROW_ID);
        return new IntegrationSettingsResponse(
                (String) row.get("github_app_slug"),
                (String) row.get("github_client_id"),
                ((Number) row.get("webhook_max_retries")).intValue(),
                ((Number) row.get("webhook_timeout_seconds")).intValue(),
                Boolean.TRUE.equals(row.get("webhook_signature_required")),
                fromJson((String) row.get("events")),
                toInstant(row.get("updated_at")),
                (String) row.get("updated_by"),
                ((Number) row.get("version")).longValue());
    }

    private static Instant toInstant(Object value) {
        if (value instanceof java.sql.Timestamp ts) {
            return ts.toInstant();
        }
        if (value instanceof java.time.OffsetDateTime odt) {
            return odt.toInstant();
        }
        return null;
    }

    private String toJson(List<String> events) {
        try {
            return objectMapper.writeValueAsString(events);
        } catch (Exception e) {
            throw new IllegalStateException("Event types could not be serialised", e);
        }
    }

    private List<String> fromJson(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private static String changes(IntegrationSettingsResponse a, IntegrationSettingsResponse b) {
        List<String> changed = new ArrayList<>();
        if (!Objects.equals(a.githubAppSlug(), b.githubAppSlug())) changed.add("github_app_slug");
        if (!Objects.equals(a.githubClientId(), b.githubClientId())) changed.add("github_client_id");
        if (a.webhookMaxRetries() != b.webhookMaxRetries()) changed.add("webhook_max_retries " + a.webhookMaxRetries() + "->" + b.webhookMaxRetries());
        if (a.webhookTimeoutSeconds() != b.webhookTimeoutSeconds()) changed.add("webhook_timeout_seconds " + a.webhookTimeoutSeconds() + "->" + b.webhookTimeoutSeconds());
        if (a.webhookSignatureRequired() != b.webhookSignatureRequired()) changed.add("webhook_signature_required -> " + b.webhookSignatureRequired());
        if (!Objects.equals(a.allowedEventTypes(), b.allowedEventTypes())) changed.add("allowed_event_types");
        return changed.isEmpty() ? "no field changed" : String.join(", ", changed);
    }

    private static String abbreviate(String value) {
        if (value == null) {
            return "";
        }
        return value.length() > 40 ? value.substring(0, 40) + "..." : value;
    }
}
