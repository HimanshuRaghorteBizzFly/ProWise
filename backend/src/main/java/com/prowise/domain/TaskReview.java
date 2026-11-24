package com.prowise.domain;

import java.util.Collection;
import java.util.Optional;
import java.util.Set;

/**
 * Review and rework of a task (task 3.3, domain rules "Task workflow" and "Review rules"). Pure Java, no Spring.
 *
 * <p>To Do / In Progress -> (submit revision) In Review -> approve -> Done, or request changes -> In Progress with a
 * new revision. Review is always required (no direct Done). Approval needs the submitted revision to still be the
 * current one and every required check passed. Reopening a Done task removes its credit (back to In Progress, new
 * revision); history is kept elsewhere.
 */
public final class TaskReview {

    private TaskReview() {}

    public enum State { TODO, IN_PROGRESS, BLOCKED, IN_REVIEW, DONE }

    public enum Problem { NOT_SUBMITTABLE, NOT_IN_REVIEW, STALE_REVIEW, MISSING_CHECK, NOT_DONE }

    public static Optional<Problem> canSubmit(State state) {
        return state == State.TODO || state == State.IN_PROGRESS ? Optional.empty() : Optional.of(Problem.NOT_SUBMITTABLE);
    }

    /**
     * @param reviewedRevision the revision the reviewer looked at (sent with the decision)
     * @param submittedRevision the revision currently in review
     * @param currentRevision the task's current revision
     */
    public static Optional<Problem> canApprove(State state, int reviewedRevision, Integer submittedRevision, int currentRevision,
            Collection<String> requiredChecks, Collection<String> passedChecks) {
        if (state != State.IN_REVIEW) return Optional.of(Problem.NOT_IN_REVIEW);
        if (submittedRevision == null || reviewedRevision != submittedRevision || submittedRevision != currentRevision) {
            return Optional.of(Problem.STALE_REVIEW);
        }
        Set<String> passed = passedChecks == null ? Set.of() : Set.copyOf(passedChecks);
        if (!passed.containsAll(requiredChecks)) return Optional.of(Problem.MISSING_CHECK);
        return Optional.empty();
    }

    public static Optional<Problem> canRequestChanges(State state, int reviewedRevision, Integer submittedRevision, int currentRevision) {
        if (state != State.IN_REVIEW) return Optional.of(Problem.NOT_IN_REVIEW);
        if (submittedRevision == null || reviewedRevision != submittedRevision || submittedRevision != currentRevision) {
            return Optional.of(Problem.STALE_REVIEW);
        }
        return Optional.empty();
    }

    public static Optional<Problem> canReopen(State state) {
        return state == State.DONE ? Optional.empty() : Optional.of(Problem.NOT_DONE);
    }

    /** A task earns credit only when Done with an accepted (approved) revision. */
    public static boolean earnsCredit(State state, Integer acceptedRevision) {
        return state == State.DONE && acceptedRevision != null;
    }
}
