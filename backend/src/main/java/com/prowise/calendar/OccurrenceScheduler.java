package com.prowise.calendar;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;

/**
 * Worker-profile occurrence generator (task 2.3). Reconciles every open project in its own transaction: closes ended
 * check-in windows and materializes the next ones. Idempotent (one live occurrence per kind is also enforced by a
 * unique index), so overlapping or repeated runs never create a second live occurrence. System job: each row keeps
 * its own org_id; nothing is logged beyond counts.
 */
@Component
@Profile("worker")
public class OccurrenceScheduler {

    private static final Logger log = LoggerFactory.getLogger(OccurrenceScheduler.class);

    private final JdbcTemplate jdbc;
    private final CalendarCadenceService calendar;
    private final TransactionTemplate transactions;

    public OccurrenceScheduler(JdbcTemplate jdbc, CalendarCadenceService calendar, TransactionTemplate transactions) {
        this.jdbc = jdbc;
        this.calendar = calendar;
        this.transactions = transactions;
    }

    @Scheduled(fixedDelayString = "${prowise.worker.occurrence-delay-ms:900000}")
    @SchedulerLock(name = "prowise-occurrence-generator", lockAtMostFor = "PT10M")
    public void run() {
        Instant now = Instant.now();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, org_id FROM projects WHERE archived = false AND lifecycle NOT IN ('DELIVERED', 'CLOSED', 'CANCELLED') AND org_id IS NOT NULL");
        int failed = 0;
        for (Map<String, Object> row : rows) {
            try {
                transactions.executeWithoutResult(status -> calendar.reconcile((UUID) row.get("org_id"), (String) row.get("id"), now));
            } catch (RuntimeException e) {
                failed++;
            }
        }
        log.debug("Occurrence generator reconciled {} project(s), {} failed", rows.size() - failed, failed);
    }
}
