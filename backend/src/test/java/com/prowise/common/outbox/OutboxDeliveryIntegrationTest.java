package com.prowise.common.outbox;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.prowise.authz.TestDatabase;
import com.prowise.common.change.ChangeRecorder;

/**
 * Task 1.4: business change, audit row and outbox event commit together; delivery is at-least-once with
 * consumer dedupe via processed_event, so every consumer effect happens exactly once.
 * "Crash" = the process stops after the business commit and before any publish; "restart" = a new
 * dispatcher run against the same database.
 */
@SpringBootTest
@Tag("T07")
@Tag("NFR-04")
class OutboxDeliveryIntegrationTest {

    static final String EFFECT_TYPE = "TestEffectRequested";
    static final String FLAKY_TYPE = "TestFlakyRequested";
    static final String BROKEN_TYPE = "TestBrokenRequested";

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ChangeRecorder changes;

    @Autowired
    private OutboxDispatcher dispatcher;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private RecordingConsumer consumer;

    @TestConfiguration
    static class Consumers {
        @Bean
        RecordingConsumer recordingConsumer(JdbcTemplate jdbc) {
            return new RecordingConsumer(jdbc);
        }
    }

    /** Writes its effect in the delivery transaction; FLAKY fails once per event, BROKEN always fails. */
    static class RecordingConsumer implements OutboxConsumer {
        private final JdbcTemplate jdbc;
        final Map<UUID, AtomicInteger> calls = new ConcurrentHashMap<>();

        RecordingConsumer(JdbcTemplate jdbc) {
            this.jdbc = jdbc;
        }

        @Override
        public String name() {
            return "test-recording-consumer";
        }

        @Override
        public boolean supports(String eventType) {
            return eventType.startsWith("Test");
        }

        @Override
        public void handle(OutboxEvent event) {
            int call = calls.computeIfAbsent(event.eventId(), id -> new AtomicInteger()).incrementAndGet();
            jdbc.update("INSERT INTO test_outbox_effect (event_id) VALUES (?)", event.eventId());
            if (BROKEN_TYPE.equals(event.type()) || (FLAKY_TYPE.equals(event.type()) && call == 1)) {
                throw new IllegalStateException("downstream unavailable");
            }
        }
    }

    @BeforeEach
    @AfterEach
    void clean() {
        jdbc.execute("CREATE TABLE IF NOT EXISTS test_outbox_effect (event_id UUID NOT NULL)");
        jdbc.execute("TRUNCATE test_outbox_effect");
        TestDatabase.clean(jdbc);
        consumer.calls.clear();
    }

    @Test
    void crashAfterCommitBeforePublishDeliversExactlyOnceAfterRestart() {
        UUID orgId = UUID.randomUUID();
        UUID eventId = commitChange(orgId, EFFECT_TYPE);

        // Crash: committed, nothing published yet. Business state, one audit row and one pending event survive.
        assertThat(count("SELECT count(*) FROM organizations WHERE id = ?", orgId)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM audit_log WHERE org_id = ?", orgId)).isEqualTo(1);
        assertThat(state(eventId)).isEqualTo("PENDING");

        // Restart: the worker picks it up. Running again (a second restart) must not repeat the effect.
        dispatcher.dispatchBatch(10);
        dispatcher.dispatchBatch(10);

        assertThat(state(eventId)).isEqualTo("DONE");
        assertThat(effects(eventId)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM processed_event WHERE event_id = ?", eventId)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM audit_log WHERE org_id = ?", orgId)).isEqualTo(1);
    }

    @Test
    void redeliveredEventIsDedupedByProcessedEvent() {
        UUID eventId = commitChange(UUID.randomUUID(), EFFECT_TYPE);
        dispatcher.dispatchBatch(10);
        // Simulate a duplicate delivery (for example a second worker that read the row before it was marked).
        jdbc.update("UPDATE outbox_event SET state = 'PENDING', available_at = now() WHERE event_id = ?", eventId);

        dispatcher.dispatchBatch(10);

        assertThat(state(eventId)).isEqualTo("DONE");
        assertThat(effects(eventId)).isEqualTo(1);
        assertThat(consumer.calls.get(eventId).get()).isEqualTo(1);
    }

    @Test
    void failedAttemptRollsBackItsEffectAndRetriesWithBackoff() {
        UUID eventId = commitChange(UUID.randomUUID(), FLAKY_TYPE);

        dispatcher.dispatchBatch(10);
        Map<String, Object> afterFailure = jdbc.queryForMap(
                "SELECT state, attempt_count, last_error, available_at > now() AS delayed FROM outbox_event WHERE event_id = ?",
                eventId);
        assertThat(afterFailure.get("state")).isEqualTo("PENDING");
        assertThat(afterFailure.get("attempt_count")).isEqualTo(1);
        assertThat(afterFailure.get("last_error")).isEqualTo("IllegalStateException"); // type only, no message
        assertThat(afterFailure.get("delayed")).isEqualTo(true);
        assertThat(effects(eventId)).isZero(); // the failed attempt's effect was rolled back
        assertThat(count("SELECT count(*) FROM processed_event WHERE event_id = ?", eventId)).isZero();

        dispatcher.dispatchBatch(10); // not due yet
        assertThat(consumer.calls.get(eventId).get()).isEqualTo(1);

        makeDue(eventId);
        dispatcher.dispatchBatch(10);
        assertThat(state(eventId)).isEqualTo("DONE");
        assertThat(effects(eventId)).isEqualTo(1);
    }

