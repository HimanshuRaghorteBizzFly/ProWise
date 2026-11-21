package com.prowise.common.outbox;

import java.util.UUID;

/** A committed domain event as handed to consumers. {@code payloadJson} is the stored envelope. */
public record OutboxEvent(
        UUID eventId,
        UUID organizationId,
        String aggregateType,
        UUID aggregateId,
        long aggregateVersion,
        String type,
        String payloadJson,
        int attempt) {}
