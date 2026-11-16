package com.prowise.common.worker;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;

import javax.sql.DataSource;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;

import com.prowise.ProwiseApplication;

/**
 * Starts the real worker profile against PostgreSQL: Flyway runs, the OutboxPoller fires under
 * a ShedLock lock row, and closing the context stops polling cleanly.
 */
@Tag("integration")
@Tag("NFR-08")
class WorkerProfileIntegrationTest {

    @Test
    void workerStartsPollsUnderShedLockAndShutsDownCleanly() throws Exception {
        ConfigurableApplicationContext context = new SpringApplicationBuilder(ProwiseApplication.class)
                .profiles("worker")
                .web(WebApplicationType.NONE)
                .properties("prowise.worker.outbox-delay-ms=100")
                .run();
        OutboxPoller poller;
        try {
            assertThat(context.getEnvironment().getActiveProfiles()).contains("worker");
            assertThat(context).as("worker serves no HTTP")
                    .isNotInstanceOf(org.springframework.boot.web.context.WebServerApplicationContext.class);
            poller = context.getBean(OutboxPoller.class);
            JdbcTemplate jdbc = new JdbcTemplate(context.getBean(DataSource.class));
            Timestamp startedAt = jdbc.queryForObject("SELECT now()::timestamp(3) - interval '1 second'", Timestamp.class);

            awaitUntil(Duration.ofSeconds(15), () -> poller.completedPolls() >= 2);

            Timestamp lockedAt = jdbc.queryForObject(
                    "SELECT locked_at FROM shedlock WHERE name = ?", Timestamp.class, OutboxPoller.LOCK_NAME);
            assertThat(lockedAt).isAfterOrEqualTo(startedAt);
        } finally {
            context.close();
        }

        assertThat(context.isActive()).isFalse();
        long pollsAtShutdown = poller.completedPolls();
        Thread.sleep(400);
        assertThat(poller.completedPolls()).as("no polling after shutdown").isEqualTo(pollsAtShutdown);
    }

    private static void awaitUntil(Duration timeout, java.util.function.BooleanSupplier condition)
            throws InterruptedException {
        Instant deadline = Instant.now().plus(timeout);
        while (!condition.getAsBoolean()) {
            if (Instant.now().isAfter(deadline)) {
                throw new AssertionError("condition not met within " + timeout);
            }
            Thread.sleep(50);
        }
    }
}
