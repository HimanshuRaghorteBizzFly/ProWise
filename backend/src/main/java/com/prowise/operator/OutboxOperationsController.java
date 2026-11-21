package com.prowise.operator;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.common.api.ApiException;
import com.prowise.common.outbox.OutboxDispatcher;

/**
 * Operator view of outbox deliveries that ran out of retries (task 1.4): FAILED is visible and can be
 * retried. Metadata only; the event payload is never returned.
 */
@RestController
@RequestMapping("/v1/operator/outbox")
public class OutboxOperationsController {

    private final JdbcTemplate jdbc;
    private final OutboxDispatcher dispatcher;

    public OutboxOperationsController(JdbcTemplate jdbc, OutboxDispatcher dispatcher) {
        this.jdbc = jdbc;
        this.dispatcher = dispatcher;
    }

    @GetMapping("/failed")
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    List<FailedEvent> failed() {
        return jdbc.query("""
                SELECT event_id, org_id, aggregate_type, event_type, attempt_count, last_error, failed_at
                FROM outbox_event WHERE state = 'FAILED' ORDER BY failed_at DESC LIMIT 200
                """, (rs, rowNum) -> new FailedEvent(rs.getObject("event_id", UUID.class),
                        rs.getObject("org_id", UUID.class), rs.getString("aggregate_type"), rs.getString("event_type"),
                        rs.getInt("attempt_count"), rs.getString("last_error"),
                        rs.getTimestamp("failed_at") == null ? null : rs.getTimestamp("failed_at").toInstant()));
    }

    @PostMapping("/{eventId}/retry")
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    ResponseEntity<Void> retry(@PathVariable UUID eventId) {
        if (!dispatcher.retryFailed(eventId)) {
            throw new ApiException(org.springframework.http.HttpStatus.NOT_FOUND, "NOT_FOUND",
                    "The requested resource was not found.");
        }
        return ResponseEntity.accepted().build();
    }

    public record FailedEvent(UUID eventId, UUID organizationId, String aggregateType, String eventType,
            int attempts, String lastError, Instant failedAt) {}
}
