package com.prowise.calendar;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.authz.SecurityEvidenceService;
import com.prowise.common.api.ApiException;
import com.prowise.common.audit.ChangeRecorder;
import com.prowise.developer.DeveloperAccess;
import com.prowise.developer.DeveloperAccess.Actor;
import com.prowise.developer.ProjectCheckInEntity;
import com.prowise.developer.ProjectCheckInRepository;
import com.prowise.developer.ProjectEntity;
import com.prowise.developer.ProjectRepository;

@Service
public class CalendarCadenceService {

    private static final Logger log = LoggerFactory.getLogger(CalendarCadenceService.class);

    private final OrgCalendarRepository orgCalendarRepository;
    private final ProjectCadenceRepository projectCadenceRepository;
    private final DueOccurrenceRepository dueOccurrenceRepository;
    private final ProjectCadenceHistoryRepository projectCadenceHistoryRepository;
    private final ReminderCandidateRepository reminderCandidateRepository;
    private final ProjectRepository projectRepository;
    private final ProjectCheckInRepository checkInRepository;
    private final DeveloperAccess access;
    private final SecurityEvidenceService evidence;
    private final ChangeRecorder changeRecorder;
    private final ObjectMapper objectMapper;

    public CalendarCadenceService(
            OrgCalendarRepository orgCalendarRepository,
            ProjectCadenceRepository projectCadenceRepository,
            DueOccurrenceRepository dueOccurrenceRepository,
            ProjectCadenceHistoryRepository projectCadenceHistoryRepository,
            ReminderCandidateRepository reminderCandidateRepository,
            ProjectRepository projectRepository,
            ProjectCheckInRepository checkInRepository,
            DeveloperAccess access,
            SecurityEvidenceService evidence,
            ChangeRecorder changeRecorder,
            ObjectMapper objectMapper) {
        this.orgCalendarRepository = orgCalendarRepository;
        this.projectCadenceRepository = projectCadenceRepository;
        this.dueOccurrenceRepository = dueOccurrenceRepository;
        this.projectCadenceHistoryRepository = projectCadenceHistoryRepository;
        this.reminderCandidateRepository = reminderCandidateRepository;
        this.projectRepository = projectRepository;
        this.checkInRepository = checkInRepository;
        this.access = access;
        this.evidence = evidence;
        this.changeRecorder = changeRecorder;
        this.objectMapper = objectMapper;
    }

    // =========================================================================
    // 1. ORGANIZATION CALENDAR
    // =========================================================================

    @Transactional
    public CalendarDTOs.OrgCalendarDto getOrgCalendar(Actor actor, UUID orgId) {
        verifyOrgAccess(actor, orgId);
        OrgCalendarEntity entity = getOrCreateOrgCalendar(orgId);
        return mapToOrgCalendarDto(entity);
    }

