package com.prowise.common.worker;

import java.util.concurrent.atomic.AtomicLong;

import jakarta.annotation.PreDestroy;

import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Skeleton outbox poller. Only one worker instance runs it at a time (ShedLock). Dispatch and
 * consumer dedupe by event_id arrive with task 1.4; for now it proves DB connectivity.
 */
@Component
@Profile("worker")
public class OutboxPoller {

    public static final String LOCK_NAME = "prowise-outbox-poller";

    private static final Logger log = LoggerFactory.getLogger(OutboxPoller.class);

    private final JdbcTemplate jdbc;
    private final long delayMs;
    private final AtomicLong completedPolls = new AtomicLong();

    public OutboxPoller(JdbcTemplate jdbc, @Value("${prowise.worker.outbox-delay-ms:5000}") long delayMs) {
        this.jdbc = jdbc;
        this.delayMs = delayMs;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        log.info("Worker ready: outbox poller runs every {} ms under ShedLock '{}'", delayMs, LOCK_NAME);
    }

    @Scheduled(fixedDelayString = "${prowise.worker.outbox-delay-ms:5000}")
    @SchedulerLock(name = LOCK_NAME, lockAtMostFor = "PT1M")
    public void poll() {
        // System job: intentionally spans all organisations; every outbox row carries its own org_id,
        // and dispatch (task 1.4) keeps that org_id on each delivered event.
        Long pending = jdbc.queryForObject(
                "SELECT count(*) FROM outbox_event WHERE state = 'PENDING' AND available_at <= now()", Long.class);
        completedPolls.incrementAndGet();
        log.debug("Outbox poll complete: {} pending event(s)", pending);
    }

    public long completedPolls() {
        return completedPolls.get();
    }

    @PreDestroy
    public void onShutdown() {
        log.info("Worker stopping after {} outbox poll(s)", completedPolls.get());
    }
}
