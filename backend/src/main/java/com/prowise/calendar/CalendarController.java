package com.prowise.calendar;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.developer.DeveloperAccess;
import com.prowise.developer.DeveloperAccess.Actor;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@Validated
@Tag(name = "Calendar & Cadence", description = "Working calendar, deadlines, occurrences, and cadence")
public class CalendarController {

    private final CalendarCadenceService calendarCadenceService;
    private final DeveloperAccess access;

    public CalendarController(CalendarCadenceService calendarCadenceService, DeveloperAccess access) {
        this.calendarCadenceService = calendarCadenceService;
        this.access = access;
    }

    // =========================================================================
    // 1. Organization Calendar
    // =========================================================================

    @GetMapping("/v1/organizations/{orgId}/calendar")
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "Get organization working calendar and holidays")
    public ResponseEntity<CalendarDTOs.OrgCalendarDto> getOrgCalendar(
            Authentication authentication,
            @PathVariable UUID orgId) {
        Actor actor = access.actor(authentication);
        return ResponseEntity.ok(calendarCadenceService.getOrgCalendar(actor, orgId));
    }

    @PutMapping("/v1/organizations/{orgId}/calendar")
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "Update organization working calendar (workdays, holidays, timezone, default cadence)")
    public ResponseEntity<CalendarDTOs.OrgCalendarDto> updateOrgCalendar(
            Authentication authentication,
            @PathVariable UUID orgId,
            @RequestBody CalendarDTOs.UpdateOrgCalendarRequest request) {
        Actor actor = access.actor(authentication);
        return ResponseEntity.ok(calendarCadenceService.updateOrgCalendar(actor, orgId, request));
    }

    @PostMapping("/v1/organizations/{orgId}/calendar/holidays")
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "Add or update an organization holiday")
    public ResponseEntity<CalendarDTOs.OrgCalendarDto> addHoliday(
            Authentication authentication,
            @PathVariable UUID orgId,
            @RequestBody CalendarDTOs.AddHolidayRequest request) {
        Actor actor = access.actor(authentication);
        return ResponseEntity.status(HttpStatus.CREATED).body(calendarCadenceService.addHoliday(actor, orgId, request));
    }

    @DeleteMapping("/v1/organizations/{orgId}/calendar/holidays/{date}")
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "Delete an organization holiday")
    public ResponseEntity<CalendarDTOs.OrgCalendarDto> deleteHoliday(
            Authentication authentication,
            @PathVariable UUID orgId,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        Actor actor = access.actor(authentication);
        return ResponseEntity.ok(calendarCadenceService.deleteHoliday(actor, orgId, date));
    }

    // =========================================================================
    // 2. Project Cadence
    // =========================================================================

    @GetMapping("/v1/projects/{projectId}/cadence")
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "Get project check-in cadence and cutoff configuration")
    public ResponseEntity<CalendarDTOs.ProjectCadenceDto> getProjectCadence(
            Authentication authentication,
            @PathVariable String projectId) {
        Actor actor = access.actor(authentication);
        return ResponseEntity.ok(calendarCadenceService.getProjectCadence(actor, projectId));
    }

    @PutMapping("/v1/projects/{projectId}/cadence")
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "Update project cadence, cutoff time, grace days, and pause state")
    public ResponseEntity<CalendarDTOs.ProjectCadenceDto> updateProjectCadence(
            Authentication authentication,
            @PathVariable String projectId,
            @RequestBody CalendarDTOs.UpdateProjectCadenceRequest request) {
        Actor actor = access.actor(authentication);
        return ResponseEntity.ok(calendarCadenceService.updateProjectCadence(actor, projectId, request));
    }

    // =========================================================================
    // 3. Reschedule Deadline
    // =========================================================================

    @PostMapping("/v1/projects/{projectId}/deadlines/reschedule")
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "Reschedule project target deadline with mandatory reason and versioning")
    public ResponseEntity<CalendarDTOs.DueOccurrenceDto> rescheduleDeadline(
            Authentication authentication,
            @PathVariable String projectId,
            @RequestBody CalendarDTOs.RescheduleDeadlineRequest request) {
        Actor actor = access.actor(authentication);
        return ResponseEntity.ok(calendarCadenceService.rescheduleTargetDeadline(actor, projectId, request));
    }

    // =========================================================================
    // 4. Occurrences & Schedule Summary
    // =========================================================================

    @GetMapping("/v1/projects/{projectId}/occurrences")
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "Get all occurrences for a project")
    public ResponseEntity<List<CalendarDTOs.DueOccurrenceDto>> getProjectOccurrences(
            Authentication authentication,
            @PathVariable String projectId) {
        Actor actor = access.actor(authentication);
        return ResponseEntity.ok(calendarCadenceService.getProjectOccurrences(actor, projectId));
    }

    @GetMapping("/v1/projects/{projectId}/schedule-summary")
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "Get project schedule summary with next due, grace deadline, pace, and status")
    public ResponseEntity<CalendarDTOs.ScheduleSummaryDto> getScheduleSummary(
            Authentication authentication,
            @PathVariable String projectId) {
        Actor actor = access.actor(authentication);
        return ResponseEntity.ok(calendarCadenceService.getScheduleSummary(actor, projectId));
    }

    // =========================================================================
    // 5. Reminder Candidates
    // =========================================================================

    @GetMapping("/v1/organizations/{orgId}/reminders/candidates")
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "Query reminder candidates for notification workers")
    public ResponseEntity<List<CalendarDTOs.ReminderCandidateDto>> getReminderCandidates(
            Authentication authentication,
            @PathVariable UUID orgId,
            @RequestParam(required = false) String status) {
        Actor actor = access.actor(authentication);
        return ResponseEntity.ok(calendarCadenceService.getReminderCandidates(actor, orgId, status));
    }
}
