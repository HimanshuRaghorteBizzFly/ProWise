package com.prowise.calendar;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

public final class CalendarDTOs {

    private CalendarDTOs() {}

    public record HolidayDto(
            @JsonProperty("date") LocalDate date,
            @JsonProperty("name") String name
    ) {}

    public record OrgCalendarDto(
            @JsonProperty("org_id") UUID orgId,
            @JsonProperty("workdays") List<String> workdays,
            @JsonProperty("holidays") List<HolidayDto> holidays,
            @JsonProperty("timezone") String timezone,
            @JsonProperty("default_cadence") String defaultCadence,
            @JsonProperty("default_cutoff_time") String defaultCutoffTime,
            @JsonProperty("default_grace_working_days") int defaultGraceWorkingDays,
            @JsonProperty("version") Long version
    ) {}

    public record UpdateOrgCalendarRequest(
            @JsonProperty("workdays") List<String> workdays,
            @JsonProperty("holidays") List<HolidayDto> holidays,
            @JsonProperty("timezone") String timezone,
            @JsonProperty("default_cadence") @JsonAlias({"default_cadence", "defaultCadence"}) String defaultCadence,
            @JsonProperty("default_cutoff_time") @JsonAlias({"default_cutoff_time", "defaultCutoffTime"}) String defaultCutoffTime,
            @JsonProperty("default_grace_working_days") @JsonAlias({"default_grace_working_days", "defaultGraceWorkingDays"}) Integer defaultGraceWorkingDays,
            @JsonProperty("expected_version") @JsonAlias({"expected_version", "expectedVersion"}) Long expectedVersion
    ) {}

    public record AddHolidayRequest(
            @JsonProperty("date") LocalDate date,
            @JsonProperty("name") String name
    ) {}

    public record ProjectCadenceDto(
            @JsonProperty("project_id") String projectId,
            @JsonProperty("org_id") UUID orgId,
            @JsonProperty("frequency") String frequency,
            @JsonProperty("day_of_week") String dayOfWeek,
            @JsonProperty("local_cutoff_time") String localCutoffTime,
            @JsonProperty("grace_working_days") int graceWorkingDays,
            @JsonProperty("reminder_offsets") List<Integer> reminderOffsets,
            @JsonProperty("policy_version") Long policyVersion,
            @JsonProperty("is_paused") boolean isPaused
    ) {}

    public record UpdateProjectCadenceRequest(
            @JsonProperty("frequency") String frequency,
            @JsonProperty("day_of_week") @JsonAlias({"day_of_week", "dayOfWeek"}) String dayOfWeek,
            @JsonProperty("local_cutoff_time") @JsonAlias({"local_cutoff_time", "localCutoffTime"}) String localCutoffTime,
            @JsonProperty("grace_working_days") @JsonAlias({"grace_working_days", "graceWorkingDays"}) Integer graceWorkingDays,
            @JsonProperty("reminder_offsets") @JsonAlias({"reminder_offsets", "reminderOffsets"}) List<Integer> reminderOffsets,
            @JsonProperty("is_paused") @JsonAlias({"is_paused", "isPaused"}) Boolean isPaused,
            @JsonProperty("reason") String reason
    ) {}

    public record RescheduleDeadlineRequest(
            @JsonProperty("new_target_date") @JsonAlias({"new_target_date", "newTargetDate"}) LocalDate newTargetDate,
            @JsonProperty("reason") String reason
    ) {}

    public record DueOccurrenceDto(
            @JsonProperty("id") String id,
            @JsonProperty("project_id") String projectId,
            @JsonProperty("kind") String kind,
            @JsonProperty("due_local_date") LocalDate dueLocalDate,
            @JsonProperty("grace_until_date") LocalDate graceUntilDate,
            @JsonProperty("zone") String zone,
            @JsonProperty("cutoff_instant") Instant cutoffInstant,
            @JsonProperty("grace_cutoff_instant") Instant graceCutoffInstant,
            @JsonProperty("policy_version") Long policyVersion,
            @JsonProperty("status") String status,
            @JsonProperty("checkin_id") String checkinId
    ) {}

    public record ScheduleSummaryDto(
            @JsonProperty("project_id") String projectId,
            @JsonProperty("project_key") String projectKey,
            @JsonProperty("project_name") String projectName,
            @JsonProperty("lifecycle") String lifecycle,
            @JsonProperty("target_date") LocalDate targetDate,
            @JsonProperty("zone") String zone,
            @JsonProperty("next_checkin") DueOccurrenceDto nextCheckin,
            @JsonProperty("next_checkin_status") String nextCheckinStatus, // 'DUE_TODAY', 'UPCOMING', 'GRACE_PERIOD', 'OVERDUE', 'PAUSED', 'NONE'
            @JsonProperty("rough_pace") Double roughPace,
            @JsonProperty("is_on_hold") boolean isOnHold,
            @JsonProperty("recent_occurrences") List<DueOccurrenceDto> recentOccurrences
    ) {}

    public record ReminderCandidateDto(
            @JsonProperty("id") String id,
            @JsonProperty("project_id") String projectId,
            @JsonProperty("occurrence_id") String occurrenceId,
            @JsonProperty("recipient_id") String recipientId,
            @JsonProperty("channel") String channel,
            @JsonProperty("condition") String condition,
            @JsonProperty("scheduled_for") Instant scheduledFor,
            @JsonProperty("status") String status
    ) {}
}
