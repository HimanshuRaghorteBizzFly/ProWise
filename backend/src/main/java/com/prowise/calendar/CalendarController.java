package com.prowise.calendar;

import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.calendar.CalendarDTOs.OrgCalendar;
import com.prowise.calendar.CalendarDTOs.ProjectCadence;
import com.prowise.calendar.CalendarDTOs.Schedule;
import com.prowise.calendar.CalendarDTOs.UpdateCadenceRequest;
import com.prowise.calendar.CalendarDTOs.UpdateOrgCalendarRequest;

/**
 * Task 2.3 routes. The org comes from the path and must match the caller's active membership (404 otherwise);
 * org.manage (calendar) and project.deadline.edit / project.edit (cadence) are checked in the service. Target dates
 * change through the project update (task 2.1: previous date + reason + history); occurrences follow in the same
 * transaction.
 */
@RestController
@RequestMapping("/v1/organizations/{orgId}")
public class CalendarController {

    private static final String MEMBER = "@permissionService.member(authentication, #orgId)";

    private final CalendarCadenceService calendar;

    public CalendarController(CalendarCadenceService calendar) {
        this.calendar = calendar;
    }

    @GetMapping("/calendar")
    @PreAuthorize(MEMBER)
    OrgCalendar orgCalendar(@PathVariable UUID orgId, Authentication authentication) {
        return calendar.orgCalendar(orgId, authentication);
    }

    @PutMapping("/calendar")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'org.manage')")
    OrgCalendar updateOrgCalendar(@PathVariable UUID orgId, Authentication authentication, @RequestBody UpdateOrgCalendarRequest request) {
        return calendar.updateOrgCalendar(orgId, authentication, request);
    }

    @GetMapping("/projects/{projectId}/cadence")
    @PreAuthorize(MEMBER)
    ProjectCadence cadence(@PathVariable UUID orgId, @PathVariable String projectId, Authentication authentication) {
        return calendar.cadence(orgId, projectId, authentication);
    }

    @PutMapping("/projects/{projectId}/cadence")
    @PreAuthorize(MEMBER)
    ProjectCadence updateCadence(@PathVariable UUID orgId, @PathVariable String projectId, Authentication authentication,
            @RequestBody UpdateCadenceRequest request) {
        return calendar.updateCadence(orgId, projectId, authentication, request);
    }

    @GetMapping("/projects/{projectId}/schedule")
    @PreAuthorize(MEMBER)
    Schedule schedule(@PathVariable UUID orgId, @PathVariable String projectId, Authentication authentication) {
        return calendar.schedule(orgId, projectId, authentication);
    }
}
