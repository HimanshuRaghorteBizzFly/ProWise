package com.prowise.common.outbox;

/**
 * Receives outbox events. {@link OutboxDispatcher} de-duplicates by (consumer name, event_id) in
 * {@code processed_event} inside the same transaction as the consumer's database effect, so a redelivered
 * event never produces a second effect. Consumers with external side effects must use the event_id as their
 * own idempotency key with the external system.
 */
public interface OutboxConsumer {

    /** Stable name, part of the de-duplication key. Never rename a consumer that has processed events. */
    String name();

    boolean supports(String eventType);

    /** Throw to have the event retried with backoff (and FAILED after the last attempt). */
    void handle(OutboxEvent event);
}
