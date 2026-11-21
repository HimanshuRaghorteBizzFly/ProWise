package com.prowise.common.outbox;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.prowise.common.api.RequestIdFilter;

/**
 * Delivers committed outbox events (task 1.4).
 *
 * <ul>
 *   <li>One event per transaction, claimed with {@code FOR UPDATE SKIP LOCKED}: concurrent workers never
 *       deliver the same event at the same time.</li>
 *   <li>Each consumer runs inside a savepoint together with its {@code processed_event} row, and the event is
 *       marked DONE in the same transaction. A crash before commit leaves the event PENDING; on restart it is
 *       redelivered, and consumers that already committed their effect are skipped by the dedupe row.</li>
 *   <li>A failing consumer rolls back to the savepoint; the event is retried with exponential backoff and
 *       becomes FAILED (visible to operators) after {@code maxAttempts}.</li>
 *   <li>Logs carry {@code request_id = outbox-<event_id>} and never the payload.</li>
 * </ul>
 */
@Component
public class OutboxDispatcher {

    private static final Logger log = LoggerFactory.getLogger(OutboxDispatcher.class);

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final List<OutboxConsumer> consumers;
    private final int maxAttempts;
    private final Duration baseBackoff;
    private final Duration maxBackoff;

    public OutboxDispatcher(
            JdbcTemplate jdbc,
            PlatformTransactionManager transactionManager,
            List<OutboxConsumer> consumers,
            @Value("${prowise.outbox.max-attempts:8}") int maxAttempts,
            @Value("${prowise.outbox.base-backoff:PT10S}") Duration baseBackoff,
            @Value("${prowise.outbox.max-backoff:PT1H}") Duration maxBackoff) {
        this.jdbc = jdbc;
        this.tx = new TransactionTemplate(transactionManager);
        this.consumers = consumers;
        this.maxAttempts = maxAttempts;
        this.baseBackoff = baseBackoff;
        this.maxBackoff = maxBackoff;
    }

    /** Delivers up to {@code limit} due events; returns how many were handled (delivered or rescheduled). */
    public int dispatchBatch(int limit) {
        int handled = 0;
        while (handled < limit && Boolean.TRUE.equals(tx.execute(status -> dispatchOne(status)))) {
            handled++;
        }
        return handled;
    }

    private boolean dispatchOne(org.springframework.transaction.TransactionStatus status) {
        List<OutboxEvent> claimed = jdbc.query("""
                SELECT event_id, org_id, aggregate_type, aggregate_id, aggregate_version, event_type,
                       payload::text AS payload, attempt_count
                FROM outbox_event
                WHERE state = 'PENDING' AND available_at <= now()
                ORDER BY available_at, event_id
                LIMIT 1
                FOR UPDATE SKIP LOCKED
                """, (rs, rowNum) -> new OutboxEvent(
                        rs.getObject("event_id", UUID.class), rs.getObject("org_id", UUID.class),
                        rs.getString("aggregate_type"), rs.getObject("aggregate_id", UUID.class),
                        rs.getLong("aggregate_version"), rs.getString("event_type"), rs.getString("payload"),
                        rs.getInt("attempt_count") + 1));
        if (claimed.isEmpty()) {
            return false;
        }
        OutboxEvent event = claimed.get(0);
        String previousRequestId = MDC.get(RequestIdFilter.MDC_KEY);
        MDC.put(RequestIdFilter.MDC_KEY, "outbox-" + event.eventId());
        try {
            // JDBC savepoint on the transaction's own connection (the JPA transaction manager offers none).
            // Consumers write through JdbcTemplate on this connection, so their effects roll back with it.
            Connection connection = DataSourceUtils.getConnection(jdbc.getDataSource());
            Savepoint savepoint = sql(() -> connection.setSavepoint());
            try {
                deliver(event);
                sql(() -> { connection.releaseSavepoint(savepoint); return null; });
                jdbc.update("""
                        UPDATE outbox_event
                        SET state = 'DONE', processed_at = now(), attempt_count = ?, last_error = NULL
                        WHERE event_id = ?
                        """, event.attempt(), event.eventId());
                log.debug("Delivered {} (attempt {})", event.type(), event.attempt());
            } catch (RuntimeException failure) {
                sql(() -> { connection.rollback(savepoint); return null; });
                reschedule(event, failure);
            }
            return true;
        } finally {
            if (previousRequestId == null) MDC.remove(RequestIdFilter.MDC_KEY);
            else MDC.put(RequestIdFilter.MDC_KEY, previousRequestId);
        }
    }

    private interface SqlCall<T> {
        T call() throws SQLException;
    }

    private static <T> T sql(SqlCall<T> call) {
        try {
            return call.call();
        } catch (SQLException exception) {
            throw new IllegalStateException("Outbox savepoint operation failed", exception);
        }
    }

    private void deliver(OutboxEvent event) {
        for (OutboxConsumer consumer : consumers) {
            if (!consumer.supports(event.type())) continue;
            int fresh = jdbc.update("""
                    INSERT INTO processed_event (consumer, event_id, org_id) VALUES (?, ?, ?)
                    ON CONFLICT (consumer, event_id) DO NOTHING
                    """, consumer.name(), event.eventId(), event.organizationId());
            if (fresh == 0) {
                continue; // this consumer already committed its effect for this event
            }
            consumer.handle(event);
        }
    }

    private void reschedule(OutboxEvent event, RuntimeException failure) {
        // Only the exception type is stored: messages may echo payload values.
        String error = failure.getClass().getSimpleName();
        if (event.attempt() >= maxAttempts) {
            jdbc.update("""
                    UPDATE outbox_event SET state = 'FAILED', attempt_count = ?, failed_at = now(), last_error = ?
                    WHERE event_id = ?
                    """, event.attempt(), error, event.eventId());
            log.warn("Outbox event {} FAILED after {} attempts ({})", event.type(), event.attempt(), error);
            return;
        }
        long delaySeconds = backoffSeconds(event.attempt());
        jdbc.update("""
                UPDATE outbox_event
                SET attempt_count = ?, last_error = ?, available_at = now() + (? * interval '1 second')
                WHERE event_id = ?
                """, event.attempt(), error, delaySeconds, event.eventId());
        log.info("Outbox event {} attempt {} failed ({}); retry in {}s", event.type(), event.attempt(), error, delaySeconds);
    }

    long backoffSeconds(int attempt) {
        long base = Math.max(1, baseBackoff.toSeconds());
        long delay = base * (1L << Math.min(attempt - 1, 20));
        return Math.min(delay, maxBackoff.toSeconds());
    }

    /** Operator action: put a FAILED event back in the queue (attempt counter is kept for the record). */
    public boolean retryFailed(UUID eventId) {
        return jdbc.update("""
                UPDATE outbox_event SET state = 'PENDING', available_at = now(), failed_at = NULL
                WHERE event_id = ? AND state = 'FAILED'
                """, eventId) == 1;
    }

    public int maxAttempts() {
        return maxAttempts;
    }
}
