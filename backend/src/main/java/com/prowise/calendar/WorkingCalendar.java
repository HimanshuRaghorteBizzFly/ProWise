package com.prowise.calendar;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Pure domain class for organization working calendar calculations.
 * Central engine for working days, holidays, cutoff instants, DST conversions,
 * and grace periods.
 */
public final class WorkingCalendar {

    public static final Set<DayOfWeek> DEFAULT_WORKDAYS = Collections.unmodifiableSet(
            EnumSet.of(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY));
    public static final ZoneId DEFAULT_ZONE = ZoneId.of("UTC");
    public static final LocalTime DEFAULT_CUTOFF = LocalTime.of(17, 0);

    private final Set<DayOfWeek> workdays;
    private final Set<LocalDate> holidays;
    private final ZoneId zone;

    public WorkingCalendar(Set<DayOfWeek> workdays, Set<LocalDate> holidays, ZoneId zone) {
        this.workdays = workdays != null && !workdays.isEmpty()
                ? Collections.unmodifiableSet(new HashSet<>(workdays))
                : DEFAULT_WORKDAYS;
        this.holidays = holidays != null
                ? Collections.unmodifiableSet(new HashSet<>(holidays))
                : Collections.emptySet();
        this.zone = zone != null ? zone : DEFAULT_ZONE;
    }

    public Set<DayOfWeek> getWorkdays() {
        return workdays;
    }

    public Set<LocalDate> getHolidays() {
        return holidays;
    }

    public ZoneId getZone() {
        return zone;
    }

    public boolean isWorkingDay(LocalDate date) {
        if (date == null) return false;
        return workdays.contains(date.getDayOfWeek()) && !holidays.contains(date);
    }

    public LocalDate nextWorkingDay(LocalDate date) {
        Objects.requireNonNull(date, "date cannot be null");
        LocalDate current = date.plusDays(1);
        while (!isWorkingDay(current)) {
            current = current.plusDays(1);
        }
        return current;
    }

    public LocalDate previousWorkingDay(LocalDate date) {
        Objects.requireNonNull(date, "date cannot be null");
        LocalDate current = date.minusDays(1);
        while (!isWorkingDay(current)) {
            current = current.minusDays(1);
        }
        return current;
    }

    /**
     * Adds n working days to a given start date.
     * Example: Friday + 1 working day + Monday holiday -> Tuesday.
     */
    public LocalDate addWorkingDays(LocalDate start, int workingDays) {
        Objects.requireNonNull(start, "start date cannot be null");
        if (workingDays == 0) {
            return start;
        }
        LocalDate current = start;
        if (workingDays > 0) {
            for (int i = 0; i < workingDays; i++) {
                current = nextWorkingDay(current);
            }
        } else {
            for (int i = 0; i < -workingDays; i++) {
                current = previousWorkingDay(current);
            }
        }
        return current;
    }

    /**
     * Counts working days between start and end (both inclusive).
     * If start is after end, returns 0.
     */
    public long workingDaysBetween(LocalDate startInclusive, LocalDate endInclusive) {
        if (startInclusive == null || endInclusive == null || startInclusive.isAfter(endInclusive)) {
            return 0;
        }
        long count = 0;
        LocalDate curr = startInclusive;
        while (!curr.isAfter(endInclusive)) {
            if (isWorkingDay(curr)) {
                count++;
            }
            curr = curr.plusDays(1);
        }
        return count;
    }

    /**
     * Computes cutoff datetime in this calendar's zone (handles DST transitions).
     */
    public ZonedDateTime cutoffDateTime(LocalDate date, LocalTime cutoffTime) {
        Objects.requireNonNull(date, "date cannot be null");
        LocalTime time = cutoffTime != null ? cutoffTime : DEFAULT_CUTOFF;
        return ZonedDateTime.of(date, time, zone);
    }

    /**
     * Computes the UTC instant of a local cutoff date and time.
     */
    public Instant cutoffInstant(LocalDate date, LocalTime cutoffTime) {
        return cutoffDateTime(date, cutoffTime).toInstant();
    }

    /**
     * Computes the instant when a date-only target becomes overdue
     * (the first instant of the next local date in the project zone).
     */
    public Instant startOfNextLocalDate(LocalDate date) {
        Objects.requireNonNull(date, "date cannot be null");
        return date.plusDays(1).atStartOfDay(zone).toInstant();
    }

    /**
     * Factory method parsing raw configuration.
     */
    public static WorkingCalendar from(String workdaysCsv, String holidaysJson, String zoneId, ObjectMapper om) {
        Set<DayOfWeek> days = parseWorkdays(workdaysCsv);
        Set<LocalDate> hols = parseHolidays(holidaysJson, om);
        ZoneId z;
        try {
            z = zoneId != null && !zoneId.isBlank() ? ZoneId.of(zoneId) : DEFAULT_ZONE;
        } catch (Exception e) {
            z = DEFAULT_ZONE;
        }
        return new WorkingCalendar(days, hols, z);
    }

    public static Set<DayOfWeek> parseWorkdays(String workdaysCsv) {
        if (workdaysCsv == null || workdaysCsv.isBlank()) {
            return DEFAULT_WORKDAYS;
        }
        Set<DayOfWeek> days = new HashSet<>();
        for (String part : workdaysCsv.split(",")) {
            String trimmed = part.trim().toUpperCase(Locale.ROOT);
            if (!trimmed.isEmpty()) {
                try {
                    days.add(DayOfWeek.valueOf(trimmed));
                } catch (IllegalArgumentException ignored) {
                }
            }
        }
        return days.isEmpty() ? DEFAULT_WORKDAYS : days;
    }

    public static Set<LocalDate> parseHolidays(String holidaysJson, ObjectMapper om) {
        if (holidaysJson == null || holidaysJson.isBlank() || om == null) {
            return Collections.emptySet();
        }
        Set<LocalDate> set = new HashSet<>();
        try {
            JsonNode root = om.readTree(holidaysJson);
            if (root.isArray()) {
                for (JsonNode item : root) {
                    if (item.isTextual()) {
                        set.add(LocalDate.parse(item.asText()));
                    } else if (item.isObject() && item.has("date")) {
                        set.add(LocalDate.parse(item.get("date").asText()));
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return set;
    }
}
