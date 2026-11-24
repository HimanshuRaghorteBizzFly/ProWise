package com.prowise.project;

import java.util.UUID;

/**
 * Published inside the project transaction when a project is created or its dates, zone or lifecycle change, so the
 * calendar (task 2.3) recomputes its due occurrences in the same transaction. In-process only; the outbox event of
 * the same change is the durable record.
 */
public record ProjectScheduleChanged(UUID orgId, String projectId) {}
