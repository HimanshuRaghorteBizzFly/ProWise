package com.prowise.common.audit;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Atomic business change recorder: writes an audit row and an outbox event
 * inside the active @Transactional method (Rule 4).
 */
@Component("auditChangeRecorder")
public class ChangeRecorder {

    private static final Logger log = LoggerFactory.getLogger(ChangeRecorder.class);

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public ChangeRecorder(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    public void recordChange(
            UUID orgId,
            UUID actorId,
            String action,
            String targetType,
            String targetId,
            Map<String, Object> metadata,
            String aggregateType,
            String aggregateId,
            String eventType,
            long aggregateVersion,
            Object eventPayload) {

        Timestamp now = Timestamp.from(Instant.now());

        // 1. Audit Log row
        UUID auditId = UUID.randomUUID();
        UUID targetUuid = tryParseUuid(targetId);
        Map<String, Object> meta = metadata != null ? new HashMap<>(metadata) : new HashMap<>();
        if (targetId != null && targetUuid == null) {
            meta.put("target_ref", targetId);
        }
        String metaJson = toJson(meta);

        jdbc.update("""
                INSERT INTO audit_log (id, org_id, actor_id, action, target_type, target_id, occurred_at, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb)
                """, auditId, orgId, actorId, action, targetType, targetUuid, now, metaJson);

        // 2. Outbox Event row
        UUID eventId = UUID.randomUUID();
        UUID aggUuid = tryParseUuid(aggregateId);
        if (aggUuid == null) {
            aggUuid = aggregateId != null
                    ? UUID.nameUUIDFromBytes(aggregateId.getBytes(java.nio.charset.StandardCharsets.UTF_8))
                    : UUID.randomUUID();
        }
        String payloadJson = toJson(eventPayload != null ? eventPayload : Map.of("id", aggregateId));

        jdbc.update("""
                INSERT INTO outbox_event (event_id, org_id, aggregate_type, aggregate_id, event_type, aggregate_version, payload, state, available_at)
                VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, 'PENDING', ?)
                """, eventId, orgId, aggregateType, aggUuid, eventType, aggregateVersion, payloadJson, now);

        log.debug("Recorded change [{}]: audit={}, event={}", action, auditId, eventId);
    }

    private UUID tryParseUuid(String val) {
        if (val == null || val.isBlank()) return null;
        try {
            return UUID.fromString(val);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj != null ? obj : Map.of());
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize audit/outbox payload", e);
            return "{}";
        }
    }
}
