package com.prowise.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.prowise.domain.TaskReview.Problem;
import com.prowise.domain.TaskReview.State;

@Tag("T22")
class TaskReviewTest {

    @Test
    void submitOnlyFromToDoOrInProgress() {
        assertThat(TaskReview.canSubmit(State.TODO)).isEmpty();
        assertThat(TaskReview.canSubmit(State.IN_PROGRESS)).isEmpty();
        assertThat(TaskReview.canSubmit(State.IN_REVIEW)).contains(Problem.NOT_SUBMITTABLE);
        assertThat(TaskReview.canSubmit(State.DONE)).contains(Problem.NOT_SUBMITTABLE);
    }

    @Test
    void approvalNeedsTheCurrentSubmittedRevisionAndEveryRequiredCheck() {
        assertThat(TaskReview.canApprove(State.IN_REVIEW, 2, 2, 2, List.of("a", "b"), List.of("a", "b"))).isEmpty();
        assertThat(TaskReview.canApprove(State.IN_REVIEW, 1, 2, 2, List.of(), List.of())).contains(Problem.STALE_REVIEW);
        assertThat(TaskReview.canApprove(State.IN_REVIEW, 2, 2, 3, List.of(), List.of())).contains(Problem.STALE_REVIEW);
        assertThat(TaskReview.canApprove(State.IN_REVIEW, 2, 2, 2, List.of("a", "b"), List.of("a"))).contains(Problem.MISSING_CHECK);
        assertThat(TaskReview.canApprove(State.IN_PROGRESS, 2, 2, 2, List.of(), List.of())).contains(Problem.NOT_IN_REVIEW);
    }

    @Test
    void changesRequestedAndReopening() {
        assertThat(TaskReview.canRequestChanges(State.IN_REVIEW, 1, 1, 1)).isEmpty();
        assertThat(TaskReview.canRequestChanges(State.IN_REVIEW, 1, 2, 2)).contains(Problem.STALE_REVIEW);
        assertThat(TaskReview.canReopen(State.DONE)).isEmpty();
        assertThat(TaskReview.canReopen(State.IN_REVIEW)).contains(Problem.NOT_DONE);
    }

    @Test
    void onlyAnApprovedDoneTaskEarnsCredit() {
        assertThat(TaskReview.earnsCredit(State.DONE, 1)).isTrue();
        assertThat(TaskReview.earnsCredit(State.DONE, null)).isFalse(); // reopened or never approved
        assertThat(TaskReview.earnsCredit(State.IN_REVIEW, null)).isFalse();
    }
}
