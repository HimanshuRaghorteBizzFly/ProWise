package com.prowise.calendar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;

/** Task 2.3 through the API: work calendar, cadence, grace, on hold, rescheduling, one live occurrence per window. */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("FR-037")
@Tag("NFR-12")
class CalendarCadenceIntegrationTest {

    private static final UUID DEV_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000005");
    private static final UUID QA_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000006");
    private static final ZoneId LONDON = ZoneId.of("Europe/London");

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private CalendarCadenceService calendar;
    @Autowired private TransactionTemplate transactions;

    @BeforeEach
    @AfterEach
    void clean() {
        TestDatabase.clean(jdbc);
    }

    @Test
    @DisplayName("Friday check-in + 1 working day of grace with a Monday holiday: the window ends Tuesday")
    void fridayGraceWithMondayHoliday() throws Exception {
        World w = world("hol");
        String project = project(w, "HOL", null);
        JsonNode before = schedule(w, project);
        LocalDate due = LocalDate.parse(before.path("next_check_in").path("due_local_date").asText());
        assertThat(due.getDayOfWeek()).isEqualTo(java.time.DayOfWeek.FRIDAY);
        assertThat(LocalDate.parse(before.path("next_check_in").path("grace_until_date").asText())).isEqualTo(due.plusDays(3)); // Monday

        JsonNode cal = json(mockMvc.perform(auth(get("/v1/organizations/{o}/calendar", w.org()), w.ownerToken())).andExpect(status().isOk()).andReturn());
        mockMvc.perform(auth(put("/v1/organizations/{o}/calendar", w.org()), w.ownerToken()).contentType("application/json")
                        .content("{\"workdays\":[\"MONDAY\",\"TUESDAY\",\"WEDNESDAY\",\"THURSDAY\",\"FRIDAY\"],\"holidays\":[{\"date\":\""
                                + due.plusDays(3) + "\",\"name\":\"Bank holiday\"}],\"expected_version\":" + cal.path("version").asLong() + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.holidays[0].name").value("Bank holiday"));

        JsonNode after = schedule(w, project);
        assertThat(after.path("next_check_in").path("due_local_date").asText()).isEqualTo(due.toString());
        assertThat(after.path("next_check_in").path("grace_until_date").asText()).isEqualTo(due.plusDays(4).toString()); // Tuesday
        assertThat(count("SELECT count(*) FROM due_occurrences WHERE project_id = ? AND kind = 'CHECKIN' AND status = 'SUPERSEDED'", project)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'org_calendar.updated'")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'WorkCalendarChanged'")).isEqualTo(1);
    }

    @Test
    @DisplayName("Only org.manage edits the calendar; a stale version is 409; bad input is 400")
    void calendarIsGuarded() throws Exception {
        World w = world("guard");
        mockMvc.perform(auth(put("/v1/organizations/{o}/calendar", w.org()), w.devToken()).contentType("application/json")
                .content("{\"workdays\":[\"MONDAY\"],\"holidays\":[],\"expected_version\":0}")).andExpect(status().isForbidden());
        long version = json(mockMvc.perform(auth(get("/v1/organizations/{o}/calendar", w.org()), w.devToken())).andExpect(status().isOk())
                .andReturn()).path("version").asLong();
        mockMvc.perform(auth(put("/v1/organizations/{o}/calendar", w.org()), w.ownerToken()).contentType("application/json")
                .content("{\"workdays\":[\"FUNDAY\"],\"holidays\":[],\"expected_version\":" + version + "}")).andExpect(status().isBadRequest());
        mockMvc.perform(auth(put("/v1/organizations/{o}/calendar", w.org()), w.ownerToken()).contentType("application/json")
                .content("{\"workdays\":[\"MONDAY\"],\"holidays\":[],\"expected_version\":" + (version + 5) + "}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        World other = world("guard-b");
        mockMvc.perform(auth(get("/v1/organizations/{o}/calendar", w.org()), other.ownerToken())).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Cadence change needs a reason and the right permission; it supersedes the open window and keeps history")
    void cadenceChange() throws Exception {
        World w = world("cad");
        String project = project(w, "CAD", null);
        JsonNode cadence = json(mockMvc.perform(auth(get("/v1/organizations/{o}/projects/{p}/cadence", w.org(), project), w.ownerToken()))
                .andExpect(status().isOk()).andReturn());
        assertThat(cadence.path("frequency").asText()).isEqualTo("WEEKLY");
        long v = cadence.path("policy_version").asLong();
        cadenceUpdate(w, w.ownerToken(), project, "DAILY", "", v).andExpect(status().isBadRequest());
        cadenceUpdate(w, w.qaToken(), project, "DAILY", "Daily stand-ups", v).andExpect(status().isForbidden());
        cadenceUpdate(w, w.ownerToken(), project, "HOURLY", "x", v).andExpect(status().isBadRequest());
        cadenceUpdate(w, w.ownerToken(), project, "DAILY", "Daily stand-ups", v).andExpect(status().isOk())
                .andExpect(jsonPath("$.frequency").value("DAILY")).andExpect(jsonPath("$.history[0].reason").value("Daily stand-ups"));
        cadenceUpdate(w, w.ownerToken(), project, "WEEKLY", "Back to weekly", v).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_VERSION"));
        assertThat(count("SELECT count(*) FROM due_occurrences WHERE project_id = ? AND kind = 'CHECKIN' AND status = 'OPEN'", project)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM due_occurrences WHERE project_id = ? AND kind = 'CHECKIN' AND status = 'SUPERSEDED'", project)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'project.cadence_changed'")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'ProjectCadenceChanged'")).isEqualTo(1);
        World other = world("cad-b");
        mockMvc.perform(auth(get("/v1/organizations/{o}/projects/{p}/cadence", other.org(), project), other.ownerToken())).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("On hold pauses the check-in; resuming recomputes once with no stale backlog")
    void onHoldPausesAndResumes() throws Exception {
        World w = world("hold");
        String project = project(w, "HOLD", LocalDate.now(LONDON).plusMonths(2));
        patch(w, project, "{\"lifecycle\":\"ACTIVE\",\"lifecycle_reason\":\"Kick-off\",\"expected_version\":0}").andExpect(status().isOk());
        patch(w, project, "{\"lifecycle\":\"ON_HOLD\",\"lifecycle_reason\":\"Client freeze\",\"expected_version\":1}").andExpect(status().isOk());
        JsonNode held = schedule(w, project);
        assertThat(held.path("on_hold").asBoolean()).isTrue();
        assertThat(held.path("next_check_in").path("status").asText()).isEqualTo("PAUSED");
        assertThat(held.path("target_display").asText()).isEqualTo("PAUSED");

        patch(w, project, "{\"lifecycle\":\"ACTIVE\",\"lifecycle_reason\":\"Freeze lifted\",\"expected_version\":2}").andExpect(status().isOk());
        JsonNode resumed = schedule(w, project);
        assertThat(resumed.path("on_hold").asBoolean()).isFalse();
        assertThat(resumed.path("next_check_in").path("status").asText()).isEqualTo("OPEN");
        assertThat(count("SELECT count(*) FROM due_occurrences WHERE project_id = ? AND kind = 'CHECKIN' AND status IN ('OPEN','PAUSED')", project)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM due_occurrences WHERE project_id = ? AND kind = 'CHECKIN' AND status = 'MISSED'", project)).isZero();
    }

    @Test
    @DisplayName("Rescheduled target: one open target occurrence; old dates stay as SUPERSEDED with the reason in history")
    void rescheduledTarget() throws Exception {
        World w = world("resched");
        LocalDate first = LocalDate.now(LONDON).plusMonths(1);
        String project = project(w, "RESC", first);
        LocalDate second = first.plusWeeks(2);
        patch(w, project, "{\"target_on\":\"" + second + "\",\"previous_target_on\":\"" + first + "\",\"target_date_reason\":\"Scope grew\",\"expected_version\":0}")
                .andExpect(status().isOk());
        patch(w, project, "{\"target_on\":\"" + first + "\",\"previous_target_on\":\"" + second + "\",\"target_date_reason\":\"Scope cut\",\"expected_version\":1}")
                .andExpect(status().isOk());
        JsonNode s = schedule(w, project);
        assertThat(s.path("target_date").asText()).isEqualTo(first.toString());
        assertThat(s.path("target_display").asText()).isEqualTo("ON_TIME");
        assertThat(count("SELECT count(*) FROM due_occurrences WHERE project_id = ? AND kind = 'TARGET' AND status = 'OPEN'", project)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM due_occurrences WHERE project_id = ? AND kind = 'TARGET' AND status = 'SUPERSEDED'", project)).isEqualTo(2);
        assertThat(count("SELECT count(*) FROM project_date_history WHERE project_id = ?", project)).isEqualTo(2);
        // A date-only target is on time through its local day; overdue starts at the next local midnight.
        assertThat(Instant.parse(s.path("target_overdue_from").asText())).isEqualTo(first.plusDays(1).atStartOfDay(LONDON).toInstant());
    }

    @Test
    @DisplayName("Repeated and concurrent reconciles never create a second live occurrence")
    void noDuplicateOccurrences() throws Exception {
        World w = world("dup");
        String project = project(w, "DUP", LocalDate.now(LONDON).plusMonths(1));
        for (int i = 0; i < 3; i++) schedule(w, project);
        ExecutorService pool = Executors.newFixedThreadPool(4);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<?>> runs = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            runs.add(pool.submit(() -> {
                start.await();
                transactions.executeWithoutResult(t -> calendar.reconcile(w.org(), project, Instant.now()));
                return null;
            }));
        }
        start.countDown();
        for (Future<?> run : runs) run.get();
        pool.shutdown();
        assertThat(count("SELECT count(*) FROM due_occurrences WHERE project_id = ? AND kind = 'CHECKIN' AND status IN ('OPEN','PAUSED')", project)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM due_occurrences WHERE project_id = ? AND kind = 'TARGET' AND status IN ('OPEN','PAUSED')", project)).isEqualTo(1);
    }

    @Test
    @DisplayName("Windows close as MET (check-in inside the window) or MISSED (after grace); compliance = met / eligible")
    void windowsCloseAndComplianceCounts() throws Exception {
        World w = world("comp");
        String project = project(w, "COMP", null);
        JsonNode first = schedule(w, project).path("next_check_in");
        Instant afterFirstGrace = Instant.parse(first.path("grace_cutoff_instant").asText()).plus(Duration.ofHours(1));
        transactions.executeWithoutResult(t -> calendar.reconcile(w.org(), project, afterFirstGrace)); // no check-in: MISSED

        String secondDue = jdbc.queryForObject("SELECT CAST(due_local_date AS text) FROM due_occurrences WHERE project_id = ? AND kind = 'CHECKIN' AND status = 'OPEN'",
                String.class, project);
        Instant inSecondWindow = LocalDate.parse(secondDue).atTime(9, 0).atZone(LONDON).toInstant();
        jdbc.update("""
                INSERT INTO project_progress_checkins (id, org_id, project_id, author_id, percent, accomplished, next_steps, status, captured_at)
                VALUES (?, ?, ?, ?, 10, 'Done a bit', 'More', 'PENDING', ?)
                """, "chk-" + UUID.randomUUID(), w.org(), project, w.ownerId().toString(), Timestamp.from(inSecondWindow));
        Instant later = LocalDate.parse(secondDue).atTime(10, 0).atZone(LONDON).toInstant();
        CalendarDTOs.Schedule s = transactions.execute(t -> calendar.schedule(w.org(), project, later));
        assertThat(s.compliance().met()).isEqualTo(1);
        assertThat(s.compliance().missed()).isEqualTo(1);
        assertThat(s.compliance().eligible()).isEqualTo(2);
        assertThat(s.compliance().rate()).isEqualByComparingTo("50");
        assertThat(count("SELECT count(*) FROM due_occurrences WHERE project_id = ? AND kind = 'CHECKIN' AND status IN ('OPEN','PAUSED')", project)).isEqualTo(1);
    }

    /* ================================================================== fixture */

    private record World(UUID org, UUID ownerId, String ownerToken, String devToken, String qaToken, UUID devMember, UUID qaMember) {}

    private World world(String slug) throws Exception {
        String[] owner = person(slug + "-owner");
        String unique = slug + "-" + UUID.randomUUID().toString().substring(0, 6);
        UUID org = UUID.fromString(json(mockMvc.perform(auth(post("/v1/organizations"), owner[1]).contentType("application/json")
                        .content("{\"name\":\"" + unique + "\",\"slug\":\"" + unique + "\",\"timezone\":\"Europe/London\",\"calendar\":{\"workDays\":[1,2,3,4,5]}}"))
                .andExpect(status().isCreated()).andReturn()).path("id").asText());
        String[] dev = person(slug + "-dev");
        String[] qa = person(slug + "-qa");
        UUID devMember = member(org, UUID.fromString(dev[0]), "DEVELOPER", DEV_ROLE);
        UUID qaMember = member(org, UUID.fromString(qa[0]), "QA_REVIEWER", QA_ROLE);
        return new World(org, UUID.fromString(owner[0]), switchTo(owner[1], org), switchTo(dev[1], org), switchTo(qa[1], org), devMember, qaMember);
    }

    private String project(World w, String key, LocalDate target) throws Exception {
        String body = "{\"name\":\"" + key + " project\",\"key\":\"" + key + "\",\"mode\":\"STRUCTURED\",\"timezone\":\"Europe/London\""
                + ",\"member_membership_ids\":[\"" + w.devMember() + "\",\"" + w.qaMember() + "\"]"
                + ",\"start_on\":\"" + LocalDate.now(LONDON) + "\"" + (target == null ? "" : ",\"target_on\":\"" + target + "\"") + "}";
        return json(mockMvc.perform(auth(post("/v1/organizations/{o}/projects", w.org()), w.ownerToken()).contentType("application/json").content(body))
                .andExpect(status().isCreated()).andReturn()).path("id").asText();
    }

    private JsonNode schedule(World w, String project) throws Exception {
        return json(mockMvc.perform(auth(get("/v1/organizations/{o}/projects/{p}/schedule", w.org(), project), w.devToken()))
                .andExpect(status().isOk()).andReturn());
    }

    private ResultActions patch(World w, String project, String body) throws Exception {
        return mockMvc.perform(auth(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                "/v1/organizations/{o}/projects/{p}", w.org(), project), w.ownerToken()).contentType("application/json").content(body));
    }

    private ResultActions cadenceUpdate(World w, String token, String project, String frequency, String reason, long version) throws Exception {
        return mockMvc.perform(auth(put("/v1/organizations/{o}/projects/{p}/cadence", w.org(), project), token).contentType("application/json")
                .content("{\"frequency\":\"" + frequency + "\",\"day_of_week\":\"FRIDAY\",\"local_cutoff_time\":\"17:00\",\"grace_working_days\":1"
                        + ",\"reason\":\"" + reason + "\",\"expected_version\":" + version + "}"));
    }

    private UUID member(UUID org, UUID userId, String template, UUID role) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, ?)", id, org, userId, template);
        jdbc.update("INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by) VALUES (gen_random_uuid(), ?, ?, ?, 'ORG', ?)",
                org, id, role, userId);
        return id;
    }

    private String[] person(String name) throws Exception {
        String email = name + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        JsonNode signup = json(mockMvc.perform(post("/v1/auth/signup").contentType("application/json")
                        .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-battery\"}"))
                .andExpect(status().isCreated()).andReturn());
        UUID id = jdbc.queryForObject("SELECT id FROM users WHERE lower(email) = lower(?)", UUID.class, email);
        return new String[] {id.toString(), signup.path("access_token").asText()};
    }

    private String switchTo(String token, UUID org) throws Exception {
        return json(mockMvc.perform(auth(post("/v1/me/organizations/{org}/switch", org), token)).andExpect(status().isOk()).andReturn())
                .path("access_token").asText();
    }

    private int count(String sql, Object... args) {
        Integer value = jdbc.queryForObject(sql, Integer.class, args);
        return value == null ? 0 : value;
    }

    private static MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder builder, String token) {
        return builder.header("Authorization", "Bearer " + token);
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }
}
