package com.prowise.calendar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.testsupport.TestAccounts;
import com.prowise.authz.TestDatabase;

@SpringBootTest
@AutoConfigureMockMvc
@Tag("FR-037")
@Tag("NFR-12")
class CalendarCadenceIntegrationTest {

    private static final UUID OWNER_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID TEAM_LEAD_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000004");
    private static final UUID DEVELOPER_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000005");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private com.prowise.identity.AccountTokenService accountTokens;

    @BeforeEach
    @AfterEach
    void cleanDatabase() {
        TestDatabase.clean(jdbc);
        jdbc.execute("DELETE FROM outbox_event");
        jdbc.execute("DELETE FROM audit_log");
        jdbc.execute("DELETE FROM reminder_candidates");
        jdbc.execute("DELETE FROM due_occurrences");
        jdbc.execute("DELETE FROM project_cadence_history");
        jdbc.execute("DELETE FROM project_cadence");
        jdbc.execute("DELETE FROM org_calendar");
        jdbc.execute("DELETE FROM project_progress_checkins");
        jdbc.execute("DELETE FROM project_members");
        jdbc.execute("DELETE FROM project_date_history");
        jdbc.execute("DELETE FROM projects");
    }

    private record Person(UUID id, String email, String token) {}
    private record Workspace(UUID id, UUID ownerId, String ownerEmail, String ownerToken) {}

    private Person person(String name) throws Exception {
        String email = name + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        // Signup now returns 202 without a session (D9); verify through the real endpoint, then sign in.
        TestAccounts.Account account = TestAccounts.signUpVerifyAndLogin(
                mockMvc, jdbc, accountTokens, objectMapper, email, "Correct-Horse-Battery-1!");
        return new Person(account.id(), email, account.accessToken());
    }

    private Workspace workspace(String slug) throws Exception {
        Person owner = person(slug + "-owner");
        String unique = slug + "-" + UUID.randomUUID().toString().substring(0, 6);
        MvcResult res = mockMvc.perform(withToken(post("/v1/organizations"), owner.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + unique + "\",\"slug\":\"" + unique + "\",\"timezone\":\"Europe/London\","
                                + "\"calendar\":{\"workdays\":[1,2,3,4,5],\"holidays\":[]}}"))
                .andExpect(status().isCreated()).andReturn();
        String orgIdStr = json(res).path("id").asText();
        UUID orgId = UUID.fromString(orgIdStr);
        String switchedToken = switchTo(owner.token(), orgId);
        return new Workspace(orgId, owner.id(), owner.email(), switchedToken);
    }

    private String switchTo(String token, UUID orgId) throws Exception {
        return json(mockMvc.perform(withToken(post("/v1/me/organizations/{org}/switch", orgId), token))
                .andExpect(status().isOk()).andReturn()).path("access_token").asText();
    }

