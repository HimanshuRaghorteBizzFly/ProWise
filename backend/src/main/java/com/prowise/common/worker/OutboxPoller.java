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
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.prowise.common.outbox.OutboxDispatcher;

/**
 * Worker-profile outbox poller (task 1.4). ShedLock keeps one active poller across worker instances, and
 * {@link OutboxDispatcher} claims rows with FOR UPDATE SKIP LOCKED, so even overlapping runs never deliver
 * the same event twice at once. System job: it spans organizations, and each event keeps its own org_id.
 */
@Component
@Profile("worker")
public class OutboxPoller {

    public static final String LOCK_NAME = "prowise-outbox-poller";

    private static final Logger log = LoggerFactory.getLogger(OutboxPoller.class);

    private final OutboxDispatcher dispatcher;
    private final long delayMs;
    private final int batchSize;
    private final AtomicLong completedPolls = new AtomicLong();

    public OutboxPoller(
            OutboxDispatcher dispatcher,
            @Value("${prowise.worker.outbox-delay-ms:5000}") long delayMs,
            @Value("${prowise.worker.outbox-batch-size:50}") int batchSize) {
        this.dispatcher = dispatcher;
        this.delayMs = delayMs;
        this.batchSize = batchSize;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        log.info("Worker ready: outbox poller runs every {} ms under ShedLock '{}'", delayMs, LOCK_NAME);
    }

    @Scheduled(fixedDelayString = "${prowise.worker.outbox-delay-ms:5000}")
    @SchedulerLock(name = LOCK_NAME, lockAtMostFor = "PT1M")
    public void poll() {
        int handled = dispatcher.dispatchBatch(batchSize);
        completedPolls.incrementAndGet();
        if (handled > 0) {
            log.debug("Outbox poll handled {} event(s)", handled);
        }
    }

    public long completedPolls() {
        return completedPolls.get();
    }

    @PreDestroy
    public void onShutdown() {
        log.info("Worker stopping after {} outbox poll(s)", completedPolls.get());
    }
}
