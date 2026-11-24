package com.prowise.calendar;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.calendar.CalendarDTOs.CadenceChange;
import com.prowise.calendar.CalendarDTOs.Compliance;
import com.prowise.calendar.CalendarDTOs.Holiday;
import com.prowise.calendar.CalendarDTOs.Occurrence;
import com.prowise.calendar.CalendarDTOs.OrgCalendar;
import com.prowise.calendar.CalendarDTOs.ProjectCadence;
import com.prowise.calendar.CalendarDTOs.Schedule;
import com.prowise.calendar.CalendarDTOs.UpdateCadenceRequest;
import com.prowise.calendar.CalendarDTOs.UpdateOrgCalendarRequest;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.domain.CheckInSchedule;
import com.prowise.domain.CheckInSchedule.Display;
import com.prowise.domain.CheckInSchedule.Frequency;
import com.prowise.project.ProjectScheduleChanged;
import com.prowise.project.ProjectService;
import com.prowise.project.ProjectService.ProjectResponse;

/**
 * Task 2.3: the organization work calendar (workdays, holidays), project check-in cadence and grace, and the due
 * occurrences they produce. One shared calendar calculation (com.prowise.domain.CheckInSchedule) feeds deadlines,
 * grace and pace. Occurrences are materialized idempotently by {@link #reconcile}: a project has at most one live
 * (OPEN or PAUSED) check-in and one live target occurrence; changes supersede, never delete. Reminder delivery is 5.2.
 */
@Service
public class CalendarCadenceService {

    private static final List<String> DAYS = List.of("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY");
    private static final Set<String> CLOSED_LIFECYCLES = Set.of("DELIVERED", "CLOSED", "CANCELLED");

    private final JdbcTemplate jdbc;
    private final ProjectService projects;
    private final PermissionService permissions;
    private final ChangeRecorder changes;
    private final ObjectMapper json;

    public CalendarCadenceService(JdbcTemplate jdbc, ProjectService projects, PermissionService permissions, ChangeRecorder changes,
            ObjectMapper json) {
        this.jdbc = jdbc;
        this.projects = projects;
        this.permissions = permissions;
        this.changes = changes;
        this.json = json;
    }

    /* ================================================================== organization calendar */

    @Transactional
    public OrgCalendar orgCalendar(UUID orgId, Authentication auth) {
        permissions.requireMembership(auth, orgId);
        ensureOrgCalendar(orgId);
        return readOrgCalendar(orgId, permissions.can(auth, orgId, PermissionKey.ORG_MANAGE.value()));
    }

