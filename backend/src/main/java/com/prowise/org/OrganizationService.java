package com.prowise.org;

import java.time.ZoneId;
import java.util.UUID;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.identity.AuthPrincipal;

@Service
@Profile("!test")
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class OrganizationService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final ChangeRecorder changes;

    public OrganizationService(JdbcTemplate jdbc, ObjectMapper objectMapper, ChangeRecorder changes) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.changes = changes;
    }

    @Transactional
    public OrganizationResponse create(AuthPrincipal principal, CreateOrganizationRequest request) {
        return createForUser(principal.userId(), request);
    }

    @Transactional
    public OrganizationResponse createForRegistration(UUID userId, CreateOrganizationRequest request) {
        return createForUser(userId, request);
    }

    private OrganizationResponse createForUser(UUID userId, CreateOrganizationRequest request) {
        if (request.name() == null || request.name().isBlank()
                || request.slug() == null || request.slug().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The request has invalid fields.");
        }
        try {
            ZoneId.of(request.timezone());
        } catch (RuntimeException exception) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_TIMEZONE",
                    "The timezone must be a valid IANA timezone.");
        }
        UUID orgId = UUID.randomUUID();
        try {
            jdbc.update("INSERT INTO organizations (id, name, slug, timezone, work_calendar) VALUES (?, ?, ?, ?, ?::jsonb)",
                    orgId, request.name().trim(), request.slug().trim().toLowerCase(java.util.Locale.ROOT),
                    request.timezone(), json(request.calendar()));
            jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, 'ORGANIZATION_OWNER')",
                    UUID.randomUUID(), orgId, userId);
            jdbc.update("""
                    INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by)
                    SELECT ?, ?, m.id, r.id, 'ORG', ?
                    FROM memberships m
                    JOIN roles r ON r.name = m.role_template AND r.is_template
                    WHERE m.org_id = ? AND m.user_id = ?
                    """, UUID.randomUUID(), orgId, userId, orgId, userId);
            String slug = request.slug().trim().toLowerCase(java.util.Locale.ROOT);
            // Task 1.4: organization + owner membership + audit + OrganizationCreated commit together.
            changes.record(
                    new ChangeRecorder.AuditEntry(orgId, userId, "organization.created", "ORGANIZATION", orgId,
                            null, null, java.util.Map.of("name", request.name().trim(), "slug", slug,
                                    "timezone", request.timezone())),
                    new ChangeRecorder.DomainEvent(orgId, "ORGANIZATION", orgId, 0L, "OrganizationCreated",
                            java.util.Map.of("name", request.name().trim(), "slug", slug, "timezone", request.timezone(),
                                    "owner_user_id", userId.toString())));
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_SLUG", "That organization slug is already in use.");
        }
        return new OrganizationResponse(orgId, request.name().trim(),
                request.slug().trim().toLowerCase(java.util.Locale.ROOT), request.timezone(),
                json(request.calendar()), "ACTIVE");
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? java.util.Map.of() : value);
        } catch (JsonProcessingException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The calendar is invalid.");
        }
    }

    public record CreateOrganizationRequest(String name, String slug, String timezone, Object calendar) {}
    public record OrganizationResponse(UUID id, String name, String slug, String timezone,
            String calendar, String state) {}
}
