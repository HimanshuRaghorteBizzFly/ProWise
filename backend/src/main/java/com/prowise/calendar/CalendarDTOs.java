package com.prowise.calendar;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/** Task 2.3 API shapes (snake_case on the wire). */
public final class CalendarDTOs {

    private CalendarDTOs() {}

    public record Holiday(LocalDate date, String name) {}

    public record OrgCalendar(List<String> workdays, List<Holiday> holidays, String timezone, long version, boolean canEdit) {}

    public record UpdateOrgCalendarRequest(List<String> workdays, List<Holiday> holidays, Long expectedVersion) {}

    public record CadenceChange(String previousFrequency, String newFrequency, Integer previousGrace, int newGrace,
            String previousCutoff, String newCutoff, String reason, String changedByEmail, Instant changedAt) {}

    public record ProjectCadence(String projectId, String frequency, String dayOfWeek, String localCutoffTime,
            int graceWorkingDays, long policyVersion, boolean paused, boolean canEdit, List<CadenceChange> history) {}

    public record UpdateCadenceRequest(String frequency, String dayOfWeek, String localCutoffTime, Integer graceWorkingDays,
            String reason, Long expectedVersion) {}

    public record Occurrence(String id, String kind, LocalDate dueLocalDate, LocalDate graceUntilDate, String zone,
            Instant cutoffInstant, Instant graceCutoffInstant, long policyVersion, String status, String display,
            String supersededReason) {}

    public record Compliance(int met, int missed, int eligible, int pending, int inGrace, int excused, BigDecimal rate) {}

    public record Schedule(String projectId, String lifecycle, String timezone, boolean onHold, LocalDate targetDate,
            Instant targetOverdueFrom, String targetDisplay, Occurrence nextCheckIn, Compliance compliance, BigDecimal roughPace,
            List<Occurrence> occurrences) {}
}
