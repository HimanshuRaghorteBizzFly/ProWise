package com.prowise.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.prowise.domain.StructuredProgress.Leaf;
import com.prowise.domain.StructuredProgress.Result;

/** docs/domain-rules.md "Executable fixtures" 1-7 for Structured progress (tasks 3.2, 3.5). */
@Tag("T27")
@Tag("AS-03")
@Tag("AS-08")
class StructuredProgressTest {

    @Test
    void fixture1_acceptedTwentyAndThirtyOfHundredIsFiftyPercent() {
        Result r = StructuredProgress.calculate(List.of(accepted("a", 20), accepted("b", 30), open("c", 50)));
        assertThat(r.numerator()).isEqualByComparingTo("50");
        assertThat(r.denominator()).isEqualByComparingTo("100");
        assertThat(r.displayPercent()).isEqualTo(50);
        assertThat(r.measurable()).isTrue();
        assertThat(r.acceptedLeaves()).isEqualTo(2);
        assertThat(r.totalLeaves()).isEqualTo(3);
    }

    @Test
    void fixture2_addingTwentyFivePointsGivesFortyPercent() {
        Result r = StructuredProgress.calculate(List.of(accepted("a", 20), accepted("b", 30), open("c", 50), open("d", 25)));
        assertThat(r.denominator()).isEqualByComparingTo("125");
        assertThat(r.displayPercent()).isEqualTo(40);
    }

    @Test
    void fixture3_reopeningTheThirtyLeafGivesSixteenPercent() {
        Result r = StructuredProgress.calculate(List.of(accepted("a", 20), open("b", 30), open("c", 50), open("d", 25)));
        assertThat(r.numerator()).isEqualByComparingTo("20");
        assertThat(r.displayPercent()).isEqualTo(16);
    }

    @Test
    void fixture4_emptyScopeIsNotMeasurable() {
        Result r = StructuredProgress.calculate(List.of());
        assertThat(r.measurable()).isFalse();
        assertThat(r.displayPercent()).isNull();
        assertThat(r.label()).isEqualTo(StructuredProgress.NOT_MEASURABLE);
    }

    @Test
    void fixture5_openWorkWithNothingAcceptedIsZeroPercent() {
        Result r = StructuredProgress.calculate(List.of(open("a", 10), open("b", 5)));
        assertThat(r.measurable()).isTrue();
        assertThat(r.displayPercent()).isZero();
    }

    @Test
    void fixture6_cancelledLeafStaysInTheDenominatorAndEarnsNothing() {
        Result before = StructuredProgress.calculate(List.of(accepted("a", 50), open("b", 50)));
        Result afterCancel = StructuredProgress.calculate(List.of(accepted("a", 50), cancelled("b", 50)));
        assertThat(afterCancel.denominator()).isEqualByComparingTo("100");
        assertThat(afterCancel.displayPercent()).isEqualTo(before.displayPercent()).isEqualTo(50);
        // Even a cancelled leaf marked accepted earns nothing.
        Result weird = StructuredProgress.calculate(List.of(new Leaf("x", BigDecimal.TEN, true, true)));
        assertThat(weird.numerator()).isEqualByComparingTo("0");
    }

    @Test
    void fixture7_onlyLeavesAreInputSoAParentCannotAddCredit() {
        // The caller passes baseline leaves only; a duplicated id (e.g. a parent listed with its child) is refused
        // instead of being counted twice.
        assertThatThrownBy(() -> StructuredProgress.calculate(List.of(accepted("a", 20), accepted("a", 20))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void roundsOnlyForDisplayAndShowsHundredOnlyWhenEverythingIsAccepted() {
        Result almost = StructuredProgress.calculate(List.of(accepted("a", 999), open("b", 1)));
        assertThat(almost.exactPercent()).isEqualByComparingTo("99.9");
        assertThat(almost.displayPercent()).isEqualTo(99);
        Result all = StructuredProgress.calculate(List.of(accepted("a", 1), accepted("b", 2)));
        assertThat(all.displayPercent()).isEqualTo(100);
        Result third = StructuredProgress.calculate(List.of(accepted("a", 1), open("b", 2)));
        assertThat(third.displayPercent()).isEqualTo(33);
        assertThat(third.explanation("POINTS")).isEqualTo("1 of 2 leaves accepted, 1/3 points");
    }

    @Test
    void rejectsZeroNegativeAndMissingWeights() {
        assertThatThrownBy(() -> StructuredProgress.calculate(List.of(open("a", 0)))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> StructuredProgress.calculate(List.of(open("a", -5)))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> StructuredProgress.calculate(List.of(new Leaf("a", null, false, false))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static Leaf accepted(String id, int weight) {
        return new Leaf(id, BigDecimal.valueOf(weight), true, false);
    }

    private static Leaf open(String id, int weight) {
        return new Leaf(id, BigDecimal.valueOf(weight), false, false);
    }

    private static Leaf cancelled(String id, int weight) {
        return new Leaf(id, BigDecimal.valueOf(weight), false, true);
    }
}
