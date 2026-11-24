package com.prowise.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.prowise.domain.ScopePlan.Change;
import com.prowise.domain.ScopePlan.Kind;
import com.prowise.domain.ScopePlan.Leaf;

@Tag("T25")
@Tag("AS-08")
class ScopePlanTest {

    private static Leaf leaf(String id, String weight) {
        return new Leaf(id, new BigDecimal(weight), false);
    }

    private static final List<Leaf> BASE = List.of(leaf("a", "20"), leaf("b", "30"), leaf("c", "50"));

    @Test
    void addingTwentyFivePointsGrowsTheDenominatorTo125() {
        List<Leaf> next = ScopePlan.apply(BASE, List.of(new Change(Kind.ADD, "d", new BigDecimal("25"), null)));
        assertThat(ScopePlan.total(BASE)).isEqualByComparingTo("100");
        assertThat(ScopePlan.total(next)).isEqualByComparingTo("125");
        assertThat(ScopePlan.total(BASE)).isEqualByComparingTo("100"); // the base is untouched
    }

    @Test
    void removalShrinksAndCancellationKeepsTheDenominator() {
        assertThat(ScopePlan.total(ScopePlan.apply(BASE, List.of(new Change(Kind.REMOVE, "c", null, null))))).isEqualByComparingTo("50");
        List<Leaf> cancelled = ScopePlan.apply(BASE, List.of(new Change(Kind.CANCEL, "c", null, null)));
        assertThat(ScopePlan.total(cancelled)).isEqualByComparingTo("100"); // cancelling alone never raises the percentage
        assertThat(cancelled).filteredOn(Leaf::cancelled).extracting(Leaf::id).containsExactly("c");
    }

    @Test
    void splitAndReweight() {
        List<Leaf> split = ScopePlan.apply(BASE, List.of(new Change(Kind.SPLIT, "c", null, List.of(leaf("c1", "20"), leaf("c2", "40")))));
        assertThat(split).extracting(Leaf::id).containsExactly("a", "b", "c1", "c2");
        assertThat(ScopePlan.total(split)).isEqualByComparingTo("110");
        assertThat(ScopePlan.total(ScopePlan.apply(BASE, List.of(new Change(Kind.REWEIGHT, "a", new BigDecimal("10"), null)))))
                .isEqualByComparingTo("90");
    }

    @Test
    void rejectsInvalidDrafts() {
        assertThatThrownBy(() -> ScopePlan.apply(BASE, List.of())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ScopePlan.apply(BASE, List.of(new Change(Kind.ADD, "d", BigDecimal.ZERO, null))))
                .hasMessageContaining("greater than 0");
        assertThatThrownBy(() -> ScopePlan.apply(BASE, List.of(new Change(Kind.ADD, "d", new BigDecimal("-1"), null))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ScopePlan.apply(BASE, List.of(new Change(Kind.REMOVE, "x", null, null))))
                .hasMessageContaining("not in the current scope");
        assertThatThrownBy(() -> ScopePlan.apply(BASE, List.of(new Change(Kind.REMOVE, "a", null, null), new Change(Kind.CANCEL, "a", null, null))))
                .hasMessageContaining("only once");
        assertThatThrownBy(() -> ScopePlan.apply(BASE, List.of(new Change(Kind.SPLIT, "a", null, List.of(leaf("a1", "5"))))))
                .hasMessageContaining("two parts");
        assertThatThrownBy(() -> ScopePlan.apply(BASE, List.of(new Change(Kind.REWEIGHT, "a", new BigDecimal("20"), null))))
                .hasMessageContaining("equal");
    }
}