    @Transactional
    public CalendarDTOs.OrgCalendarDto updateOrgCalendar(
            Actor actor, UUID orgId, CalendarDTOs.UpdateOrgCalendarRequest request) {
        verifyOrgAccess(actor, orgId);

        // RBAC: Requires org.manage
        if (!access.canAtOrg(actor, PermissionKey.ORG_MANAGE)) {
            evidence.recordDenied(actor.principal(), SecurityEvidenceService.ACCESS_DENIED,
                    "ORGANIZATION", orgId.toString(), "Missing org.manage permission to update calendar");
            throw PermissionService.forbidden();
        }

        OrgCalendarEntity entity = getOrCreateOrgCalendar(orgId);

        // Optimistic locking version check
        if (request.expectedVersion() != null && !request.expectedVersion().equals(entity.getVersion())) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_VERSION",
                    "Organization calendar has been modified by another transaction. Expected version: "
                            + request.expectedVersion() + " but was " + entity.getVersion());
        }

        // Validate timezone
        if (request.timezone() != null && !request.timezone().isBlank()) {
            try {
                ZoneId.of(request.timezone().trim());
                entity.setTimezone(request.timezone().trim());
            } catch (Exception e) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TIMEZONE",
                        "Invalid IANA timezone: " + request.timezone());
            }
        }

        if (request.workdays() != null && !request.workdays().isEmpty()) {
            entity.setWorkdays(String.join(",", request.workdays()));
        }

        if (request.holidays() != null) {
            try {
                entity.setHolidays(objectMapper.writeValueAsString(request.holidays()));
            } catch (Exception e) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_HOLIDAYS", "Invalid holidays JSON");
            }
        }

        if (request.defaultCadence() != null && !request.defaultCadence().isBlank()) {
            entity.setDefaultCadence(request.defaultCadence().toUpperCase(Locale.ROOT).trim());
        }

        if (request.defaultCutoffTime() != null && !request.defaultCutoffTime().isBlank()) {
            entity.setDefaultCutoffTime(request.defaultCutoffTime().trim());
        }

        if (request.defaultGraceWorkingDays() != null) {
            if (request.defaultGraceWorkingDays() < 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_GRACE", "Grace working days cannot be negative.");
            }
            entity.setDefaultGraceWorkingDays(request.defaultGraceWorkingDays());
        }

        entity.setUpdatedAt(Instant.now());
        OrgCalendarEntity saved = orgCalendarRepository.save(entity);

        // Record audit change and outbox event
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("workdays", saved.getWorkdays());
        metadata.put("timezone", saved.getTimezone());
        metadata.put("default_cadence", saved.getDefaultCadence());
        metadata.put("default_grace", saved.getDefaultGraceWorkingDays());

        changeRecorder.recordChange(
                orgId,
                tryParseUuid(actor.userId()),
                "ORG_CALENDAR_UPDATED",
                "ORG_CALENDAR",
                orgId.toString(),
                metadata,
                "ORGANIZATION",
                orgId.toString(),
                "OrgCalendarUpdatedEvent",
                saved.getVersion(),
                metadata
        );

        return mapToOrgCalendarDto(saved);
    }

    @Transactional
    public CalendarDTOs.OrgCalendarDto addHoliday(Actor actor, UUID orgId, CalendarDTOs.AddHolidayRequest request) {
        verifyOrgAccess(actor, orgId);
        if (!access.canAtOrg(actor, PermissionKey.ORG_MANAGE)) {
            throw PermissionService.forbidden();
        }
        if (request.date() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DATE", "Holiday date is required.");
        }

        OrgCalendarEntity entity = getOrCreateOrgCalendar(orgId);
        List<CalendarDTOs.HolidayDto> list = parseHolidayList(entity.getHolidays());

        // Remove if exists for same date
        list.removeIf(h -> h.date().equals(request.date()));
        list.add(new CalendarDTOs.HolidayDto(request.date(), request.name() != null ? request.name().trim() : "Holiday"));

        try {
            entity.setHolidays(objectMapper.writeValueAsString(list));
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_HOLIDAYS", "Could not serialize holidays");
        }
        entity.setUpdatedAt(Instant.now());
        OrgCalendarEntity saved = orgCalendarRepository.save(entity);
        return mapToOrgCalendarDto(saved);
    }

    @Transactional
    public CalendarDTOs.OrgCalendarDto deleteHoliday(Actor actor, UUID orgId, LocalDate date) {
        verifyOrgAccess(actor, orgId);
        if (!access.canAtOrg(actor, PermissionKey.ORG_MANAGE)) {
            throw PermissionService.forbidden();
        }
        OrgCalendarEntity entity = getOrCreateOrgCalendar(orgId);
        List<CalendarDTOs.HolidayDto> list = parseHolidayList(entity.getHolidays());
        list.removeIf(h -> h.date().equals(date));

        try {
            entity.setHolidays(objectMapper.writeValueAsString(list));
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_HOLIDAYS", "Could not serialize holidays");
        }
        entity.setUpdatedAt(Instant.now());
        OrgCalendarEntity saved = orgCalendarRepository.save(entity);
        return mapToOrgCalendarDto(saved);
    }

    // =========================================================================
    // 2. PROJECT CADENCE & SCHEDULING
    // =========================================================================

    @Transactional
    public CalendarDTOs.ProjectCadenceDto getProjectCadence(Actor actor, String projectId) {
        ProjectEntity project = findVisibleProject(actor, projectId);
        ProjectCadenceEntity cadence = getOrCreateProjectCadence(project);
        return mapToProjectCadenceDto(cadence);
    }

    @Transactional
    public CalendarDTOs.ProjectCadenceDto updateProjectCadence(
            Actor actor, String projectId, CalendarDTOs.UpdateProjectCadenceRequest request) {
        ProjectEntity project = findVisibleProject(actor, projectId);

        // RBAC: Requires deadline/edit permission
        boolean canEdit = access.can(actor, project.getId(), PermissionKey.PROJECT_DEADLINE_EDIT)
                || access.can(actor, project.getId(), PermissionKey.PROJECT_EDIT)
                || access.can(actor, project.getId(), PermissionKey.TEAM_MANAGE)
                || access.canAtOrg(actor, PermissionKey.ORG_MANAGE);

        if (!canEdit) {
            evidence.recordDenied(actor.principal(), SecurityEvidenceService.ACCESS_DENIED,
                    "PROJECT", projectId, "Missing deadline edit permission to update cadence");
            throw PermissionService.forbidden();
        }

        if (request.reason() == null || request.reason().trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "REASON_REQUIRED",
                    "A mandatory reason is required when modifying project cadence or scheduling.");
        }

        ProjectCadenceEntity cadence = getOrCreateProjectCadence(project);

        // Record history
        ProjectCadenceHistoryEntity history = new ProjectCadenceHistoryEntity();
        history.setId("cadh-" + UUID.randomUUID().toString().substring(0, 12));
        history.setOrgId(project.getOrgId());
        history.setProjectId(project.getId());
        history.setPreviousFrequency(cadence.getFrequency());
        history.setNewFrequency(request.frequency() != null ? request.frequency().toUpperCase(Locale.ROOT) : cadence.getFrequency());
        history.setPreviousGrace(cadence.getGraceWorkingDays());
        history.setNewGrace(request.graceWorkingDays() != null ? request.graceWorkingDays() : cadence.getGraceWorkingDays());
        history.setPreviousCutoff(cadence.getLocalCutoffTime());
        history.setNewCutoff(request.localCutoffTime() != null ? request.localCutoffTime() : cadence.getLocalCutoffTime());
        history.setReason(request.reason().trim());
        history.setChangedBy(actor.userId());
        history.setCreatedAt(Instant.now());
        projectCadenceHistoryRepository.save(history);

        // Apply updates
        if (request.frequency() != null && !request.frequency().isBlank()) {
            cadence.setFrequency(request.frequency().toUpperCase(Locale.ROOT).trim());
        }
        if (request.dayOfWeek() != null && !request.dayOfWeek().isBlank()) {
            cadence.setDayOfWeek(request.dayOfWeek().toUpperCase(Locale.ROOT).trim());
        }
        if (request.localCutoffTime() != null && !request.localCutoffTime().isBlank()) {
            cadence.setLocalCutoffTime(request.localCutoffTime().trim());
        }
        if (request.graceWorkingDays() != null) {
            if (request.graceWorkingDays() < 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_GRACE", "Grace days cannot be negative");
            }
            cadence.setGraceWorkingDays(request.graceWorkingDays());
        }
        if (request.reminderOffsets() != null) {
            try {
                cadence.setReminderOffsets(objectMapper.writeValueAsString(request.reminderOffsets()));
            } catch (Exception ignored) {}
        }
        if (request.isPaused() != null) {
            cadence.setPaused(request.isPaused());
        }

        // Increment policy version
        cadence.setPolicyVersion(cadence.getPolicyVersion() + 1);
        cadence.setUpdatedAt(Instant.now());
        ProjectCadenceEntity saved = projectCadenceRepository.save(cadence);

        // Invalidate / Supersede prior open occurrences for this project
        supersedeOpenOccurrences(project.getId(), "CHECKIN");

        // If not paused and project not ON_HOLD, regenerate occurrences
        if (!saved.isPaused() && !"ON_HOLD".equalsIgnoreCase(project.getLifecycle())) {
            generateNextOccurrences(project, saved);
        }

        return mapToProjectCadenceDto(saved);
    }

    // =========================================================================
    // 3. TARGET DEADLINE RESCHEDULING & OCCURRENCES
    // =========================================================================

    @Transactional
    public CalendarDTOs.DueOccurrenceDto rescheduleTargetDeadline(
            Actor actor, String projectId, CalendarDTOs.RescheduleDeadlineRequest request) {
        ProjectEntity project = findVisibleProject(actor, projectId);

        boolean canEdit = access.can(actor, project.getId(), PermissionKey.PROJECT_DEADLINE_EDIT)
                || access.can(actor, project.getId(), PermissionKey.PROJECT_EDIT)
                || access.can(actor, project.getId(), PermissionKey.TEAM_MANAGE)
                || access.canAtOrg(actor, PermissionKey.ORG_MANAGE);

        if (!canEdit) {
            throw PermissionService.forbidden();
        }

        if (request.newTargetDate() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DATE_REQUIRED", "New target date is required.");
        }
        if (request.reason() == null || request.reason().trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "REASON_REQUIRED",
                    "A mandatory reason is required when rescheduling target deadline (FR-037).");
        }

        ProjectCadenceEntity cadence = getOrCreateProjectCadence(project);
        OrgCalendarEntity orgCal = getOrCreateOrgCalendar(project.getOrgId());
        WorkingCalendar cal = WorkingCalendar.from(orgCal.getWorkdays(), orgCal.getHolidays(), project.getTimezone(), objectMapper);
        ZoneId zone = cal.getZone();

        LocalDate oldTargetDate = getProjectTargetDate(project, zone);
        LocalTime cutoff = parseLocalTime(cadence.getLocalCutoffTime());
        Instant newTargetInstant = cal.cutoffInstant(request.newTargetDate(), cutoff);

        // Update project targetDate
        project.setTargetDate(newTargetInstant);
        project.setUpdatedAt(Instant.now());
        projectRepository.save(project);

        // Supersede prior TARGET occurrences
        supersedeOpenOccurrences(project.getId(), "TARGET");

        // Generate new TARGET occurrence
        DueOccurrenceEntity newOcc = createTargetOccurrence(project, cadence, cal, request.newTargetDate());
        DueOccurrenceEntity saved = dueOccurrenceRepository.save(newOcc);

        // Record change
        Map<String, Object> meta = new HashMap<>();
        meta.put("previous_target_date", oldTargetDate != null ? oldTargetDate.toString() : null);
        meta.put("new_target_date", request.newTargetDate().toString());
        meta.put("reason", request.reason().trim());
        meta.put("policy_version", cadence.getPolicyVersion());

        changeRecorder.recordChange(
                project.getOrgId(),
                tryParseUuid(actor.userId()),
                "PROJECT_TARGET_RESCHEDULED",
                "PROJECT",
                project.getId(),
                meta,
                "PROJECT",
                project.getId(),
                "ProjectTargetRescheduledEvent",
                project.getVersion(),
                meta
        );

        return mapToDueOccurrenceDto(saved);
    }

    // =========================================================================
    // 4. OCCURRENCE GENERATION & SCHEDULE SUMMARY
    // =========================================================================

    @Transactional
    public List<CalendarDTOs.DueOccurrenceDto> getProjectOccurrences(Actor actor, String projectId) {
        ProjectEntity project = findVisibleProject(actor, projectId);
        ProjectCadenceEntity cadence = getOrCreateProjectCadence(project);

        // Ensure current occurrences exist if active
        if (!cadence.isPaused() && !"ON_HOLD".equalsIgnoreCase(project.getLifecycle())) {
            generateNextOccurrences(project, cadence);
        }

        List<DueOccurrenceEntity> list = dueOccurrenceRepository
                .findByOrgIdAndProjectIdOrderByDueLocalDateAsc(project.getOrgId(), project.getId());

        return list.stream().map(this::mapToDueOccurrenceDto).toList();
    }

    @Transactional
    public CalendarDTOs.ScheduleSummaryDto getScheduleSummary(Actor actor, String projectId) {
        ProjectEntity project = findVisibleProject(actor, projectId);
        ProjectCadenceEntity cadence = getOrCreateProjectCadence(project);
        OrgCalendarEntity orgCal = getOrCreateOrgCalendar(project.getOrgId());
        WorkingCalendar cal = WorkingCalendar.from(orgCal.getWorkdays(), orgCal.getHolidays(), project.getTimezone(), objectMapper);
        ZoneId zone = cal.getZone();

        boolean isOnHold = "ON_HOLD".equalsIgnoreCase(project.getLifecycle()) || cadence.isPaused();

        if (!isOnHold) {
            generateNextOccurrences(project, cadence);
        }

        // Find next open or latest checkin occurrence
        List<DueOccurrenceEntity> openOccurrences = dueOccurrenceRepository
                .findByOrgIdAndProjectIdAndStatusOrderByDueLocalDateAsc(project.getOrgId(), project.getId(), "OPEN");

        DueOccurrenceEntity nextCheckin = openOccurrences.stream()
                .filter(o -> "CHECKIN".equals(o.getKind()))
                .findFirst()
                .orElse(null);

        Instant now = Instant.now();
        String nextStatus = resolveOccurrenceStatus(nextCheckin, now, isOnHold);

        // Compute rough pace: (elapsed completed planned working days / total planned working days) * 100
        Double roughPace = computeRoughPace(project, cal, now);

        List<DueOccurrenceEntity> recent = dueOccurrenceRepository
                .findByOrgIdAndProjectIdOrderByDueLocalDateAsc(project.getOrgId(), project.getId());

        List<CalendarDTOs.DueOccurrenceDto> recentDtos = recent.stream()
                .map(this::mapToDueOccurrenceDto)
                .toList();

        LocalDate targetLocalDate = getProjectTargetDate(project, zone);

        return new CalendarDTOs.ScheduleSummaryDto(
                project.getId(),
                project.getKey(),
                project.getName(),
                project.getLifecycle(),
                targetLocalDate,
                project.getTimezone(),
                nextCheckin != null ? mapToDueOccurrenceDto(nextCheckin) : null,
                nextStatus,
                roughPace,
                isOnHold,
                recentDtos
        );
    }

    /**
     * Resolves dynamic status for an occurrence relative to current instant.
     */
    public String resolveOccurrenceStatus(DueOccurrenceEntity occ, Instant now, boolean isOnHold) {
        if (occ == null) return "NONE";
        if (isOnHold) return "PAUSED";
        if ("MET".equalsIgnoreCase(occ.getStatus())) return "MET";
        if ("SUPERSEDED".equalsIgnoreCase(occ.getStatus())) return "SUPERSEDED";
        if ("EXCUSED".equalsIgnoreCase(occ.getStatus())) return "EXCUSED";

        // Check if a check-in was submitted for this window (task 2.2: submissions start PENDING; the developer
        // reported on time even while the Team Lead decision is outstanding)
        Optional<ProjectCheckInEntity> checkin = checkInRepository
                .findTop1ByOrgIdAndProjectIdOrderByRevisionSeqDescCreatedAtDesc(occ.getOrgId(), occ.getProjectId());

        if (checkin.isPresent() && checkin.get().getCapturedAt().isAfter(occ.getCutoffInstant().minus(Duration.ofDays(7)))) {
            // Checkin completed
            return "MET";
        }

        if (now.isBefore(occ.getCutoffInstant())) {
            // If within 24 hours of cutoff or same local date
            LocalDate localNow = LocalDate.ofInstant(now, ZoneId.of(occ.getZone()));
            if (localNow.equals(occ.getDueLocalDate())) {
                return "DUE_TODAY";
            }
            return "UPCOMING";
        }

        if (now.isAfter(occ.getCutoffInstant()) && now.isBefore(occ.getGraceCutoffInstant())) {
            return "GRACE_PERIOD";
        }

        return "OVERDUE";
    }

    // =========================================================================
    // 5. REMINDER CANDIDATES (TASK 5.2 PREPARATION & VERIFICATION)
    // =========================================================================

    @Transactional(readOnly = true)
    public List<CalendarDTOs.ReminderCandidateDto> getReminderCandidates(Actor actor, UUID orgId, String status) {
        verifyOrgAccess(actor, orgId);
        List<ReminderCandidateEntity> list = (status != null && !status.isBlank())
                ? reminderCandidateRepository.findByOrgIdAndStatusOrderByScheduledForAsc(orgId, status.toUpperCase(Locale.ROOT))
                : reminderCandidateRepository.findByOrgIdAndStatusOrderByScheduledForAsc(orgId, "PENDING");

        return list.stream().map(this::mapToReminderCandidateDto).toList();
    }

    // =========================================================================
    // HELPER & CALCULATION METHODS
    // =========================================================================

    public void generateNextOccurrences(ProjectEntity project, ProjectCadenceEntity cadence) {
        OrgCalendarEntity orgCal = getOrCreateOrgCalendar(project.getOrgId());
        WorkingCalendar cal = WorkingCalendar.from(orgCal.getWorkdays(), orgCal.getHolidays(), project.getTimezone(), objectMapper);
        ZoneId zone = cal.getZone();

        // 1. Target occurrence if targetDate is set
        LocalDate targetLocalDate = getProjectTargetDate(project, zone);
        if (targetLocalDate != null) {
            Optional<DueOccurrenceEntity> existingTarget = dueOccurrenceRepository
                    .findByProjectIdAndKindAndDueLocalDateAndPolicyVersion(
                            project.getId(), "TARGET", targetLocalDate, cadence.getPolicyVersion());

            if (existingTarget.isEmpty()) {
                DueOccurrenceEntity targetOcc = createTargetOccurrence(project, cadence, cal, targetLocalDate);
                dueOccurrenceRepository.save(targetOcc);
                createReminderCandidates(targetOcc, project, cadence, cal);
            }
        }

        // 2. Next check-in occurrence
        LocalDate nextDueDate = computeNextCheckInDueDate(cadence, cal);
        Optional<DueOccurrenceEntity> existingCheckin = dueOccurrenceRepository
                .findByProjectIdAndKindAndDueLocalDateAndPolicyVersion(
                        project.getId(), "CHECKIN", nextDueDate, cadence.getPolicyVersion());

        if (existingCheckin.isEmpty()) {
            DueOccurrenceEntity checkinOcc = createCheckInOccurrence(project, cadence, cal, nextDueDate);
            dueOccurrenceRepository.save(checkinOcc);
            createReminderCandidates(checkinOcc, project, cadence, cal);
        }
    }

    public LocalDate computeNextCheckInDueDate(ProjectCadenceEntity cadence, WorkingCalendar cal) {
        LocalDate today = LocalDate.now(cal.getZone());
        String freq = cadence.getFrequency() != null ? cadence.getFrequency().toUpperCase(Locale.ROOT) : "WEEKLY";

        if ("DAILY".equals(freq)) {
            return cal.isWorkingDay(today) ? today : cal.nextWorkingDay(today);
        }

        // Weekly or Fortnightly: find day_of_week
        DayOfWeek targetDay;
        try {
            targetDay = DayOfWeek.valueOf(cadence.getDayOfWeek().toUpperCase(Locale.ROOT));
        } catch (Exception e) {
            targetDay = DayOfWeek.FRIDAY;
        }

        LocalDate candidate = today;
        while (candidate.getDayOfWeek() != targetDay) {
            candidate = candidate.plusDays(1);
        }

        // If today is targetDay and past cutoff, advance to next cycle
        LocalTime cutoff = parseLocalTime(cadence.getLocalCutoffTime());
        ZonedDateTime nowZdt = ZonedDateTime.now(cal.getZone());
        if (candidate.equals(today) && nowZdt.toLocalTime().isAfter(cutoff)) {
            candidate = candidate.plusWeeks("FORTNIGHTLY".equals(freq) ? 2 : 1);
        }

        return candidate;
    }

    private DueOccurrenceEntity createCheckInOccurrence(
            ProjectEntity project, ProjectCadenceEntity cadence, WorkingCalendar cal, LocalDate dueDate) {
        LocalTime cutoff = parseLocalTime(cadence.getLocalCutoffTime());
        LocalDate graceUntil = cal.addWorkingDays(dueDate, cadence.getGraceWorkingDays());
        Instant cutoffInst = cal.cutoffInstant(dueDate, cutoff);
        Instant graceCutoffInst = cal.cutoffInstant(graceUntil, cutoff);

        DueOccurrenceEntity occ = new DueOccurrenceEntity();
        occ.setId("occ-" + UUID.randomUUID().toString().substring(0, 12));
        occ.setOrgId(project.getOrgId());
        occ.setProjectId(project.getId());
        occ.setKind("CHECKIN");
        occ.setDueLocalDate(dueDate);
        occ.setGraceUntilDate(graceUntil);
        occ.setZone(project.getTimezone());
        occ.setCutoffInstant(cutoffInst);
        occ.setGraceCutoffInstant(graceCutoffInst);
        occ.setPolicyVersion(cadence.getPolicyVersion());
        occ.setStatus("OPEN");
        occ.setCreatedAt(Instant.now());
        occ.setUpdatedAt(Instant.now());
        return occ;
    }

    private DueOccurrenceEntity createTargetOccurrence(
            ProjectEntity project, ProjectCadenceEntity cadence, WorkingCalendar cal, LocalDate targetDate) {
        LocalTime cutoff = parseLocalTime(cadence.getLocalCutoffTime());
        LocalDate graceUntil = cal.addWorkingDays(targetDate, cadence.getGraceWorkingDays());
        Instant cutoffInst = cal.cutoffInstant(targetDate, cutoff);
        Instant graceCutoffInst = cal.cutoffInstant(graceUntil, cutoff);

        DueOccurrenceEntity occ = new DueOccurrenceEntity();
        occ.setId("occ-" + UUID.randomUUID().toString().substring(0, 12));
        occ.setOrgId(project.getOrgId());
        occ.setProjectId(project.getId());
        occ.setKind("TARGET");
        occ.setDueLocalDate(targetDate);
        occ.setGraceUntilDate(graceUntil);
        occ.setZone(project.getTimezone());
        occ.setCutoffInstant(cutoffInst);
        occ.setGraceCutoffInstant(graceCutoffInst);
        occ.setPolicyVersion(cadence.getPolicyVersion());
        occ.setStatus("OPEN");
        occ.setCreatedAt(Instant.now());
        occ.setUpdatedAt(Instant.now());
        return occ;
    }

    private void createReminderCandidates(
            DueOccurrenceEntity occ, ProjectEntity project, ProjectCadenceEntity cadence, WorkingCalendar cal) {
        String recipient = project.getAccountableDeveloperId() != null
                ? project.getAccountableDeveloperId()
                : (project.getProjectManagerId() != null ? project.getProjectManagerId() : "usr-lead");

        List<Integer> offsets = parseReminderOffsets(cadence.getReminderOffsets());
        for (int offset : offsets) {
            LocalDate alertDay = cal.addWorkingDays(occ.getDueLocalDate(), -offset);
            Instant scheduled = cal.cutoffInstant(alertDay, LocalTime.of(9, 0));

            ReminderCandidateEntity cand = new ReminderCandidateEntity();
            cand.setId("rem-" + UUID.randomUUID().toString().substring(0, 12));
            cand.setOrgId(project.getOrgId());
            cand.setProjectId(project.getId());
            cand.setOccurrenceId(occ.getId());
            cand.setRecipientId(recipient);
            cand.setChannel("EMAIL");
            cand.setCondition("UPCOMING_DUE");
            cand.setScheduledFor(scheduled);
            cand.setStatus("PENDING");
            cand.setCreatedAt(Instant.now());
            reminderCandidateRepository.save(cand);
        }

        // Grace warning candidate at cutoff
        ReminderCandidateEntity graceCand = new ReminderCandidateEntity();
        graceCand.setId("rem-" + UUID.randomUUID().toString().substring(0, 12));
        graceCand.setOrgId(project.getOrgId());
        graceCand.setProjectId(project.getId());
        graceCand.setOccurrenceId(occ.getId());
        graceCand.setRecipientId(recipient);
        graceCand.setChannel("EMAIL");
        graceCand.setCondition("GRACE_WARNING");
        graceCand.setScheduledFor(occ.getCutoffInstant());
        graceCand.setStatus("PENDING");
        graceCand.setCreatedAt(Instant.now());
        reminderCandidateRepository.save(graceCand);

        // Missed check-in candidate at grace cutoff
        ReminderCandidateEntity missedCand = new ReminderCandidateEntity();
        missedCand.setId("rem-" + UUID.randomUUID().toString().substring(0, 12));
        missedCand.setOrgId(project.getOrgId());
        missedCand.setProjectId(project.getId());
        missedCand.setOccurrenceId(occ.getId());
        missedCand.setRecipientId(recipient);
        missedCand.setChannel("EMAIL");
        missedCand.setCondition("MISSED_CHECKIN");
        missedCand.setScheduledFor(occ.getGraceCutoffInstant());
        missedCand.setStatus("PENDING");
        missedCand.setCreatedAt(Instant.now());
        reminderCandidateRepository.save(missedCand);
    }

    private void supersedeOpenOccurrences(String projectId, String kind) {
        ProjectEntity p = projectRepository.findById(projectId).orElse(null);
        if (p == null) return;

        List<DueOccurrenceEntity> occurrences = dueOccurrenceRepository
                .findByOrgIdAndProjectIdAndStatusOrderByDueLocalDateAsc(p.getOrgId(), projectId, "OPEN");

        for (DueOccurrenceEntity occ : occurrences) {
            if (kind == null || kind.equalsIgnoreCase(occ.getKind())) {
                occ.setStatus("SUPERSEDED");
                occ.setUpdatedAt(Instant.now());
                dueOccurrenceRepository.save(occ);

                // Cancel pending reminder candidates for this occurrence
                List<ReminderCandidateEntity> candidates = reminderCandidateRepository.findByOccurrenceId(occ.getId());
                for (ReminderCandidateEntity c : candidates) {
                    if ("PENDING".equalsIgnoreCase(c.getStatus())) {
                        c.setStatus("CANCELLED");
                        reminderCandidateRepository.save(c);
                    }
                }
            }
        }
    }

    private Double computeRoughPace(ProjectEntity project, WorkingCalendar cal, Instant now) {
        LocalDate start = getProjectStartDate(project, cal.getZone());
        LocalDate target = getProjectTargetDate(project, cal.getZone());
        if (start == null || target == null || start.isAfter(target)) {
            return null;
        }

        long totalWorkingDays = cal.workingDaysBetween(start, target);
        if (totalWorkingDays <= 0) {
            return null;
        }

        LocalDate localNow = LocalDate.ofInstant(now, cal.getZone());
        if (localNow.isBefore(start)) {
            return 0.0;
        }
        if (localNow.isAfter(target)) {
            return 100.0;
        }

        long elapsedWorkingDays = cal.workingDaysBetween(start, localNow);
        double pace = ((double) elapsedWorkingDays / (double) totalWorkingDays) * 100.0;
        return Math.min(100.0, Math.max(0.0, Math.round(pace * 10.0) / 10.0));
    }

    private LocalDate getProjectTargetDate(ProjectEntity project, ZoneId zone) {
        if (project.getTargetDate() == null) return null;
        return LocalDate.ofInstant(project.getTargetDate(), zone);
    }

    private LocalDate getProjectStartDate(ProjectEntity project, ZoneId zone) {
        if (project.getStartDate() == null) return null;
        return LocalDate.ofInstant(project.getStartDate(), zone);
    }

    private LocalTime parseLocalTime(String time) {
        if (time == null || time.isBlank()) return WorkingCalendar.DEFAULT_CUTOFF;
        try {
            return LocalTime.parse(time.trim());
        } catch (Exception e) {
            return WorkingCalendar.DEFAULT_CUTOFF;
        }
    }

    private List<Integer> parseReminderOffsets(String json) {
        if (json == null || json.isBlank()) return List.of(3, 1);
        try {
            return objectMapper.readValue(json, new TypeReference<List<Integer>>() {});
        } catch (Exception e) {
            return List.of(3, 1);
        }
    }

    private List<CalendarDTOs.HolidayDto> parseHolidayList(String json) {
        if (json == null || json.isBlank()) return new ArrayList<>();
        try {
            return objectMapper.readValue(json, new TypeReference<List<CalendarDTOs.HolidayDto>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private OrgCalendarEntity getOrCreateOrgCalendar(UUID orgId) {
        return orgCalendarRepository.findByOrgId(orgId).orElseGet(() -> {
            OrgCalendarEntity e = new OrgCalendarEntity(orgId);
            return orgCalendarRepository.save(e);
        });
    }

    private ProjectCadenceEntity getOrCreateProjectCadence(ProjectEntity project) {
        return projectCadenceRepository.findByProjectIdAndOrgId(project.getId(), project.getOrgId())
                .orElseGet(() -> {
                    ProjectCadenceEntity c = new ProjectCadenceEntity();
                    c.setProjectId(project.getId());
                    c.setOrgId(project.getOrgId());
                    c.setFrequency("WEEKLY");
                    c.setDayOfWeek("FRIDAY");
                    c.setLocalCutoffTime("17:00");
                    c.setGraceWorkingDays(1);
                    c.setReminderOffsets("[3, 1]");
                    c.setPolicyVersion(0L);
                    c.setPaused("ON_HOLD".equalsIgnoreCase(project.getLifecycle()));
                    c.setCreatedAt(Instant.now());
                    c.setUpdatedAt(Instant.now());
                    return projectCadenceRepository.save(c);
                });
    }

    private ProjectEntity findVisibleProject(Actor actor, String projectId) {
        ProjectEntity project = projectRepository.findById(projectId)
                .orElseThrow(() -> access.notFound(actor, "PROJECT", projectId));

        if (!actor.orgId().equals(project.getOrgId())) {
            evidence.recordDenied(actor.principal(), SecurityEvidenceService.ACCESS_DENIED, "PROJECT",
                    projectId, "Foreign organization project access");
            throw PermissionService.notFound();
        }

        if (!access.canRead(actor, projectId)) {
            evidence.recordDenied(actor.principal(), SecurityEvidenceService.ACCESS_DENIED, "PROJECT",
                    projectId, "Missing project read permission");
            throw PermissionService.notFound();
        }

        return project;
    }

    private void verifyOrgAccess(Actor actor, UUID orgId) {
        if (!actor.orgId().equals(orgId)) {
            evidence.recordDenied(actor.principal(), SecurityEvidenceService.ACCESS_DENIED, "ORGANIZATION",
                    orgId.toString(), "Foreign organization calendar access");
            throw PermissionService.notFound();
        }
    }

    private UUID tryParseUuid(String val) {
        try {
            return UUID.fromString(val);
        } catch (Exception e) {
            return null;
        }
    }

    private CalendarDTOs.OrgCalendarDto mapToOrgCalendarDto(OrgCalendarEntity e) {
        List<String> workdays = e.getWorkdays() != null
                ? List.of(e.getWorkdays().split(","))
                : List.of("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY");

        return new CalendarDTOs.OrgCalendarDto(
                e.getOrgId(),
                workdays,
                parseHolidayList(e.getHolidays()),
                e.getTimezone(),
                e.getDefaultCadence(),
                e.getDefaultCutoffTime(),
                e.getDefaultGraceWorkingDays(),
                e.getVersion()
        );
    }

    private CalendarDTOs.ProjectCadenceDto mapToProjectCadenceDto(ProjectCadenceEntity c) {
        return new CalendarDTOs.ProjectCadenceDto(
                c.getProjectId(),
                c.getOrgId(),
                c.getFrequency(),
                c.getDayOfWeek(),
                c.getLocalCutoffTime(),
                c.getGraceWorkingDays(),
                parseReminderOffsets(c.getReminderOffsets()),
                c.getPolicyVersion(),
                c.isPaused()
        );
    }

    private CalendarDTOs.DueOccurrenceDto mapToDueOccurrenceDto(DueOccurrenceEntity o) {
        return new CalendarDTOs.DueOccurrenceDto(
                o.getId(),
                o.getProjectId(),
                o.getKind(),
                o.getDueLocalDate(),
                o.getGraceUntilDate(),
                o.getZone(),
                o.getCutoffInstant(),
                o.getGraceCutoffInstant(),
                o.getPolicyVersion(),
                o.getStatus(),
                o.getCheckinId()
        );
    }

    private CalendarDTOs.ReminderCandidateDto mapToReminderCandidateDto(ReminderCandidateEntity r) {
        return new CalendarDTOs.ReminderCandidateDto(
                r.getId(),
                r.getProjectId(),
                r.getOccurrenceId(),
                r.getRecipientId(),
                r.getChannel(),
                r.getCondition(),
                r.getScheduledFor(),
                r.getStatus()
        );
    }
}
