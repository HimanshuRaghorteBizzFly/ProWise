package com.prowise.work;

import java.util.UUID;

/**
 * Hooks that run INSIDE the transaction of a work item transition (task 3.3), so the follow-up commits or rolls back
 * together with the transition: dependency guards and successor flags (task 3.4), progress snapshots (task 3.5).
 */
public interface WorkItemStateListener {

    /** Before a To Do item starts; throw to refuse the start (for example, an unfinished prerequisite). */
    default void beforeStart(UUID orgId, String workItemId) {}

    /** After accepted work was reopened. */
    default void afterReopen(UUID orgId, String workItemId, UUID actorId) {}

    /** After the credit of a leaf changed: accepted (WORK_ACCEPTED) or reopened (WORK_REOPENED). */
    default void creditChanged(UUID orgId, String workItemId, String cause, UUID actorId) {}
}
