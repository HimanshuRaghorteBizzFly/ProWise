package com.prowise.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.Locale;

import com.prowise.calendar.WorkingCalendar;

/**
 * Task 2.3: check-in cadence, grace and compliance. Pure rules (no Spring): dates are local calendar days in the
 * project zone, instants come from the working calendar, never by adding 24 hours.
 */
public final class CheckInSchedule {

    private CheckInSchedule() {}

    public enum Frequency { DAILY, WEEKLY, FORTNIGHTLY }

    /** What the user sees for an occurrence right now. */
    public enum Display { UPCOMING, DUE_TODAY, IN_GRACE, MISSED, MET, PAUSED, EXCUSED, SUPERSEDED, ON_TIME, OVERDUE }

    public static Frequency frequency(String value) {
        try {
            return Frequency.valueOf(value == null ? "WEEKLY" : value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Frequency must be DAILY, WEEKLY or FORTNIGHTLY.");
        }
    }

    /**
     * The next check-in due date on or after {@code from}. Weekly and fortnightly check-ins fall on {@code day};
     * fortnightly weeks count from {@code anchor}. A due day that is not a working day moves to the next working day.
     */
    public static LocalDate nextDue(Frequency frequency, DayOfWeek day, LocalDate from, LocalDate anchor, WorkingCalendar calendar) {
        LocalDate due = switch (frequency) {
            case DAILY -> from;
            case WEEKLY -> from.with(TemporalAdjusters.nextOrSame(day));
            case FORTNIGHTLY -> {
                LocalDate candidate = from.with(TemporalAdjusters.nextOrSame(day));
                LocalDate first = (anchor == null ? from : anchor).with(TemporalAdjusters.nextOrSame(day));
                long weeks = ChronoUnit.WEEKS.between(first, candidate);
                yield Math.floorMod(weeks, 2) == 0 ? candidate : candidate.plusWeeks(1);
            }
        };
        return calendar.isWorkingDay(due) ? due : calendar.nextWorkingDay(due);
    }

    /** The due date of the window before {@code due} (a check-in counts for a window if made after that one closed). */
    public static LocalDate previousDue(Frequency frequency, LocalDate due, WorkingCalendar calendar) {
        return switch (frequency) {
            case DAILY -> calendar.previousWorkingDay(due);
            case WEEKLY -> due.minusWeeks(1);
            case FORTNIGHTLY -> due.minusWeeks(2);
        };
    }

    /** Last day of grace: the due date plus the grace in working days (a Friday with a Monday holiday gives Tuesday). */
    public static LocalDate graceUntil(LocalDate due, int graceWorkingDays, WorkingCalendar calendar) {
        return graceWorkingDays <= 0 ? due : calendar.addWorkingDays(due, graceWorkingDays);
    }

    public static Instant cutoff(LocalDate date, LocalTime time, WorkingCalendar calendar) {
        return calendar.cutoffInstant(date, time);
    }

    /** A date-only target stays on time through that local date; overdue starts at the first instant of the next one. */
    public static Instant overdueFrom(LocalDate target, WorkingCalendar calendar) {
        return calendar.startOfNextLocalDate(target);
    }

    /** Display state of an open check-in occurrence. */
    public static Display checkIn(Instant now, LocalDate today, LocalDate due, Instant cutoff, Instant graceCutoff, boolean paused) {
        if (paused) return Display.PAUSED;
        if (now.isBefore(cutoff)) return today.equals(due) ? Display.DUE_TODAY : Display.UPCOMING;
        if (now.isBefore(graceCutoff)) return Display.IN_GRACE;
        return Display.MISSED;
    }

    /** Display state of the target date. */
    public static Display target(Instant now, Instant overdueFrom, boolean delivered) {
        if (delivered) return Display.MET;
        return now.isBefore(overdueFrom) ? Display.ON_TIME : Display.OVERDUE;
    }

    /**
     * Rough pace = elapsed planned working days / total planned working days x 100, clamped 0-100. Days off are excluded.
     * Null ("pace unavailable") without a start and target, or when the plan has no working day.
     */
    public static BigDecimal roughPace(LocalDate start, LocalDate target, LocalDate today, WorkingCalendar calendar) {
        if (start == null || target == null || target.isBefore(start)) return null;
        long total = calendar.workingDaysBetween(start, target);
        if (total <= 0) return null;
        if (today.isBefore(start)) return BigDecimal.ZERO;
        LocalDate end = today.isAfter(target) ? target : today;
        long elapsed = calendar.workingDaysBetween(start, end);
        BigDecimal pace = BigDecimal.valueOf(elapsed).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(total), 0, RoundingMode.HALF_UP);
        return pace.min(BigDecimal.valueOf(100)).max(BigDecimal.ZERO);
    }

    /** Check-in compliance: met / eligible (met + missed). Pending, grace and excused are shown apart; no rate for zero eligible. */
    public record Compliance(int met, int missed, int pending, int inGrace, int excused, BigDecimal rate) {
        public int eligible() {
            return met + missed;
        }
    }

    public static Compliance compliance(int met, int missed, int pending, int inGrace, int excused) {
        int eligible = met + missed;
        BigDecimal rate = eligible == 0 ? null
                : BigDecimal.valueOf(met).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(eligible), 0, RoundingMode.HALF_UP);
        return new Compliance(met, missed, pending, inGrace, excused, rate);
    }
}
