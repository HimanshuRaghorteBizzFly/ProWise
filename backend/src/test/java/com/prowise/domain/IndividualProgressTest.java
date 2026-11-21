package com.prowise.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.prowise.domain.IndividualProgress.Entry;
import com.prowise.domain.IndividualProgress.Figure;
import com.prowise.domain.IndividualProgress.Status;

@Tag("T17")
@Tag("T18")
@Tag("T28")
class IndividualProgressTest {

    private static final Instant T0 = Instant.parse("2026-11-02T09:00:00Z");

    private static Entry entry(int seq, String percent, Status status) {
        return new Entry("c" + seq, seq, new BigDecimal(percent), status, "dev", T0.plusSeconds(seq * 3600L),
                status == Status.PENDING ? null : T0.plusSeconds(seq * 3600L + 60));
    }

    @Test
    void noApprovedEntryIsNotReportedNeverZero() {
        Figure empty = IndividualProgress.current(List.of());
        assertThat(empty.reported()).isFalse();
        assertThat(empty.percent()).isNull();
        assertThat(empty.label()).isEqualTo("Not reported");

        Figure onlyPending = IndividualProgress.current(List.of(entry(1, "45", Status.PENDING)));
        assertThat(onlyPending.reported()).isFalse();
    }

    @Test
    void pendingEntryDoesNotChangeTheCurrentFigure() {
        List<Entry> entries = List.of(entry(1, "40", Status.APPROVED), entry(2, "60", Status.PENDING));
        Figure figure = IndividualProgress.current(entries);
        assertThat(figure.percent()).isEqualByComparingTo("40");
        assertThat(figure.entryId()).isEqualTo("c1");
        assertThat(IndividualProgress.pendingEntry(entries)).get().extracting(Entry::id).isEqualTo("c2");
    }

    @Test
    void approvalMakesTheEntryCurrentAndRejectionDoesNot() {
        assertThat(IndividualProgress.current(List.of(entry(1, "40", Status.APPROVED), entry(2, "60", Status.APPROVED)))
                .percent()).isEqualByComparingTo("60");
        Figure afterReject = IndividualProgress.current(
                List.of(entry(1, "40", Status.APPROVED), entry(2, "60", Status.REJECTED)));
        assertThat(afterReject.percent()).isEqualByComparingTo("40");
        assertThat(afterReject.entryId()).isEqualTo("c1");
    }

    @Test
    void currentFigureFollowsRevisionSequenceNotListOrder() {
        List<Entry> shuffled = List.of(entry(3, "30", Status.APPROVED), entry(1, "50", Status.APPROVED),
                entry(2, "55", Status.APPROVED));
        assertThat(IndividualProgress.current(shuffled).percent()).isEqualByComparingTo("30");
        assertThat(IndividualProgress.nextRevision(shuffled)).isEqualTo(4);
        assertThat(IndividualProgress.nextRevision(List.of())).isEqualTo(1);
    }

    @Test
    void labelStaysDeveloperReportedWithReportTimeEvenWhenApproved() {
        Figure figure = IndividualProgress.current(List.of(entry(1, "40", Status.APPROVED)));
        assertThat(figure.label()).isEqualTo("Developer reported");
        assertThat(figure.reportedAt()).isEqualTo(T0.plusSeconds(3600));
        assertThat(figure.approvedAt()).isEqualTo(T0.plusSeconds(3660));
        assertThat(IndividualProgress.METHOD).isEqualTo("developer_reported");
    }

    @Test
    void downwardCorrectionNeedsAReasonComparedWithTheApprovedFigure() {
        List<Entry> entries = List.of(entry(1, "45", Status.APPROVED));
        assertThat(IndividualProgress.reasonMissing(new BigDecimal("30"), null, entries)).isTrue();
        assertThat(IndividualProgress.reasonMissing(new BigDecimal("30"), "  ", entries)).isTrue();
        assertThat(IndividualProgress.reasonMissing(new BigDecimal("30"), "Found a regression", entries)).isFalse();
        assertThat(IndividualProgress.reasonMissing(new BigDecimal("45"), null, entries)).isFalse();
        assertThat(IndividualProgress.reasonMissing(new BigDecimal("50"), null, entries)).isFalse();
        // nothing approved yet: there is nothing to correct downward
        assertThat(IndividualProgress.reasonMissing(new BigDecimal("10"), null,
                List.of(entry(1, "60", Status.REJECTED)))).isFalse();
    }

    @Test
    void percentRangeAndPrecisionAreValidated() {
        assertThat(IndividualProgress.validPercent(new BigDecimal("45"))).isEqualByComparingTo("45.00");
        assertThat(IndividualProgress.validPercent(BigDecimal.ZERO)).isEqualByComparingTo("0");
        assertThat(IndividualProgress.validPercent(new BigDecimal("100"))).isEqualByComparingTo("100");
        assertThat(IndividualProgress.validPercent(new BigDecimal("12.50"))).isEqualByComparingTo("12.5");
        assertThatThrownBy(() -> IndividualProgress.validPercent(null)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> IndividualProgress.validPercent(new BigDecimal("-1")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> IndividualProgress.validPercent(new BigDecimal("100.01")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> IndividualProgress.validPercent(new BigDecimal("10.125")))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void onlyPendingEntriesAreDecidableAndNeverByTheirAuthor() {
        assertThat(IndividualProgress.decidable(entry(1, "40", Status.PENDING))).isTrue();
        assertThat(IndividualProgress.decidable(entry(1, "40", Status.APPROVED))).isFalse();
        assertThat(IndividualProgress.decidable(entry(1, "40", Status.REJECTED))).isFalse();
        assertThat(IndividualProgress.selfDecision(entry(1, "40", Status.PENDING), "dev")).isTrue();
        assertThat(IndividualProgress.selfDecision(entry(1, "40", Status.PENDING), "lead")).isFalse();
    }

    @Test
    void hundredPercentIsOnlyAFigure() {
        Figure full = IndividualProgress.current(List.of(entry(1, "100", Status.APPROVED)));
        assertThat(full.percent()).isEqualByComparingTo("100");
        assertThat(full.label()).isEqualTo("Developer reported");
    }
}
