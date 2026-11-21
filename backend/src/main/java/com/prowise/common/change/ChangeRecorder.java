package com.prowise.common.change;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.regex.Pattern;

import org.slf4j.MDC;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.prowise.common.api.RequestIdFilter;

/**
 * Safe-write pattern (task 1.4): the business change, its audit row and its outbox event commit together
 * or not at all. Every method requires an existing transaction ({@link Propagation#MANDATORY}), so the
 * history cannot be written outside the service's {@code @Transactional} method or silently skipped.
 *
 * <pre>
 * &#64;Transactional
 * public RoleResponse update(...) {
 *     ... UPDATE roles ... WHERE version = ?           // business change
 *     changes.record(AuditEntry..., DomainEvent...);  // same transaction
 * }
 * </pre>
 *
 * Audit snapshots and event payloads must never contain secrets: keys that look like passwords, tokens,
 * secrets, hashes or cookies are rejected outright.
 */
@Component
public class ChangeRecorder {

    private static final Pattern SECRET_KEY =
            Pattern.compile("(?i).*(password|passwd|token|secret|hash|cookie|authorization|api[_-]?key).*");

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public ChangeRecorder(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    /** Applies {@code change}, then records its audit row and event in the same transaction. */
    @Transactional(propagation = Propagation.MANDATORY)
    public <T> T record(Supplier<T> change, Function<T, AuditEntry> audit, Function<T, DomainEvent> event) {
        T result = change.get();
        record(audit.apply(result), event.apply(result));
        return result;
    }

    /** Records the audit row and outbox event for a change already made in the current transaction. */
    @Transactional(propagation = Propagation.MANDATORY)
    public UUID record(AuditEntry audit, DomainEvent event) {
        if (!audit.organizationId().equals(event.organizationId())) {
            throw new IllegalArgumentException("Audit entry and event must belong to the same organization.");
        }
        String requestId = MDC.get(RequestIdFilter.MDC_KEY);
        jdbc.update("""
                INSERT INTO audit_log
                    (id, org_id, actor_id, action, target_type, target_id, occurred_at, reason, previous, new, request_id)
                VALUES (?, ?, ?, ?, ?, ?, now(), ?, ?::jsonb, ?::jsonb, ?)
                """,
                UUID.randomUUID(), audit.organizationId(), audit.actorId(), audit.action(), audit.targetType(),
                audit.targetId(), truncate(audit.reason(), 500), json(audit.previous()), json(audit.next()), requestId);

        UUID eventId = UUID.randomUUID();
        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("event_id", eventId.toString());
        envelope.put("org_id", event.organizationId().toString());
        envelope.put("aggregate_id", event.aggregateId().toString());
        envelope.put("aggregate_version", event.aggregateVersion());
        envelope.put("actor_id", audit.actorId() == null ? null : audit.actorId().toString());
        envelope.put("data", event.payload() == null ? Map.of() : event.payload());
        jdbc.update("""
                INSERT INTO outbox_event
                    (event_id, org_id, aggregate_type, aggregate_id, event_type, aggregate_version, payload, state, available_at)
                VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, 'PENDING', now())
                """,
                eventId, event.organizationId(), event.aggregateType(), event.aggregateId(), event.type(),
                event.aggregateVersion(), json(envelope));
        return eventId;
    }

    private String json(Map<String, ?> value) {
        if (value == null) return null;
        assertNoSecrets(value);
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Audit or event data is not serializable.", exception);
        }
    }

    @SuppressWarnings("unchecked")
    private static void assertNoSecrets(Map<String, ?> value) {
        for (Map.Entry<String, ?> entry : value.entrySet()) {
            if (SECRET_KEY.matcher(entry.getKey()).matches()) {
                throw new IllegalArgumentException("Secrets must never be written to audit or events: " + entry.getKey());
            }
            if (entry.getValue() instanceof Map<?, ?> nested) {
                assertNoSecrets((Map<String, ?>) nested);
            }
        }
    }

    private static String truncate(String value, int max) {
        return value == null ? null : value.substring(0, Math.min(value.length(), max));
    }

    /** One audit row: who did what to which target, why, and the safe before/after values. */
    public record AuditEntry(
            UUID organizationId,
            UUID actorId,
            String action,
            String targetType,
            UUID targetId,
            String reason,
            Map<String, ?> previous,
            Map<String, ?> next) {}

    /** One domain event (envelope: event_id, org_id, aggregate id/version, actor, time). */
    public record DomainEvent(
            UUID organizationId,
            String aggregateType,
            UUID aggregateId,
            long aggregateVersion,
            String type,
            Map<String, ?> payload) {}
}