    @Test
    void boundedRetryEndsInVisibleFailedStateAndCanBeRetried() {
        UUID eventId = commitChange(UUID.randomUUID(), BROKEN_TYPE);
        for (int attempt = 1; attempt <= dispatcher.maxAttempts(); attempt++) {
            makeDue(eventId);
            dispatcher.dispatchBatch(10);
        }
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT state, attempt_count, failed_at, last_error FROM outbox_event WHERE event_id = ?", eventId);
        assertThat(row.get("state")).isEqualTo("FAILED");
        assertThat(row.get("attempt_count")).isEqualTo(dispatcher.maxAttempts());
        assertThat(row.get("failed_at")).isNotNull();
        assertThat(effects(eventId)).isZero();

        makeDue(eventId);
        dispatcher.dispatchBatch(10);
        assertThat(consumer.calls.get(eventId).get()).isEqualTo(dispatcher.maxAttempts()); // FAILED is not polled

        assertThat(dispatcher.retryFailed(eventId)).isTrue();
        assertThat(state(eventId)).isEqualTo("PENDING");
        assertThat(dispatcher.retryFailed(eventId)).isFalse();
    }

    @Test
    void backoffGrowsExponentiallyAndIsCapped() {
        assertThat(dispatcher.backoffSeconds(1)).isEqualTo(10);
        assertThat(dispatcher.backoffSeconds(2)).isEqualTo(20);
        assertThat(dispatcher.backoffSeconds(3)).isEqualTo(40);
        assertThat(dispatcher.backoffSeconds(30)).isEqualTo(3600);
    }

    @Test
    void concurrentWorkersNeverDeliverTheSameEventTwice() throws Exception {
        List<UUID> events = new ArrayList<>();
        for (int i = 0; i < 30; i++) {
            events.add(commitChange(UUID.randomUUID(), EFFECT_TYPE));
        }
        ExecutorService pool = Executors.newFixedThreadPool(4);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Integer>> runs = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            Callable<Integer> worker = () -> {
                start.await();
                return dispatcher.dispatchBatch(100);
            };
            runs.add(pool.submit(worker));
        }
        start.countDown();
        int handled = 0;
        for (Future<Integer> run : runs) handled += run.get(60, TimeUnit.SECONDS);
        pool.shutdown();

        assertThat(handled).isEqualTo(30);
        assertThat(count("SELECT count(*) FROM test_outbox_effect")).isEqualTo(30);
        assertThat(count("SELECT count(DISTINCT event_id) FROM test_outbox_effect")).isEqualTo(30);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE state = 'DONE'")).isEqualTo(30);
    }

    @Test
    void auditAndEventRollBackWithTheBusinessChange() {
        UUID orgId = UUID.randomUUID();
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        assertThatThrownBy(() -> tx.executeWithoutResult(status -> {
            insertOrganization(orgId);
            changes.record(audit(orgId), event(orgId, EFFECT_TYPE));
            throw new IllegalStateException("business rule failed after recording");
        })).isInstanceOf(IllegalStateException.class);

        assertThat(count("SELECT count(*) FROM organizations WHERE id = ?", orgId)).isZero();
        assertThat(count("SELECT count(*) FROM audit_log WHERE org_id = ?", orgId)).isZero();
        assertThat(count("SELECT count(*) FROM outbox_event WHERE org_id = ?", orgId)).isZero();
    }

    @Test
    void recorderRequiresAnOpenTransactionAndRefusesSecrets() {
        UUID orgId = UUID.randomUUID();
        assertThatThrownBy(() -> changes.record(audit(orgId), event(orgId, EFFECT_TYPE)))
                .isInstanceOf(org.springframework.transaction.IllegalTransactionStateException.class);

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        assertThatThrownBy(() -> tx.executeWithoutResult(status -> {
            insertOrganization(orgId);
            changes.record(audit(orgId), new ChangeRecorder.DomainEvent(orgId, "ORGANIZATION", orgId, 0L, EFFECT_TYPE,
                    Map.of("access_token", "abc")));
        })).isInstanceOf(IllegalArgumentException.class);
        assertThat(count("SELECT count(*) FROM organizations WHERE id = ?", orgId)).isZero();
    }

    /* ------------------------------------------------------------------ */

    private UUID commitChange(UUID orgId, String eventType) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        return tx.execute(status -> {
            insertOrganization(orgId);
            return changes.record(audit(orgId), event(orgId, eventType));
        });
    }

    private void insertOrganization(UUID orgId) {
        String slug = "outbox-" + orgId.toString().substring(0, 12);
        jdbc.update("INSERT INTO organizations (id, name, slug, timezone, work_calendar) VALUES (?, ?, ?, 'UTC', '{}'::jsonb)",
                orgId, slug, slug);
    }

    private static ChangeRecorder.AuditEntry audit(UUID orgId) {
        return new ChangeRecorder.AuditEntry(orgId, null, "organization.created", "ORGANIZATION", orgId, null, null,
                Map.of("name", "test"));
    }

    private static ChangeRecorder.DomainEvent event(UUID orgId, String type) {
        return new ChangeRecorder.DomainEvent(orgId, "ORGANIZATION", orgId, 0L, type, Map.of("name", "test"));
    }

    private void makeDue(UUID eventId) {
        jdbc.update("UPDATE outbox_event SET available_at = now() - interval '1 second' WHERE event_id = ?", eventId);
    }

    private String state(UUID eventId) {
        return jdbc.queryForObject("SELECT state FROM outbox_event WHERE event_id = ?", String.class, eventId);
    }

    private int effects(UUID eventId) {
        return count("SELECT count(*) FROM test_outbox_effect WHERE event_id = ?", eventId);
    }

    private int count(String sql, Object... args) {
        Integer value = jdbc.queryForObject(sql, Integer.class, args);
        return value == null ? 0 : value;
    }
}
