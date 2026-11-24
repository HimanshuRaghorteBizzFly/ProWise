package com.prowise.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.prowise.domain.WorkBreakdown.Level;

@Tag("T12")
class WorkBreakdownTest {

    @Test
    void allowsDirectTaskMilestoneTaskAndDeliverableSubtasks() {
        assertThat(WorkBreakdown.placementError(Level.TASK, null)).isEmpty();
        assertThat(WorkBreakdown.placementError(Level.MILESTONE, null)).isEmpty();
        assertThat(WorkBreakdown.placementError(Level.TASK, Level.MILESTONE)).isEmpty();
        assertThat(WorkBreakdown.placementError(Level.DELIVERABLE, Level.MILESTONE)).isEmpty();
        assertThat(WorkBreakdown.placementError(Level.TASK, Level.DELIVERABLE)).isEmpty();
        assertThat(WorkBreakdown.placementError(Level.SUBTASK, Level.TASK)).isEmpty();
    }

    @Test
    void rejectsInvalidNesting() {
        assertThat(WorkBreakdown.placementError(Level.MILESTONE, Level.MILESTONE)).isPresent();
        assertThat(WorkBreakdown.placementError(Level.SUBTASK, null)).isPresent();
        assertThat(WorkBreakdown.placementError(Level.SUBTASK, Level.MILESTONE)).isPresent();
        assertThat(WorkBreakdown.placementError(Level.TASK, Level.TASK)).isPresent();
        assertThat(WorkBreakdown.placementError(Level.DELIVERABLE, Level.TASK)).get().asString().contains("deliverable");
    }

    @Test
    void depthCountsTheProjectAndRejectsMoreThanFiveLevels() {
        Map<String, String> parentOf = new HashMap<>();
        parentOf.put("m", null);
        parentOf.put("d", "m");
        parentOf.put("t", "d");
        parentOf.put("s", "t");
        assertThat(WorkBreakdown.depth("m", parentOf)).isEqualTo(2);
        assertThat(WorkBreakdown.depth("s", parentOf)).isEqualTo(5);
        assertThat(WorkBreakdown.tooDeep(WorkBreakdown.depthUnder("s", parentOf))).isTrue();
        assertThat(WorkBreakdown.tooDeep(WorkBreakdown.depthUnder("t", parentOf))).isFalse();
    }

    @Test
    void detectsCycles() {
        Map<String, String> parentOf = new HashMap<>(Map.of("b", "a", "c", "b"));
        assertThat(WorkBreakdown.createsCycle("a", "c", parentOf)).isTrue();
        assertThat(WorkBreakdown.createsCycle("c", "a", parentOf)).isFalse();
        parentOf.put("a", "c");
        assertThatThrownBy(() -> WorkBreakdown.depth("a", parentOf)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void onlyLeavesCarryPositivePoints() {
        assertThat(WorkBreakdown.validPoints(Level.TASK, new BigDecimal("5"))).isTrue();
        assertThat(WorkBreakdown.validPoints(Level.SUBTASK, new BigDecimal("2.5"))).isTrue();
        assertThat(WorkBreakdown.validPoints(Level.TASK, BigDecimal.ZERO)).isFalse();
        assertThat(WorkBreakdown.validPoints(Level.TASK, null)).isFalse();
        assertThat(WorkBreakdown.validPoints(Level.TASK, new BigDecimal("-1"))).isFalse();
        assertThat(WorkBreakdown.validPoints(Level.MILESTONE, null)).isTrue();
        assertThat(WorkBreakdown.validPoints(Level.MILESTONE, new BigDecimal("3"))).isFalse();
        assertThat(WorkBreakdown.measurable(Level.DELIVERABLE)).isFalse();
    }
}
