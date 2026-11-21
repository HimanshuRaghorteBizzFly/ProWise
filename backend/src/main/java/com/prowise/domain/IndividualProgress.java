package com.prowise.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.Objects;
import java.util.Optional;

/**
 * Individual-mode progress (task 2.2, domain rules "Progress methods"). Pure Java, no Spring.
 *
 * <ul>
 *   <li>The current figure is the APPROVED entry with the highest revision sequence. Pending and rejected entries
 *       never change it. No approved entry means "Not reported" (never 0%).</li>
 *   <li>The label is always "Developer reported", also after a Team Lead approved it.</li>
 *   <li>A downward correction (below the current approved figure) needs a reason.</li>
 *   <li>Reaching 100% never changes the lifecycle: delivery needs a separate, authorized decision (task 2.4).</li>
 * </ul>
 */
public final class IndividualProgress {

    public static final String METHOD = "developer_reported";
    public static final String LABEL = "Developer reported";
    public static final String NOT_REPORTED = "Not reported";

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final Comparator<Entry> BY_REVISION = Comparator.comparingInt(Entry::revisionSeq);

    private IndividualProgress() {}

    public enum Status { PENDING, APPROVED, REJECTED }

    /** One check-in as stored (append-only). */
    public record Entry(String id, int revisionSeq, BigDecimal percent, Status status, String authorId,
            Instant submittedAt, Instant decidedAt) {
        public Entry {
            Objects.requireNonNull(status, "status");
            Objects.requireNonNull(percent, "percent");
        }
    }

    /** What the project shows: the approved value, its label and when it was reported; or "Not reported". */
    public record Figure(BigDecimal percent, String label, Instant reportedAt, Instant approvedAt, String entryId) {
        public boolean reported() {
            return percent != null;
        }
    }

    /** The latest approved entry by revision sequence, if any. */
    public static Optional<Entry> currentEntry(Collection<Entry> entries) {
        return entries.stream().filter(e -> e.status() == Status.APPROVED).max(BY_REVISION);
    }

    /** The entry waiting for a Team Lead decision, if any. */
    public static Optional<Entry> pendingEntry(Collection<Entry> entries) {
        return entries.stream().filter(e -> e.status() == Status.PENDING).max(BY_REVISION);
    }

    public static Figure current(Collection<Entry> entries) {
        return currentEntry(entries)
                .map(e -> new Figure(e.percent(), LABEL, e.submittedAt(), e.decidedAt(), e.id()))
                .orElse(new Figure(null, NOT_REPORTED, null, null, null));
    }

    /** Next revision sequence for a new entry (1 for the first). */
    public static int nextRevision(Collection<Entry> entries) {
        return entries.stream().mapToInt(Entry::revisionSeq).max().orElse(0) + 1;
    }

    /**
     * Validates a submitted percentage: required, 0 to 100, at most two decimals. Returns it with scale 2.
     *
     * @throws IllegalArgumentException with a user-facing message
     */
    public static BigDecimal validPercent(BigDecimal percent) {
        if (percent == null) {
            throw new IllegalArgumentException("Enter a percentage from 0 to 100.");
        }
        if (percent.signum() < 0 || percent.compareTo(HUNDRED) > 0) {
            throw new IllegalArgumentException("Percentage must be from 0 to 100.");
        }
        if (percent.stripTrailingZeros().scale() > 2) {
            throw new IllegalArgumentException("Use at most two decimals.");
        }
        return percent.setScale(2, RoundingMode.UNNECESSARY);
    }

    /** True when the proposed value is below the current approved figure (a downward correction). */
    public static boolean isDownward(BigDecimal proposed, Collection<Entry> entries) {
        return currentEntry(entries).map(e -> proposed.compareTo(e.percent()) < 0).orElse(false);
    }

    /** A downward correction must carry a non-blank reason. */
    public static boolean reasonMissing(BigDecimal proposed, String reason, Collection<Entry> entries) {
        return isDownward(proposed, entries) && (reason == null || reason.isBlank());
    }

    /** Only a pending entry can be decided, and only once. */
    public static boolean decidable(Entry entry) {
        return entry.status() == Status.PENDING;
    }

    /** Separation of duties: the author of an entry never decides it. */
    public static boolean selfDecision(Entry entry, String deciderId) {
        return entry.authorId() != null && entry.authorId().equals(deciderId);
    }
}
