package com.prowise.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;

/**
 * Structured progress from accepted work (task 3.5, domain rules "Progress methods"). Pure Java, no Spring.
 *
 * <ul>
 *   <li>Denominator: points of every leaf in the ACTIVE approved scope version (cancelled leaves included until
 *       removed). One unit (points).</li>
 *   <li>Numerator: points of those leaves that are Done with an approved review (not cancelled). A parent is never in
 *       the scope, so it never earns credit; a reopened leaf earns 0.</li>
 *   <li>Computed from exact totals; rounded only for display. 100% only when the numerator equals a non-empty
 *       denominator. An empty denominator is "Not measurable"; open work with nothing accepted is 0%.</li>
 * </ul>
 */
public final class AcceptedWork {

    public static final String METHOD = "calculated";
    public static final String NOT_MEASURABLE = "Not measurable";

    private AcceptedWork() {}

    /** One leaf of the active scope version and whether it currently earns credit. */
    public record Leaf(String id, BigDecimal points, boolean cancelled, boolean accepted) {}

    /** percent is null when not measurable; display is the rounded value shown to people. */
    public record Measure(BigDecimal numerator, BigDecimal denominator, BigDecimal percent, BigDecimal display, String label) {
        public boolean measurable() {
            return percent != null;
        }
    }

    public static Measure measure(Collection<Leaf> leaves) {
        BigDecimal denominator = BigDecimal.ZERO;
        BigDecimal numerator = BigDecimal.ZERO;
        for (Leaf leaf : leaves) {
            if (leaf.points() == null || leaf.points().signum() <= 0) throw new IllegalArgumentException("Points must be positive.");
            denominator = denominator.add(leaf.points());
            if (leaf.accepted() && !leaf.cancelled()) numerator = numerator.add(leaf.points());
        }
        if (denominator.signum() == 0) return new Measure(numerator, denominator, null, null, NOT_MEASURABLE);
        BigDecimal exact = numerator.multiply(BigDecimal.valueOf(100)).divide(denominator, 10, RoundingMode.HALF_UP);
        BigDecimal display = exact.setScale(0, RoundingMode.HALF_UP);
        // Never show 100% before every point is accepted, and never 0% when something is accepted.
        if (numerator.compareTo(denominator) < 0 && display.compareTo(BigDecimal.valueOf(100)) >= 0) display = BigDecimal.valueOf(99);
        if (numerator.signum() > 0 && display.signum() == 0) display = BigDecimal.ONE;
        return new Measure(numerator, denominator, exact, display, "Calculated");
    }
}
