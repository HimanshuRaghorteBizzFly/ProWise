package com.prowise.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Structured-mode progress (docs/domain-rules.md "Progress methods", tasks 3.2 and 3.5). Pure Java, no Spring.
 *
 * <ul>
 *   <li>Input: the LEAVES of the active approved baseline with their approved weights. Parents are never passed in,
 *       so a parent can never earn credit; a duplicated leaf id is refused rather than counted twice.</li>
 *   <li>Numerator: weights of accepted leaves (Done with criteria, checks and any required review of the exact
 *       revision; the caller decides "accepted"). Reopened and cancelled leaves earn 0.</li>
 *   <li>Denominator: all positive weights of the baseline, cancelled leaves included until an approved removal.</li>
 *   <li>Rounding only for display; 100% only when the non-empty numerator equals the denominator; an empty
 *       baseline is "Not measurable"; open work with nothing accepted is 0%.</li>
 *   <li>Git activity, elapsed time and task counts are never inputs (rule 9).</li>
 * </ul>
 */
public final class StructuredProgress {

    public static final String METHOD = "accepted_work";
    public static final String NOT_MEASURABLE = "Not measurable";
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private StructuredProgress() {}

    /** One leaf of the active baseline. */
    public record Leaf(String id, BigDecimal weight, boolean accepted, boolean cancelled) {}

    public record Result(BigDecimal numerator, BigDecimal denominator, BigDecimal exactPercent, Integer displayPercent,
            int acceptedLeaves, int totalLeaves) {

        public boolean measurable() {
            return displayPercent != null;
        }

        public String label() {
            return measurable() ? displayPercent + "%" : NOT_MEASURABLE;
        }

        /** Plain-language explanation, e.g. "3 of 5 leaves accepted, 50/125 points". */
        public String explanation(String unit) {
            if (!measurable()) return "No approved scope to measure yet";
            return acceptedLeaves + " of " + totalLeaves + " leaves accepted, " + plain(numerator) + "/" + plain(denominator)
                    + " " + unitWord(unit);
        }
    }

    public static Result calculate(Collection<Leaf> leaves) {
        BigDecimal numerator = BigDecimal.ZERO;
        BigDecimal denominator = BigDecimal.ZERO;
        int accepted = 0;
        Set<String> seen = new HashSet<>();
        for (Leaf leaf : leaves) {
            if (leaf.id() == null || !seen.add(leaf.id())) {
                throw new IllegalArgumentException("Each baseline leaf is counted once.");
            }
            if (leaf.weight() == null || leaf.weight().signum() <= 0) {
                throw new IllegalArgumentException("Baseline weights must be positive.");
            }
            denominator = denominator.add(leaf.weight());
            if (leaf.accepted() && !leaf.cancelled()) {
                numerator = numerator.add(leaf.weight());
                accepted++;
            }
        }
        if (denominator.signum() == 0) {
            return new Result(BigDecimal.ZERO, BigDecimal.ZERO, null, null, 0, 0);
        }
        BigDecimal exact = numerator.multiply(HUNDRED).divide(denominator, 6, RoundingMode.HALF_UP).stripTrailingZeros();
        int display = exact.setScale(0, RoundingMode.HALF_UP).intValueExact();
        if (display == 100 && numerator.compareTo(denominator) != 0) display = 99;
        return new Result(numerator, denominator, exact, display, accepted, seen.size());
    }

    private static String plain(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }

    private static String unitWord(String unit) {
        if (unit == null) return "points";
        return switch (unit.toUpperCase(Locale.ROOT)) {
            case "EFFORT" -> "hours";
            case "EQUAL" -> "items";
            default -> "points";
        };
    }
}