    @Transactional
    public OrgCalendar updateOrgCalendar(UUID orgId, Authentication auth, UpdateOrgCalendarRequest request) {
        if (!permissions.can(auth, orgId, PermissionKey.ORG_MANAGE.value())) throw PermissionService.forbidden();
        if (request.expectedVersion() == null) throw validation("expected_version", "is required");
        List<String> workdays = workdays(request.workdays());
        List<Holiday> holidays = holidays(request.holidays());
        ensureOrgCalendar(orgId);
        OrgCalendar before = readOrgCalendar(orgId, true);
        ExpectedVersion.check(before.version(), request.expectedVersion());
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE org_calendar SET workdays = ?, holidays = ?::jsonb, version = version + 1, updated_at = now()
                WHERE org_id = ? AND version = ?
                """, String.join(",", workdays), write(holidays), orgId, request.expectedVersion()));
        // A new calendar changes due and grace dates: open future windows are superseded and recomputed once.
        Instant now = Instant.now();
        List<String> projectIds = jdbc.queryForList(
                "SELECT id FROM projects WHERE org_id = ? AND archived = false ORDER BY id", String.class, orgId);
        for (String projectId : projectIds) {
            supersedeLive(orgId, projectId, null, "The work calendar changed.", now);
            reconcile(orgId, projectId, now);
        }
        OrgCalendar after = readOrgCalendar(orgId, true);
        Map<String, Object> next = calendarSnapshot(after);
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, permissions.principal(auth).userId(), "org_calendar.updated", "ORGANIZATION", orgId,
                        null, calendarSnapshot(before), next),
                new ChangeRecorder.DomainEvent(orgId, "ORGANIZATION", orgId, after.version(), "WorkCalendarChanged", next));
        return after;
    }

    /* ================================================================== project cadence */

    @Transactional
    public ProjectCadence cadence(UUID orgId, String projectId, Authentication auth) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        ensureCadence(orgId, project.id());
        return readCadence(orgId, project, mayEditSchedule(auth, orgId, project));
    }

    @Transactional
    public ProjectCadence updateCadence(UUID orgId, String projectId, Authentication auth, UpdateCadenceRequest request) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        if (!mayEditSchedule(auth, orgId, project)) throw PermissionService.forbidden();
        if (project.archived()) throw new ApiException(HttpStatus.CONFLICT, "PROJECT_ARCHIVED", "Archived projects are read-only.");
        if (request.expectedVersion() == null) throw validation("expected_version", "is required");
        String reason = request.reason() == null ? "" : request.reason().trim();
        if (reason.isEmpty() || reason.length() > 1000) throw validation("reason", "Say why the cadence changes.");
        Frequency frequency;
        try {
            frequency = CheckInSchedule.frequency(request.frequency());
        } catch (IllegalArgumentException e) {
            throw validation("frequency", "must be DAILY, WEEKLY or FORTNIGHTLY");
        }
        String day = request.dayOfWeek() == null ? "FRIDAY" : request.dayOfWeek().trim().toUpperCase(Locale.ROOT);
        if (!DAYS.contains(day)) throw validation("day_of_week", "must be a day such as FRIDAY");
        String cutoff = request.localCutoffTime() == null ? "17:00" : request.localCutoffTime().trim();
        try {
            LocalTime.parse(cutoff);
        } catch (DateTimeParseException e) {
            throw validation("local_cutoff_time", "must be a time such as 17:00");
        }
        int grace = request.graceWorkingDays() == null ? 1 : request.graceWorkingDays();
        if (grace < 0 || grace > 10) throw validation("grace_working_days", "must be between 0 and 10 working days");

        ensureCadence(orgId, project.id());
        Instant now = Instant.now();
        reconcile(orgId, project.id(), now); // close windows that already ended under the old policy
        ProjectCadence before = readCadence(orgId, project, true);
        ExpectedVersion.check(before.policyVersion(), request.expectedVersion());
        UUID userId = permissions.principal(auth).userId();
        jdbc.update("""
                INSERT INTO project_cadence_history (id, org_id, project_id, previous_frequency, new_frequency, previous_grace, new_grace,
                    previous_cutoff, new_cutoff, reason, changed_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID().toString(), orgId, project.id(), before.frequency(), frequency.name(), before.graceWorkingDays(), grace,
                before.localCutoffTime(), cutoff, reason, userId.toString());
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE project_cadence SET frequency = ?, day_of_week = ?, local_cutoff_time = ?, grace_working_days = ?,
                    policy_version = policy_version + 1, updated_at = now()
                WHERE project_id = ? AND org_id = ? AND policy_version = ?
                """, frequency.name(), day, cutoff, grace, project.id(), orgId, request.expectedVersion()));
        supersedeLive(orgId, project.id(), "CHECKIN", "The check-in cadence changed: " + reason, now);
        reconcile(orgId, project.id(), now);
        ProjectCadence after = readCadence(orgId, project, true);
        Map<String, Object> next = cadenceSnapshot(after);
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, userId, "project.cadence_changed", "PROJECT", UUID.fromString(project.id()), reason,
                        cadenceSnapshot(before), next),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(project.id()), project.version(), "ProjectCadenceChanged", next));
        return after;
    }

    /* ================================================================== schedule */

    @Transactional
    public Schedule schedule(UUID orgId, String projectId, Authentication auth) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        return schedule(orgId, project.id(), Instant.now());
    }

    Schedule schedule(UUID orgId, String projectId, Instant now) {
        reconcile(orgId, projectId, now);
        ProjectRow p = project(orgId, projectId);
        WorkingCalendar calendar = calendar(orgId, p.timezone());
        LocalDate today = LocalDate.ofInstant(now, calendar.getZone());
        boolean onHold = "ON_HOLD".equals(p.lifecycle());
        List<Occurrence> occurrences = occurrences(orgId, projectId, now, onHold, calendar);
        Occurrence next = occurrences.stream().filter(o -> "CHECKIN".equals(o.kind()) && List.of("OPEN", "PAUSED").contains(o.status()))
                .findFirst().orElse(null);
        int met = 0, missed = 0, pending = 0, inGrace = 0, excused = 0;
        for (Occurrence o : occurrences) {
            if (!"CHECKIN".equals(o.kind())) continue;
            switch (o.status()) {
                case "MET" -> met++;
                case "MISSED" -> missed++;
                case "EXCUSED", "PAUSED" -> excused++;
                case "OPEN" -> { if (Display.IN_GRACE.name().equals(o.display())) inGrace++; else pending++; }
                default -> { }
            }
        }
        CheckInSchedule.Compliance c = CheckInSchedule.compliance(met, missed, pending, inGrace, excused);
        Instant overdueFrom = p.targetOn() == null ? null : CheckInSchedule.overdueFrom(p.targetOn(), calendar);
        String targetDisplay = p.targetOn() == null ? null
                : onHold ? Display.PAUSED.name()
                : CheckInSchedule.target(now, overdueFrom, CLOSED_LIFECYCLES.contains(p.lifecycle())).name();
        return new Schedule(projectId, p.lifecycle(), p.timezone(), onHold, p.targetOn(), overdueFrom, targetDisplay, next,
                new Compliance(c.met(), c.missed(), c.eligible(), c.pending(), c.inGrace(), c.excused(), c.rate()),
                CheckInSchedule.roughPace(p.startOn(), p.targetOn(), today, calendar), occurrences);
    }

    /** Recomputed in the same transaction whenever a project's dates, zone or lifecycle change (task 2.1 update). */
    @EventListener
    public void onScheduleChanged(ProjectScheduleChanged event) {
        reconcile(event.orgId(), event.projectId(), Instant.now());
    }

    /**
     * Idempotent: closes ended check-in windows (MET when a check-in was made in the window, MISSED after grace),
     * pauses while On hold (no backlog on resume), keeps exactly one live target and one live check-in occurrence.
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public void reconcile(UUID orgId, String projectId, Instant now) {
        ensureCadence(orgId, projectId);
        Map<String, Object> cadence = jdbc.queryForMap(
                "SELECT frequency, day_of_week, local_cutoff_time, grace_working_days, policy_version FROM project_cadence WHERE project_id = ? AND org_id = ? FOR UPDATE",
                projectId, orgId); // serializes reconciles of one project
        ProjectRow p = project(orgId, projectId);
        WorkingCalendar calendar = calendar(orgId, p.timezone());
        ZoneId zone = calendar.getZone();
        LocalDate today = LocalDate.ofInstant(now, zone);
        Frequency frequency = CheckInSchedule.frequency((String) cadence.get("frequency"));
        DayOfWeek day = DayOfWeek.valueOf((String) cadence.get("day_of_week"));
        LocalTime cutoffTime = LocalTime.parse((String) cadence.get("local_cutoff_time"));
        int grace = ((Number) cadence.get("grace_working_days")).intValue();
        long policy = ((Number) cadence.get("policy_version")).longValue();
        boolean closed = p.archived() || CLOSED_LIFECYCLES.contains(p.lifecycle());
        boolean onHold = "ON_HOLD".equals(p.lifecycle());

        // 1. Close check-in windows that ended, or that a check-in already met.
        for (Map<String, Object> o : jdbc.queryForList(
                "SELECT id, due_local_date, grace_cutoff_instant FROM due_occurrences WHERE org_id = ? AND project_id = ? AND kind = 'CHECKIN' AND status = 'OPEN'",
                orgId, projectId)) {
            LocalDate due = ((Date) o.get("due_local_date")).toLocalDate();
            Instant graceCutoff = ((Timestamp) o.get("grace_cutoff_instant")).toInstant();
            Instant windowStart = CheckInSchedule.cutoff(CheckInSchedule.previousDue(frequency, due, calendar), cutoffTime, calendar);
            String checkIn = jdbc.query("""
                    SELECT id FROM project_progress_checkins WHERE org_id = ? AND project_id = ? AND captured_at > ? AND captured_at <= ?
                    ORDER BY captured_at LIMIT 1
                    """, (rs, n) -> rs.getString(1), orgId, projectId, Timestamp.from(windowStart), Timestamp.from(graceCutoff))
                    .stream().findFirst().orElse(null);
            if (checkIn != null) {
                jdbc.update("UPDATE due_occurrences SET status = 'MET', checkin_id = ?, updated_at = now() WHERE id = ?", checkIn, o.get("id"));
            } else if (!now.isBefore(graceCutoff)) {
                jdbc.update("UPDATE due_occurrences SET status = 'MISSED', updated_at = now() WHERE id = ?", o.get("id"));
            }
        }

        // 2. On hold pauses check-ins; leaving hold drops paused windows (no stale backlog). Closed projects stop.
        if (onHold) {
            jdbc.update("UPDATE due_occurrences SET status = 'PAUSED', updated_at = now() WHERE org_id = ? AND project_id = ? AND kind = 'CHECKIN' AND status = 'OPEN'",
                    orgId, projectId);
        } else {
            jdbc.update("""
                    UPDATE due_occurrences SET status = 'SUPERSEDED', superseded_reason = 'The project left On hold.', updated_at = now()
                    WHERE org_id = ? AND project_id = ? AND kind = 'CHECKIN' AND status = 'PAUSED'
                    """, orgId, projectId);
        }
        if (closed) supersedeLive(orgId, projectId, "CHECKIN", "The project is " + (p.archived() ? "archived" : p.lifecycle().toLowerCase(Locale.ROOT)) + ".", now);

        // 3. Target: one live occurrence for the current target date; another date supersedes it (old date and reason kept).
        jdbc.update("""
                UPDATE due_occurrences SET status = 'SUPERSEDED', superseded_reason = 'The target date changed.', updated_at = now()
                WHERE org_id = ? AND project_id = ? AND kind = 'TARGET' AND status IN ('OPEN', 'PAUSED') AND (CAST(? AS date) IS NULL OR due_local_date <> CAST(? AS date))
                """, orgId, projectId, p.targetOn() == null ? null : Date.valueOf(p.targetOn()), p.targetOn() == null ? null : Date.valueOf(p.targetOn()));
        if (p.targetOn() != null && !closed) {
            Instant overdue = CheckInSchedule.overdueFrom(p.targetOn(), calendar);
            jdbc.update("""
                    INSERT INTO due_occurrences (id, org_id, project_id, kind, due_local_date, grace_until_date, zone, cutoff_instant,
                        grace_cutoff_instant, policy_version, status)
                    SELECT ?, ?, ?, 'TARGET', ?, ?, ?, ?, ?, ?, 'OPEN'
                    WHERE NOT EXISTS (SELECT 1 FROM due_occurrences WHERE project_id = ? AND kind = 'TARGET' AND status IN ('OPEN', 'PAUSED'))
                    """, "occ-" + UUID.randomUUID(), orgId, projectId, Date.valueOf(p.targetOn()), Date.valueOf(p.targetOn()), zone.getId(),
                    Timestamp.from(overdue), Timestamp.from(overdue), policy, projectId);
        }

        // 4. Next check-in window (one live at a time), from today or the day after the last closed window.
        if (!onHold && !closed) {
            Date lastClosed = jdbc.queryForObject("""
                    SELECT max(due_local_date) FROM due_occurrences WHERE org_id = ? AND project_id = ? AND kind = 'CHECKIN'
                      AND status IN ('MET', 'MISSED', 'EXCUSED') AND policy_version = ?
                    """, Date.class, orgId, projectId, policy);
            LocalDate lastDue = lastClosed == null ? null : lastClosed.toLocalDate();
            LocalDate from = lastDue != null && !lastDue.isBefore(today) ? lastDue.plusDays(1) : today;
            LocalDate due = CheckInSchedule.nextDue(frequency, day, from, p.startOn(), calendar);
            Instant cutoff = CheckInSchedule.cutoff(due, cutoffTime, calendar);
            if (!cutoff.isAfter(now)) { // today's cutoff already passed: the window is the next one
                due = CheckInSchedule.nextDue(frequency, day, due.plusDays(1), p.startOn(), calendar);
                cutoff = CheckInSchedule.cutoff(due, cutoffTime, calendar);
            }
            LocalDate graceUntil = CheckInSchedule.graceUntil(due, grace, calendar);
            jdbc.update("""
                    INSERT INTO due_occurrences (id, org_id, project_id, kind, due_local_date, grace_until_date, zone, cutoff_instant,
                        grace_cutoff_instant, policy_version, status)
                    SELECT ?, ?, ?, 'CHECKIN', ?, ?, ?, ?, ?, ?, 'OPEN'
                    WHERE NOT EXISTS (SELECT 1 FROM due_occurrences WHERE project_id = ? AND kind = 'CHECKIN' AND status IN ('OPEN', 'PAUSED'))
                    """, "occ-" + UUID.randomUUID(), orgId, projectId, Date.valueOf(due), Date.valueOf(graceUntil), zone.getId(),
                    Timestamp.from(cutoff), Timestamp.from(CheckInSchedule.cutoff(graceUntil, cutoffTime, calendar)), policy, projectId);
        }
    }

    /* ================================================================== helpers */

    private boolean mayEditSchedule(Authentication auth, UUID orgId, ProjectResponse project) {
        return permissions.canOnProject(auth, orgId, project.id(), PermissionKey.PROJECT_DEADLINE_EDIT.value())
                || permissions.canOnProject(auth, orgId, project.id(), PermissionKey.PROJECT_EDIT.value());
    }

    private void supersedeLive(UUID orgId, String projectId, String kind, String reason, Instant now) {
        List<String> ids = jdbc.queryForList("""
                SELECT id FROM due_occurrences WHERE org_id = ? AND project_id = ? AND status IN ('OPEN', 'PAUSED') AND (CAST(? AS text) IS NULL OR kind = CAST(? AS text))
                """, String.class, orgId, projectId, kind, kind);
        for (String id : ids) {
            jdbc.update("UPDATE due_occurrences SET status = 'SUPERSEDED', superseded_reason = ?, updated_at = now() WHERE id = ?", reason, id);
            jdbc.update("UPDATE reminder_candidates SET status = 'CANCELLED' WHERE occurrence_id = ? AND status = 'PENDING'", id);
        }
    }

    private record ProjectRow(String lifecycle, boolean archived, LocalDate startOn, LocalDate targetOn, String timezone) {}

    private ProjectRow project(UUID orgId, String projectId) {
        return jdbc.queryForObject("SELECT lifecycle, archived, start_on, target_on, timezone FROM projects WHERE id = ? AND org_id = ?",
                (rs, n) -> new ProjectRow(rs.getString("lifecycle"), rs.getBoolean("archived"),
                        rs.getDate("start_on") == null ? null : rs.getDate("start_on").toLocalDate(),
                        rs.getDate("target_on") == null ? null : rs.getDate("target_on").toLocalDate(), rs.getString("timezone")),
                projectId, orgId);
    }

    private WorkingCalendar calendar(UUID orgId, String zone) {
        ensureOrgCalendar(orgId);
        OrgCalendar c = readOrgCalendar(orgId, false);
        Set<DayOfWeek> days = new LinkedHashSet<>();
        c.workdays().forEach(d -> days.add(DayOfWeek.valueOf(d)));
        Set<LocalDate> holidays = new LinkedHashSet<>();
        c.holidays().forEach(h -> holidays.add(h.date()));
        ZoneId zoneId;
        try {
            zoneId = ZoneId.of(zone);
        } catch (Exception e) {
            zoneId = ZoneId.of(c.timezone());
        }
        return new WorkingCalendar(days, holidays, zoneId);
    }

    /** First use seeds the structured calendar from the organization's setup calendar (task 1.1). */
    private void ensureOrgCalendar(UUID orgId) {
        Map<String, Object> org = jdbc.queryForMap("SELECT timezone, work_calendar::text AS cal FROM organizations WHERE id = ?", orgId);
        List<String> workdays = List.of("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY");
        List<Holiday> holidays = new ArrayList<>();
        try {
            JsonNode cal = json.readTree((String) org.get("cal"));
            JsonNode days = cal.has("workdays") ? cal.get("workdays") : cal.get("workDays");
            if (days != null && days.isArray() && days.size() > 0) {
                List<String> parsed = new ArrayList<>();
                days.forEach(d -> parsed.add(d.isInt() ? DayOfWeek.of(d.asInt()).name() : d.asText().toUpperCase(Locale.ROOT)));
                if (DAYS.containsAll(parsed)) workdays = parsed;
            }
            JsonNode hols = cal.get("holidays");
            if (hols != null && hols.isArray()) {
                hols.forEach(h -> holidays.add(h.isTextual() ? new Holiday(LocalDate.parse(h.asText()), "Holiday")
                        : new Holiday(LocalDate.parse(h.path("date").asText()), h.path("name").asText("Holiday"))));
            }
        } catch (Exception ignored) {
            // an unreadable setup calendar falls back to Monday-Friday without holidays
        }
        jdbc.update("""
                INSERT INTO org_calendar (org_id, workdays, holidays, timezone) VALUES (?, ?, ?::jsonb, ?) ON CONFLICT (org_id) DO NOTHING
                """, orgId, String.join(",", workdays), write(holidays), org.get("timezone"));
    }

    private OrgCalendar readOrgCalendar(UUID orgId, boolean canEdit) {
        return jdbc.queryForObject("SELECT workdays, holidays::text AS holidays, timezone, version FROM org_calendar WHERE org_id = ?",
                (rs, n) -> {
                    List<String> workdays = new ArrayList<>();
                    for (String d : rs.getString("workdays").split(",")) if (!d.isBlank()) workdays.add(d.trim().toUpperCase(Locale.ROOT));
                    List<Holiday> holidays;
                    try {
                        holidays = json.readValue(rs.getString("holidays"), new TypeReference<List<Holiday>>() {});
                    } catch (Exception e) {
                        holidays = List.of();
                    }
                    List<Holiday> sorted = new ArrayList<>(holidays);
                    sorted.sort((a, b) -> a.date().compareTo(b.date()));
                    return new OrgCalendar(workdays, sorted, rs.getString("timezone"), rs.getLong("version"), canEdit);
                }, orgId);
    }

    private void ensureCadence(UUID orgId, String projectId) {
        jdbc.update("INSERT INTO project_cadence (project_id, org_id) VALUES (?, ?) ON CONFLICT (project_id) DO NOTHING", projectId, orgId);
    }

    private ProjectCadence readCadence(UUID orgId, ProjectResponse project, boolean canEdit) {
        List<CadenceChange> history = jdbc.query("""
                SELECT h.previous_frequency, h.new_frequency, h.previous_grace, h.new_grace, h.previous_cutoff, h.new_cutoff, h.reason,
                       u.email, h.created_at
                FROM project_cadence_history h LEFT JOIN users u ON u.id::text = h.changed_by
                WHERE h.org_id = ? AND h.project_id = ? ORDER BY h.created_at DESC, h.id
                """, (rs, n) -> new CadenceChange(rs.getString(1), rs.getString(2), (Integer) rs.getObject(3), rs.getInt(4), rs.getString(5),
                rs.getString(6), rs.getString(7), rs.getString(8), rs.getTimestamp(9).toInstant()), orgId, project.id());
        return jdbc.queryForObject("""
                SELECT frequency, day_of_week, local_cutoff_time, grace_working_days, policy_version FROM project_cadence WHERE project_id = ? AND org_id = ?
                """, (rs, n) -> new ProjectCadence(project.id(), rs.getString(1), rs.getString(2), rs.getString(3), rs.getInt(4), rs.getLong(5),
                "ON_HOLD".equals(project.lifecycle()), canEdit && !project.archived(), history), project.id(), orgId);
    }

    private List<Occurrence> occurrences(UUID orgId, String projectId, Instant now, boolean onHold, WorkingCalendar calendar) {
        LocalDate today = LocalDate.ofInstant(now, calendar.getZone());
        return jdbc.query("""
                SELECT id, kind, due_local_date, grace_until_date, zone, cutoff_instant, grace_cutoff_instant, policy_version, status, superseded_reason
                FROM due_occurrences WHERE org_id = ? AND project_id = ?
                ORDER BY CASE WHEN status IN ('OPEN', 'PAUSED') THEN 0 ELSE 1 END, due_local_date DESC, created_at DESC LIMIT 50
                """, (rs, n) -> {
                    String status = rs.getString("status");
                    String kind = rs.getString("kind");
                    LocalDate due = rs.getDate("due_local_date").toLocalDate();
                    Instant cutoff = rs.getTimestamp("cutoff_instant").toInstant();
                    Instant graceCutoff = rs.getTimestamp("grace_cutoff_instant").toInstant();
                    String display = switch (status) {
                        case "OPEN" -> "CHECKIN".equals(kind) ? CheckInSchedule.checkIn(now, today, due, cutoff, graceCutoff, onHold).name()
                                : onHold ? Display.PAUSED.name() : CheckInSchedule.target(now, cutoff, false).name();
                        default -> status;
                    };
                    return new Occurrence(rs.getString("id"), kind, due, rs.getDate("grace_until_date").toLocalDate(), rs.getString("zone"),
                            cutoff, graceCutoff, rs.getLong("policy_version"), status, display, rs.getString("superseded_reason"));
                }, orgId, projectId);
    }

    private static List<String> workdays(List<String> values) {
        if (values == null || values.isEmpty()) throw validation("workdays", "Choose at least one working day.");
        List<String> days = new ArrayList<>();
        for (String value : values) {
            String day = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
            if (!DAYS.contains(day)) throw validation("workdays", "Use day names such as MONDAY.");
            if (!days.contains(day)) days.add(day);
        }
        days.sort((a, b) -> DAYS.indexOf(a) - DAYS.indexOf(b));
        return days;
    }

    private static List<Holiday> holidays(List<Holiday> values) {
        List<Holiday> result = new ArrayList<>();
        Set<LocalDate> seen = new LinkedHashSet<>();
        for (Holiday h : values == null ? List.<Holiday>of() : values) {
            if (h == null || h.date() == null) throw validation("holidays", "Each holiday needs a date.");
            String name = h.name() == null || h.name().isBlank() ? "Holiday" : h.name().trim();
            if (name.length() > 100) throw validation("holidays", "Holiday names are at most 100 characters.");
            if (!seen.add(h.date())) throw validation("holidays", "The date " + h.date() + " is listed twice.");
            result.add(new Holiday(h.date(), name));
        }
        result.sort((a, b) -> a.date().compareTo(b.date()));
        return result;
    }

    private static Map<String, Object> calendarSnapshot(OrgCalendar c) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("workdays", c.workdays());
        s.put("holidays", c.holidays().stream().map(h -> h.date().toString()).toList());
        s.put("version", c.version());
        return s;
    }

    private static Map<String, Object> cadenceSnapshot(ProjectCadence c) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("frequency", c.frequency());
        s.put("day_of_week", c.dayOfWeek());
        s.put("local_cutoff_time", c.localCutoffTime());
        s.put("grace_working_days", c.graceWorkingDays());
        s.put("policy_version", c.policyVersion());
        return s;
    }

    private String write(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Check the highlighted field.",
                List.of(new ApiError.FieldError(field, message)));
    }
}
