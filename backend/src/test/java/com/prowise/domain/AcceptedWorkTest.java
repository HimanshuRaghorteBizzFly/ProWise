package com.prowise.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.prowise.domain.AcceptedWork.Leaf;
import com.prowise.domain.AcceptedWork.Measure;

/** The executable fixtures of docs/domain-rules.md (Progress methods). */
@Tag("T27")
@Tag("AS-03")
class AcceptedWorkTest {

    private static Leaf leaf(String id, String points, boolean accepted) {
        return new Leaf(id, new BigDecimal(points), false, accepted);
    }

    @Test
    void fixture1_twoOfThreeLeavesAcceptedIsFiftyPercent() {
        Measure m = AcceptedWork.measure(List.of(leaf("a", "20", true), leaf("b", "30", true), leaf("c", "50", false)));
        assertThat(m.numerator()).isEqualByComparingTo("50");
        assertThat(m.denominator()).isEqualByComparingTo("100");
        assertThat(m.display()).isEqualByComparingTo("50");
    }

    @Test
    void fixture2_approvingPlus25IsFortyPercent() {
        Measure m = AcceptedWork.measure(List.of(leaf("a", "20", true), leaf("b", "30", true), leaf("c", "50", false), leaf("d", "25", false)));
        assertThat(m.display()).isEqualByComparingTo("40");
    }

    @Test
    void fixture3_reopeningThe30LeafIsSixteenPercent() {
        Measure m = AcceptedWork.measure(List.of(leaf("a", "20", true), leaf("b", "30", false), leaf("c", "50", false), leaf("d", "25", false)));
        assertThat(m.display()).isEqualByComparingTo("16");
    }

    @Test
    void fixture4_emptyScopeIsNotMeasurable() {
        Measure m = AcceptedWork.measure(List.of());
        assertThat(m.measurable()).isFalse();
        assertThat(m.label()).isEqualTo("Not measurable");
    }

    @Test
    void fixture5_openWorkWithNothingAcceptedIsZero() {
        assertThat(AcceptedWork.measure(List.of(leaf("a", "20", false))).display()).isEqualByComparingTo("0");
    }

    @Test
    void fixture6_cancelledLeafStaysInTheDenominatorAndEarnsNothing() {
        Measure m = AcceptedWork.measure(List.of(leaf("a", "50", true), new Leaf("b", new BigDecimal("50"), true, true)));
        assertThat(m.denominator()).isEqualByComparingTo("100");
        assertThat(m.display()).isEqualByComparingTo("50");
    }

    @Test
    void asO3_hundredOnlyWhenEveryPointIsAccepted() {
        assertThat(AcceptedWork.measure(List.of(leaf("a", "20", true), leaf("b", "30", true), leaf("c", "50", true))).display())
                .isEqualByComparingTo("100");
        // 999.5 of 1000 rounds to 100 but must not show 100%.
        assertThat(AcceptedWork.measure(List.of(leaf("a", "999.5", true), leaf("b", "0.5", false))).display()).isEqualByComparingTo("99");
        assertThat(AcceptedWork.measure(List.of(leaf("a", "0.1", true), leaf("b", "999.9", false))).display()).isEqualByComparingTo("1");
    }
}