    private UUID member(UUID orgId, UUID userId, String template) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, ?)", id, orgId, userId, template);
        return id;
    }

    private void seedGrant(UUID orgId, UUID membershipId, UUID roleId, UUID userId) {
        jdbc.update("""
                INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by)
                VALUES (gen_random_uuid(), ?, ?, ?, 'ORG', ?)
                """, orgId, membershipId, roleId, userId);
    }

    private static MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder builder, String token) {
        return builder.header("Authorization", "Bearer " + token);
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private String createProject(Workspace ws, String key, String name, UUID devId, String startDate, String targetDate, String timezone) throws Exception {
        MvcResult res = mockMvc.perform(withToken(post("/v1/organizations/{orgId}/projects", ws.id()), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "key": "%s",
                            "name": "%s",
                            "mode": "INDIVIDUAL",
                            "lifecycle": "ACTIVE",
                            "priority": "HIGH",
                            "accountableDeveloperId": "%s",
                            "timezone": "%s",
                            "startDate": "%s",
                            "targetDate": "%s"
                        }
                        """.formatted(key, name, devId, timezone != null ? timezone : "Europe/London", startDate, targetDate)))
                .andExpect(status().isCreated()).andReturn();
        return json(res).path("id").asText();
    }

    // =========================================================================
    // TEST 1: FR-037 & Pass When:
    // Friday deadline + 1 working-day grace + Monday holiday -> Tuesday grace
    // =========================================================================
    @Test
    @DisplayName("Friday deadline + 1 working-day grace + Monday holiday -> Tuesday grace")
    void testFridayDeadlineWithMondayHolidayAndGrace() throws Exception {
        Workspace ws = workspace("cal-hol");
        Person dev = person("cal-dev");

        UUID devMem = member(ws.id(), dev.id(), "DEVELOPER");
        seedGrant(ws.id(), devMem, DEVELOPER_ROLE, ws.ownerId());
        String devToken = switchTo(dev.token(), ws.id());

        // 1. Add Monday 2026-06-08 as an organization holiday
        mockMvc.perform(withToken(post("/v1/organizations/" + ws.id() + "/calendar/holidays"), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "date": "2026-06-08",
                            "name": "King's Birthday Holiday"
                        }
                        """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.holidays").isArray());

        // 2. Pure domain test: WorkingCalendar addWorkingDays
        WorkingCalendar workingCalendar = new WorkingCalendar(
                WorkingCalendar.DEFAULT_WORKDAYS,
                Set.of(LocalDate.of(2026, 6, 8)), // Monday holiday
                ZoneId.of("Europe/London")
        );
        LocalDate friday = LocalDate.of(2026, 6, 5);
        LocalDate graceDate = workingCalendar.addWorkingDays(friday, 1);
        // Friday June 5 + 1 working day (Sat/Sun skipped, Mon June 8 is holiday) -> Tuesday June 9!
        assertThat(graceDate).isEqualTo(LocalDate.of(2026, 6, 9));

        // 3. Create project ending on Friday 2026-06-05
        String projectId = createProject(
                ws, "PRJ-CAL", "Calendar Test Project", dev.id(),
                "2026-06-01T09:00:00Z", "2026-06-05T17:00:00Z", "Europe/London"
        );

        // 4. Update project cadence to ensure 1 working day grace
        mockMvc.perform(withToken(put("/v1/projects/" + projectId + "/cadence"), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "frequency": "WEEKLY",
                            "dayOfWeek": "FRIDAY",
                            "localCutoffTime": "17:00",
                            "graceWorkingDays": 1,
                            "reminderOffsets": [3, 1],
                            "reason": "Configuring test cadence"
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.grace_working_days").value(1));

        // 5. Query schedule occurrences
        MvcResult occRes = mockMvc.perform(withToken(get("/v1/projects/" + projectId + "/occurrences"), devToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode occurrences = json(occRes);
        assertThat(occurrences.isArray()).isTrue();

        JsonNode targetOcc = null;
        for (JsonNode occ : occurrences) {
            if ("TARGET".equals(occ.path("kind").asText())) {
                targetOcc = occ;
                break;
            }
        }
        assertThat(targetOcc).isNotNull();
        assertThat(targetOcc.path("due_local_date").asText()).isEqualTo("2026-06-05");
        // Grace date must be Tuesday 2026-06-09
        assertThat(targetOcc.path("grace_until_date").asText()).isEqualTo("2026-06-09");
    }

    // =========================================================================
    // TEST 2: DST Handling
    // =========================================================================
    @Test
    @DisplayName("DST handling calculates exact cutoff instant in target timezone")
    void testDaylightSavingTimeCutoffHandling() throws Exception {
        Workspace ws = workspace("cal-dst");
        Person dev = person("dst-dev");

        UUID devMem = member(ws.id(), dev.id(), "DEVELOPER");
        seedGrant(ws.id(), devMem, DEVELOPER_ROLE, ws.ownerId());

        WorkingCalendar calLondon = new WorkingCalendar(
                WorkingCalendar.DEFAULT_WORKDAYS,
                Set.of(),
                ZoneId.of("Europe/London")
        );

        // Winter: GMT (UTC+0)
        LocalDate winterDate = LocalDate.of(2026, 1, 15);
        ZonedDateTime winterCutoff = calLondon.cutoffDateTime(winterDate, LocalTime.of(17, 0));
        assertThat(winterCutoff.getOffset().getTotalSeconds()).isEqualTo(0); // UTC+0

        // Summer: BST (UTC+1)
        LocalDate summerDate = LocalDate.of(2026, 7, 15);
        ZonedDateTime summerCutoff = calLondon.cutoffDateTime(summerDate, LocalTime.of(17, 0));
        assertThat(summerCutoff.getOffset().getTotalSeconds()).isEqualTo(3600); // UTC+1 (BST)

        // Verify startOfNextLocalDate works properly across DST
        Instant nextDay = calLondon.startOfNextLocalDate(summerDate);
        ZonedDateTime nextDayZdt = nextDay.atZone(ZoneId.of("Europe/London"));
        assertThat(nextDayZdt.toLocalDate()).isEqualTo(LocalDate.of(2026, 7, 16));
        assertThat(nextDayZdt.toLocalTime()).isEqualTo(LocalTime.of(0, 0));
    }

    // =========================================================================
    // TEST 3: Project On Hold Suspends Schedule and Occurrences
    // =========================================================================
    @Test
    @DisplayName("Project On Hold suspends deadlines, cadence occurrences, and returns PAUSED status")
    void testProjectOnHoldSuspendsSchedule() throws Exception {
        Workspace ws = workspace("cal-hold");
        Person dev = person("hold-dev");

        UUID devMem = member(ws.id(), dev.id(), "DEVELOPER");
        seedGrant(ws.id(), devMem, DEVELOPER_ROLE, ws.ownerId());
        String devToken = switchTo(dev.token(), ws.id());

        String projectId = createProject(
                ws, "PRJ-HOLD", "Hold Project", dev.id(),
                "2026-06-01T09:00:00Z", "2026-06-30T17:00:00Z", "Europe/London"
        );

        // Verify active summary before hold
        mockMvc.perform(withToken(get("/v1/projects/" + projectId + "/schedule-summary"), devToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.is_on_hold").value(false));

        // Put project ON_HOLD
        jdbc.update("UPDATE projects SET lifecycle = 'ON_HOLD' WHERE id = ?", projectId);

        // Verify schedule summary reflects ON_HOLD and PAUSED
        mockMvc.perform(withToken(get("/v1/projects/" + projectId + "/schedule-summary"), devToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.is_on_hold").value(true))
                .andExpect(jsonPath("$.next_checkin_status").value("PAUSED"));
    }

    // =========================================================================
    // TEST 4: Rescheduling Target Deadline with Mandatory Reason & Versioning
    // =========================================================================
    @Test
    @DisplayName("Reschedule target deadline requires mandatory reason, records versioned history, and supersedes previous occurrence")
    void testRescheduleTargetDeadline() throws Exception {
        Workspace ws = workspace("cal-resched");
        Person dev = person("resched-dev");

        UUID devMem = member(ws.id(), dev.id(), "DEVELOPER");
        seedGrant(ws.id(), devMem, DEVELOPER_ROLE, ws.ownerId());
        String devToken = switchTo(dev.token(), ws.id());

        String projectId = createProject(
                ws, "PRJ-RESCH", "Reschedule Project", dev.id(),
                "2026-06-01T09:00:00Z", "2026-06-30T17:00:00Z", "Europe/London"
        );

        // Generate initial occurrences
        mockMvc.perform(withToken(get("/v1/projects/" + projectId + "/occurrences"), devToken))
                .andExpect(status().isOk());

        // 1. Reschedule without reason -> rejected (400 REASON_REQUIRED)
        mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/deadlines/reschedule"), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "newTargetDate": "2026-07-15",
                            "reason": ""
                        }
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("REASON_REQUIRED"));

        // 2. Reschedule with valid reason -> 200 OK
        mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/deadlines/reschedule"), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "new_target_date": "2026-07-15",
                            "reason": "Client requested scope extension for additional integrations"
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.due_local_date").value("2026-07-15"))
                .andExpect(jsonPath("$.kind").value("TARGET"))
                .andExpect(jsonPath("$.status").value("OPEN"));

        // 3. Verify prior TARGET occurrence was marked SUPERSEDED
        MvcResult occRes = mockMvc.perform(withToken(get("/v1/projects/" + projectId + "/occurrences"), devToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode occs = json(occRes);
        boolean foundSuperseded = false;
        boolean foundNewOpen = false;
        for (JsonNode occ : occs) {
            if ("TARGET".equals(occ.path("kind").asText())) {
                if ("2026-06-30".equals(occ.path("due_local_date").asText())) {
                    assertThat(occ.path("status").asText()).isEqualTo("SUPERSEDED");
                    foundSuperseded = true;
                } else if ("2026-07-15".equals(occ.path("due_local_date").asText())) {
                    assertThat(occ.path("status").asText()).isEqualTo("OPEN");
                    foundNewOpen = true;
                }
            }
        }
        assertThat(foundSuperseded).isTrue();
        assertThat(foundNewOpen).isTrue();

        // 4. Verify audit log was recorded
        Integer auditCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM audit_log WHERE org_id = ? AND action = 'PROJECT_TARGET_RESCHEDULED'",
                Integer.class, ws.id());
        assertThat(auditCount).isGreaterThan(0);
    }

    // =========================================================================
    // TEST 5: Reminder Candidates Generation & Deduplication
    // =========================================================================
    @Test
    @DisplayName("Reminder candidates are generated and duplicate occurrences are prevented for same window")
    void testReminderCandidatesAndNoDuplicateOccurrences() throws Exception {
        Workspace ws = workspace("cal-rem");
        Person dev = person("rem-dev");

        UUID devMem = member(ws.id(), dev.id(), "DEVELOPER");
        seedGrant(ws.id(), devMem, DEVELOPER_ROLE, ws.ownerId());
        String devToken = switchTo(dev.token(), ws.id());

        String projectId = createProject(
                ws, "PRJ-REM", "Reminder Project", dev.id(),
                "2026-06-01T09:00:00Z", "2026-06-30T17:00:00Z", "Europe/London"
        );

        // Generate occurrences first time
        mockMvc.perform(withToken(get("/v1/projects/" + projectId + "/occurrences"), devToken))
                .andExpect(status().isOk());

        // Call again - verify idempotency: no duplicates created
        MvcResult occRes2 = mockMvc.perform(withToken(get("/v1/projects/" + projectId + "/occurrences"), devToken))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode occs2 = json(occRes2);
        long targetCount = 0;
        for (JsonNode o : occs2) {
            if ("TARGET".equals(o.path("kind").asText())) {
                targetCount++;
            }
        }
        assertThat(targetCount).isEqualTo(1); // exactly one target occurrence

        // Check reminder candidates
        MvcResult remRes = mockMvc.perform(withToken(get("/v1/organizations/" + ws.id() + "/reminders/candidates"), ws.ownerToken()))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode candidates = json(remRes);
        assertThat(candidates.isArray()).isTrue();
        assertThat(candidates.size()).isGreaterThan(0);
        assertThat(candidates.get(0).path("channel").asText()).isEqualTo("EMAIL");
        assertThat(candidates.get(0).path("status").asText()).isEqualTo("PENDING");
    }
}
