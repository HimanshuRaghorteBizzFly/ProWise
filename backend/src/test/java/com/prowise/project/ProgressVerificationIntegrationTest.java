package com.prowise.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.testsupport.TestAccounts;
import com.prowise.authz.TestDatabase;

/**
 * Task 2.2: Individual check-ins with Team Lead approval. Every submission starts PENDING; the project's figure
 * changes only when the lead of the project's team approves; rejection keeps the old figure with a reason; the label
 * is always "Developer reported"; entries are append-only; 100% never closes delivery.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T17")
@Tag("T18")
@Tag("T28")
@Tag("AS-01")
class ProgressVerificationIntegrationTest {

    private static final UUID TEAM_LEAD_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000004");
    private static final UUID DEVELOPER_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000005");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    @AfterEach
    void clean() {
        TestDatabase.clean(jdbc);
    }

    /* ================================================================== T17 */

    @Test
    @DisplayName("T17: a check-in starts PENDING, is dated and validated, creates no tasks and leaves progress Not reported")
    void submittedCheckInIsPendingAndDoesNotChangeProgress() throws Exception {
        World w = world("t17");
        JsonNode empty = summary(w.project(), w.devToken());
        assertThat(empty.path("current").path("percent").isNull()).isTrue();
        assertThat(empty.path("current").path("label").asText()).isEqualTo("Not reported");
        assertThat(empty.path("history").size()).isZero();
        assertThat(empty.path("can_submit").asBoolean()).isTrue();

        JsonNode entry = json(submit(w.project(), w.devToken(), "k-" + UUID.randomUUID(),
                checkIn("45", "Lead import works", "Test call routing", "Waiting for API keys", "2026-11-20", null))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.method").value("developer_reported"))
                .andExpect(jsonPath("$.label").value("Developer reported"))
                .andExpect(jsonPath("$.percent").value(45.0))
                .andExpect(jsonPath("$.accomplished").value("Lead import works"))
                .andExpect(jsonPath("$.next_steps").value("Test call routing"))
                .andExpect(jsonPath("$.blockers").value("Waiting for API keys"))
                .andExpect(jsonPath("$.projected_finish").value("2026-11-20"))
                .andExpect(jsonPath("$.revision_seq").value(1))
                .andExpect(jsonPath("$.author.email").value(w.devEmail()))
                .andExpect(jsonPath("$.submitted_at").isNotEmpty())
                .andExpect(jsonPath("$.decided_at").doesNotExist())
                .andReturn());

        // Pending does not change the current figure; it is shown separately.
        projectView(w).andExpect(jsonPath("$.progress.percent").doesNotExist())
                .andExpect(jsonPath("$.progress.label").value("Not reported"))
                .andExpect(jsonPath("$.task_count").value(0));
        JsonNode s = summary(w.project(), w.devToken());
        assertThat(s.path("current").path("label").asText()).isEqualTo("Not reported");
        assertThat(s.path("pending").path("id").asText()).isEqualTo(entry.path("id").asText());
        assertThat(s.path("approver").path("email").asText()).isEqualTo(w.leadEmail());
        assertThat(s.path("can_submit").asBoolean()).isFalse(); // one pending entry at a time
        assertThat(count("SELECT count(*) FROM work_items WHERE project_id = ?", w.project())).isZero();
        assertThat(lastPercent(w.project())).isNull();

        // Validation: range, precision and required text.
        submit(w.project(), w.devToken(), null, checkIn("101", "a", "b", null, null, null))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("percent"));
        submit(w.project(), w.devToken(), null, checkIn("-1", "a", "b", null, null, null))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("percent"));
        submit(w.project(), w.devToken(), null, "{\"accomplished\":\"a\",\"next_steps\":\"b\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("percent"));
        submit(w.project(), w.devToken(), null, checkIn("50", " ", "b", null, null, null))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("accomplished"))
                .andExpect(jsonPath("$.request_id").isNotEmpty());
        // While one entry is pending, a second submission waits for the decision.
        submit(w.project(), w.devToken(), null, checkIn("50", "a", "b", null, null, null))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CHECKIN_PENDING_DECISION"));
        assertThat(count("SELECT count(*) FROM project_progress_checkins WHERE project_id = ?", w.project())).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'checkin.submitted'")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'CheckInSubmitted'")).isEqualTo(1);
    }

    @Test
    @DisplayName("T17: replaying an Idempotency-Key adds no second entry; reusing it for another body is a conflict")
    void replayedIdempotencyKeyAddsOneEntry() throws Exception {
        World w = world("replay");
        String key = "replay-" + UUID.randomUUID();
        String body = checkIn("45", "Lead import works", "Test call routing", null, null, null);
        String first = json(submit(w.project(), w.devToken(), key, body).andExpect(status().isCreated()).andReturn())
                .path("id").asText();
        submit(w.project(), w.devToken(), key, body).andExpect(status().isCreated())
                .andExpect(header().string("Idempotent-Replayed", "true"))
                .andExpect(jsonPath("$.id").value(first));
        submit(w.project(), w.devToken(), key, checkIn("46", "Other", "Other", null, null, null))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
        assertThat(count("SELECT count(*) FROM project_progress_checkins WHERE project_id = ?", w.project())).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'CheckInSubmitted'")).isEqualTo(1);
    }

    @Test
    @DisplayName("Concurrent submissions with different keys create exactly one pending entry")
    void concurrentSubmissionsCreateOnePendingEntry() throws Exception {
        World w = world("race");
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        List<Future<Integer>> results = new ArrayList<>();
        for (int i = 0; i < 2; i++) {
            String body = checkIn(String.valueOf(40 + i), "Work " + i, "Next " + i, null, null, null);
            Callable<Integer> call = () -> {
                start.await();
                return submit(w.project(), w.devToken(), "race-" + UUID.randomUUID(), body).andReturn().getResponse().getStatus();
            };
            results.add(pool.submit(call));
        }
        start.countDown();
        List<Integer> statuses = new ArrayList<>();
        for (Future<Integer> result : results) statuses.add(result.get());
        pool.shutdown();
        assertThat(statuses).containsExactlyInAnyOrder(201, 409);
        assertThat(count("SELECT count(*) FROM project_progress_checkins WHERE project_id = ? AND status = 'PENDING'",
                w.project())).isEqualTo(1);
    }

    /* ================================================================== approval (T28, AS-01) */

    @Test
    @DisplayName("T28/AS-01: Team Lead approval makes the entry current; the label stays Developer reported with its time")
    void approvalChangesProgressAndKeepsTheLabel() throws Exception {
        World w = world("as01");
        jdbc.update("""
                INSERT INTO github_activity (id, org_id, project_id, repository_name, event_type, actor, title, created_at)
                VALUES ('gh-1', ?, ?, 'acme/crm', 'PUSH', 'dev', 'Lead import', ?)
                """, w.org(), w.project(), Timestamp.from(Instant.parse("2026-11-01T08:00:00Z")));
        JsonNode entry = json(submit(w.project(), w.devToken(), null,
                checkIn("40", "Lead import works", "Call routing", null, null, null)).andExpect(status().isCreated()).andReturn());
        String id = entry.path("id").asText();

        JsonNode queue = json(mockMvc.perform(auth(get("/v1/organizations/{org}/reviews/pending", w.org()), w.leadToken()))
                .andExpect(status().isOk()).andReturn());
        assertThat(queue.size()).isEqualTo(1);
        assertThat(queue.get(0).path("checkin").path("id").asText()).isEqualTo(id);
        assertThat(queue.get(0).path("current").path("label").asText()).isEqualTo("Not reported");
        assertThat(summary(w.project(), w.leadToken()).path("can_decide").asBoolean()).isTrue();

        decide(id, w.leadToken(), "APPROVE", "Matches the demo", 0).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.method").value("developer_reported"))
                .andExpect(jsonPath("$.label").value("Developer reported"))
                .andExpect(jsonPath("$.decided_by.email").value(w.leadEmail()))
                .andExpect(jsonPath("$.decided_at").isNotEmpty())
                .andExpect(jsonPath("$.author.email").value(w.devEmail()));

        assertThat(lastPercent(w.project())).isEqualByComparingTo("40");
        projectView(w).andExpect(jsonPath("$.progress.percent").value(40.0))
                .andExpect(jsonPath("$.progress.label").value("Developer reported"))
                .andExpect(jsonPath("$.progress.reported_at").value(entry.path("submitted_at").asText()));
        JsonNode portfolio = json(mockMvc.perform(auth(get("/v1/organizations/{org}/projects", w.org()), w.ownerToken()))
                .andExpect(status().isOk()).andReturn());
        assertThat(portfolio.path("items").get(0).path("progress").path("label").asText()).isEqualTo("Developer reported");
        JsonNode s = summary(w.project(), w.ownerToken());
        assertThat(s.path("current").path("percent").decimalValue()).isEqualByComparingTo("40");
        assertThat(s.path("current").path("method").asText()).isEqualTo("developer_reported");
        assertThat(s.path("pending").isNull()).isTrue();

        // Repository events are evidence with their own timestamps; they never set progress.
        mockMvc.perform(auth(get("/v1/projects/{id}/github-activity", w.project()), w.devToken()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value("gh-1"))
                .andExpect(jsonPath("$[0].created_at").value("2026-11-01T08:00:00Z"));

        // Decided once only; the queue is empty; audit and outbox recorded the decision.
        decide(id, w.leadToken(), "REJECT", "Changed my mind", 1)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CHECKIN_ALREADY_DECIDED"));
        assertThat(json(mockMvc.perform(auth(get("/v1/organizations/{org}/reviews/pending", w.org()), w.leadToken()))
                .andReturn()).size()).isZero();
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'checkin.approved'")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'CheckInApproved'")).isEqualTo(1);
    }

    @Test
    @DisplayName("Rejection needs a reason, keeps the previous approved figure and is visible in history")
    void rejectionKeepsTheOldFigure() throws Exception {
        World w = world("reject");
        approve(w, "40");
        String second = json(submit(w.project(), w.devToken(), null, checkIn("60", "More work", "Even more", null, null, null))
                .andExpect(status().isCreated()).andReturn()).path("id").asText();

        decide(second, w.leadToken(), "REJECT", "  ", 0)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("reason"));
        decide(second, w.leadToken(), "MAYBE", null, 0)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("decision"));
        decide(second, w.leadToken(), "REJECT", "Demo still fails on routing", 0).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.decision_reason").value("Demo still fails on routing"));

        assertThat(lastPercent(w.project())).isEqualByComparingTo("40");
        JsonNode s = summary(w.project(), w.devToken());
        assertThat(s.path("current").path("percent").decimalValue()).isEqualByComparingTo("40");
        assertThat(s.path("history").size()).isEqualTo(2);
        assertThat(s.path("history").get(0).path("status").asText()).isEqualTo("REJECTED");
        assertThat(s.path("history").get(1).path("status").asText()).isEqualTo("APPROVED");
        assertThat(s.path("can_submit").asBoolean()).isTrue(); // a rejection frees the developer to submit again
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'checkin.rejected'")).isEqualTo(1);
    }

    @Test
    @DisplayName("A stale expected_version is a 409 STALE_VERSION and changes nothing")
    void staleDecisionIsAConflict() throws Exception {
        World w = world("stale");
        String id = json(submit(w.project(), w.devToken(), null, checkIn("30", "a", "b", null, null, null))
                .andExpect(status().isCreated()).andReturn()).path("id").asText();
        decide(id, w.leadToken(), "APPROVE", null, 7)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        decide(id, w.leadToken(), "APPROVE", null, null)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("expected_version"));
        assertThat(lastPercent(w.project())).isNull();
        assertThat(jdbc.queryForObject("SELECT status FROM project_progress_checkins WHERE id = ?", String.class, id))
                .isEqualTo("PENDING");
    }

    /* ================================================================== who may decide */

    @Test
    @DisplayName("Only the lead of the project's team decides; never another team's lead, the owner or the author")
    void teamLeadBoundaries() throws Exception {
        World w = world("bounds");
        String id = json(submit(w.project(), w.devToken(), null, checkIn("30", "a", "b", null, null, null))
                .andExpect(status().isCreated()).andReturn()).path("id").asText();

        // Another team's lead cannot even read the project: 404, and their queue is empty.
        Person other = person("other-lead");
        UUID otherMembership = member(w.org(), other.id(), "TEAM_LEAD", TEAM_LEAD_ROLE);
        team(w.org(), "Team B", otherMembership);
        String otherToken = switchTo(other.token(), w.org());
        decide(id, otherToken, "APPROVE", null, 0).andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/projects/{id}/checkins/summary", w.project()), otherToken))
                .andExpect(status().isNotFound());
        assertThat(json(mockMvc.perform(auth(get("/v1/organizations/{org}/reviews/pending", w.org()), otherToken))
                .andReturn()).size()).isZero();

        // The owner reads everything but is not the team lead.
        decide(id, w.ownerToken(), "APPROVE", null, 0)
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("NOT_PROJECT_TEAM_LEAD"));
        // The author never decides their own entry.
        decide(id, w.devToken(), "APPROVE", null, 0)
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SELF_APPROVAL_NOT_ALLOWED"));
        // Foreign or unknown check-in ids are 404.
        decide(UUID.randomUUID().toString(), w.leadToken(), "APPROVE", null, 0).andExpect(status().isNotFound());
        World foreign = world("foreign");
        decide(id, foreign.leadToken(), "APPROVE", null, 0).andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/projects/{id}/checkins", w.project()), foreign.ownerToken()))
                .andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT status FROM project_progress_checkins WHERE id = ?", String.class, id))
                .isEqualTo("PENDING");
    }

    @Test
    @DisplayName("A Team Lead never approves their own entry, even on the team they lead; no lead means it stays pending")
    void leadCannotApproveOwnEntryAndNoLeadStaysPending() throws Exception {
        World w = world("self");
        // The lead is also the accountable developer of a second project of their own team.
        jdbc.update("""
                INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by)
                VALUES (gen_random_uuid(), ?, ?, ?, 'ORG', ?)
                """, w.org(), w.leadMembership(), DEVELOPER_ROLE, w.ownerId());
        String own = createProject(w, "Lead solo", "LEADSOLO", w.leadMembership(), w.team());
        String id = json(submit(own, w.leadToken(), null, checkIn("20", "a", "b", null, null, null))
                .andExpect(status().isCreated()).andReturn()).path("id").asText();
        decide(id, w.leadToken(), "APPROVE", null, 0)
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SELF_APPROVAL_NOT_ALLOWED"));
        assertThat(summary(own, w.leadToken()).path("can_decide").asBoolean()).isFalse();
        assertThat(json(mockMvc.perform(auth(get("/v1/organizations/{org}/reviews/pending", w.org()), w.leadToken()))
                .andReturn()).size()).isZero();

        // A project whose team has no lead: nobody can decide; the summary explains it.
        UUID leaderless = team(w.org(), "No lead team", null);
        String orphan = createProject(w, "Orphan", "ORPHAN", w.devMembership(), leaderless);
        String pending = json(submit(orphan, w.devToken(), null, checkIn("10", "a", "b", null, null, null))
                .andExpect(status().isCreated()).andReturn()).path("id").asText();
        JsonNode s = summary(orphan, w.ownerToken());
        assertThat(s.path("approver").isNull()).isTrue();
        assertThat(s.path("approver_note").asText()).contains("No team lead");
        decide(pending, w.ownerToken(), "APPROVE", null, 0).andExpect(status().isForbidden());
        decide(pending, w.leadToken(), "APPROVE", null, 0).andExpect(status().isNotFound()); // not their team
    }

    @Test
    @DisplayName("Leading the team is not enough without project.progress.verify")
    void leadWithoutVerifyKeyIsForbidden() throws Exception {
        World w = world("nokey");
        Person plain = person("plain-lead");
        UUID plainMembership = member(w.org(), plain.id(), "DEVELOPER", DEVELOPER_ROLE);
        jdbc.update("UPDATE teams SET lead_membership_id = ? WHERE id = ?", plainMembership, w.team());
        String id = json(submit(w.project(), w.devToken(), null, checkIn("30", "a", "b", null, null, null))
                .andExpect(status().isCreated()).andReturn()).path("id").asText();
        decide(id, switchTo(plain.token(), w.org()), "APPROVE", null, 0)
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    /* ================================================================== T18 corrections */

    @Test
    @DisplayName("T18: a downward correction needs a reason; original, correction, authors and decisions stay visible")
    void downwardCorrectionNeedsAReason() throws Exception {
        World w = world("t18");
        String original = approve(w, "45");

        submit(w.project(), w.devToken(), null, checkIn("30", "Found a race", "Fix locking", null, null, null))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("DOWNWARD_REASON_REQUIRED"))
                .andExpect(jsonPath("$.field_errors[0].field").value("downward_reason"));
        String correction = json(submit(w.project(), w.devToken(), null,
                checkIn("30", "Found a race", "Fix locking", null, null, "Missing lock index caused lost updates"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.revision_seq").value(2))
                .andExpect(jsonPath("$.revision_of").value(original))
                .andExpect(jsonPath("$.downward_reason").value("Missing lock index caused lost updates"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn()).path("id").asText();
        assertThat(lastPercent(w.project())).isEqualByComparingTo("45"); // still the approved figure

        decide(correction, w.leadToken(), "APPROVE", null, 0).andExpect(status().isOk());
        assertThat(lastPercent(w.project())).isEqualByComparingTo("30");

        JsonNode history = json(mockMvc.perform(auth(get("/v1/projects/{id}/progress-history", w.project()), w.ownerToken()))
                .andExpect(status().isOk()).andReturn());
        assertThat(history.size()).isEqualTo(2);
        assertThat(history.get(0).path("percent").decimalValue()).isEqualByComparingTo("30");
        assertThat(history.get(1).path("percent").decimalValue()).isEqualByComparingTo("45");
        for (JsonNode e : history) {
            assertThat(e.path("author").path("email").asText()).isEqualTo(w.devEmail());
            assertThat(e.path("decided_by").path("email").asText()).isEqualTo(w.leadEmail());
            assertThat(e.path("method").asText()).isEqualTo("developer_reported");
            assertThat(e.path("status").asText()).isEqualTo("APPROVED");
        }
        // An upward correction needs no reason.
        submit(w.project(), w.devToken(), null, checkIn("35", "Fixed", "Ship", null, null, null))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.downward_reason").doesNotExist());
    }

    @Test
    @DisplayName("T18: entries cannot be edited or deleted, and a decided entry cannot be decided again in SQL")
    void entriesAreAppendOnly() throws Exception {
        World w = world("append");
        String id = approve(w, "45");
        assertThatThrownBy(() -> jdbc.update("UPDATE project_progress_checkins SET percent = 99 WHERE id = ?", id))
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update("UPDATE project_progress_checkins SET status = 'REJECTED' WHERE id = ?", id))
                .hasMessageContaining("already decided");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM project_progress_checkins WHERE id = ?", id))
                .hasMessageContaining("append-only");
        String pending = json(submit(w.project(), w.devToken(), null, checkIn("50", "a", "b", null, null, null))
                .andExpect(status().isCreated()).andReturn()).path("id").asText();
        assertThatThrownBy(() -> jdbc.update("UPDATE project_progress_checkins SET accomplished = 'x' WHERE id = ?", pending))
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update("UPDATE project_progress_checkins SET status = 'PENDING', reviewed_at = now() WHERE id = ?", pending))
                .hasMessageContaining("decision is invalid");
        assertThat(count("SELECT count(*) FROM project_progress_checkins WHERE project_id = ?", w.project())).isEqualTo(2);
    }

    /* ================================================================== delivery and modes */

    @Test
    @DisplayName("Approving 100% does not close delivery: lifecycle unchanged, label Developer reported")
    void hundredPercentDoesNotCloseDelivery() throws Exception {
        World w = world("full");
        approve(w, "100");
        assertThat(jdbc.queryForObject("SELECT lifecycle FROM projects WHERE id = ?", String.class, w.project()))
                .isEqualTo("ACTIVE");
        projectView(w).andExpect(jsonPath("$.lifecycle").value("ACTIVE"))
                .andExpect(jsonPath("$.progress.percent").value(100.0))
                .andExpect(jsonPath("$.progress.label").value("Developer reported"));
    }

    @Test
    @DisplayName("Only the accountable developer submits, only on Individual projects; unreadable projects are 404")
    void onlyTheAccountableDeveloperSubmits() throws Exception {
        World w = world("who");
        Person member = person("member-dev");
        UUID memberMembership = member(w.org(), member.id(), "DEVELOPER", DEVELOPER_ROLE);
        jdbc.update("INSERT INTO project_members (org_id, project_id, membership_id, added_by) VALUES (?, ?, ?, ?)",
                w.org(), w.project(), memberMembership, w.ownerId());
        String memberToken = switchTo(member.token(), w.org());
        submit(w.project(), memberToken, null, checkIn("10", "a", "b", null, null, null))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("NOT_ACCOUNTABLE_DEVELOPER"));
        submit(w.project(), w.ownerToken(), null, checkIn("10", "a", "b", null, null, null))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("NOT_ACCOUNTABLE_DEVELOPER"));

        Person stranger = person("stranger");
        member(w.org(), stranger.id(), "DEVELOPER", DEVELOPER_ROLE);
        submit(w.project(), switchTo(stranger.token(), w.org()), null, checkIn("10", "a", "b", null, null, null))
                .andExpect(status().isNotFound());

        String structured = createProject(w, "Structured", "STRUCT", w.devMembership(), w.team(), "STRUCTURED");
        submit(structured, w.devToken(), null, checkIn("10", "a", "b", null, null, null))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROJECT_NOT_INDIVIDUAL"));
        assertThat(count("SELECT count(*) FROM project_progress_checkins")).isZero();
    }

    @Test
    @DisplayName("The legacy developer check-in route follows the same rule: PENDING, figure unchanged")
    void legacyDeveloperRouteIsPendingToo() throws Exception {
        World w = world("legacy");
        mockMvc.perform(auth(post("/v1/developer/check-ins"), w.devToken()).contentType("application/json")
                        .content("{\"project_id\":\"" + w.project() + "\",\"percent\":55,\"accomplished\":\"a\",\"next_steps\":\"b\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("PENDING"));
        assertThat(lastPercent(w.project())).isNull();
    }

    /* ================================================================== fixture */

    private record Person(UUID id, String email, String token) {}
    private record Workspace(UUID id, UUID ownerId, String ownerEmail, String ownerToken) {}

    private Person person(String name) throws Exception {
        String email = name + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        MvcResult res = mockMvc.perform(post("/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-battery\"}"))
                .andExpect(status().isCreated()).andReturn();
        JsonNode signup = json(res);
        UUID id = jdbc.queryForObject("SELECT id FROM users WHERE lower(email) = lower(?)", UUID.class, email);
        return new Person(id, email, signup.path("access_token").asText());
    }

    private Workspace workspace(String slug) throws Exception {
        Person owner = person(slug + "-owner");
        String unique = slug + "-" + UUID.randomUUID().toString().substring(0, 6);
        UUID org = UUID.fromString(json(mockMvc.perform(auth(post("/v1/organizations"), owner.token())
                        .contentType("application/json")
                        .content("{\"name\":\"" + unique + "\",\"slug\":\"" + unique + "\",\"timezone\":\"Europe/London\","
                                + "\"calendar\":{\"workdays\":[1,2,3,4,5],\"holidays\":[]}}"))
                .andExpect(status().isCreated()).andReturn()).path("id").asText());
        String ownerToken = switchTo(owner.token(), org);
        Person dev = person(slug + "-dev");
        UUID devMembership = member(org, dev.id(), "DEVELOPER", DEVELOPER_ROLE);
        Person lead = person(slug + "-lead");
        UUID leadMembership = member(org, lead.id(), "TEAM_LEAD", TEAM_LEAD_ROLE);
        UUID team = team(org, slug + " team", leadMembership);
        World partial = new World(org, owner.id(), ownerToken, devMembership, dev.email(), switchTo(dev.token(), org),
                leadMembership, lead.email(), switchTo(lead.token(), org), team, null);
        String project = createProject(partial, "Solo CRM", "CRM", devMembership, team);
        return new World(org, owner.id(), ownerToken, devMembership, dev.email(), partial.devToken(), leadMembership,
                lead.email(), partial.leadToken(), team, project);
    }

    private String createProject(World w, String name, String key, UUID accountable, UUID team) throws Exception {
        return createProject(w, name, key, accountable, team, "INDIVIDUAL");
    }

    private String createProject(World w, String name, String key, UUID accountable, UUID team, String mode) throws Exception {
        return json(mockMvc.perform(auth(post("/v1/organizations/{org}/projects", w.org()), w.ownerToken())
                        .contentType("application/json")
                        .content("{\"name\":\"" + name + "\",\"key\":\"" + key + "\",\"mode\":\"" + mode + "\",\"status\":\"ACTIVE\","
                                + "\"accountable_membership_id\":\"" + accountable + "\",\"team_id\":\"" + team + "\"}"))
                .andExpect(status().isCreated()).andReturn()).path("id").asText();
    }

    /** Submits and approves one entry; returns its id. */
    private String approve(World w, String percent) throws Exception {
        String id = json(submit(w.project(), w.devToken(), null, checkIn(percent, "Work done", "Next work", null, null, null))
                .andExpect(status().isCreated()).andReturn()).path("id").asText();
        decide(id, w.leadToken(), "APPROVE", null, 0).andExpect(status().isOk());
        return id;
    }

    private org.springframework.test.web.servlet.ResultActions submit(String project, String token, String key, String body)
            throws Exception {
        MockHttpServletRequestBuilder request = auth(post("/v1/projects/{id}/checkins", project), token)
                .contentType("application/json").content(body);
        if (key != null) request.header("Idempotency-Key", key);
        return mockMvc.perform(request);
    }

    private org.springframework.test.web.servlet.ResultActions decide(String id, String token, String decision,
            String reason, Integer expectedVersion) throws Exception {
        StringBuilder body = new StringBuilder("{\"decision\":\"").append(decision).append("\"");
        if (reason != null) body.append(",\"reason\":\"").append(reason).append("\"");
        if (expectedVersion != null) body.append(",\"expected_version\":").append(expectedVersion);
        return mockMvc.perform(auth(post("/v1/checkins/{id}/decision", id), token).contentType("application/json")
                .content(body.append("}").toString()));
    }

    private org.springframework.test.web.servlet.ResultActions projectView(World w) throws Exception {
        return mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}", w.org(), w.project()), w.ownerToken()))
                .andExpect(status().isOk());
    }

    private JsonNode summary(String project, String token) throws Exception {
        return json(mockMvc.perform(auth(get("/v1/projects/{id}/checkins/summary", project), token))
                .andExpect(status().isOk()).andReturn());
    }

    private static String checkIn(String percent, String accomplished, String next, String blockers, String finish,
            String downwardReason) {
        StringBuilder json = new StringBuilder("{\"percent\":").append(percent)
                .append(",\"accomplished\":\"").append(accomplished).append("\",\"next_steps\":\"").append(next).append("\"");
        if (blockers != null) json.append(",\"blockers\":\"").append(blockers).append("\"");
        if (finish != null) json.append(",\"projected_finish\":\"").append(finish).append("\"");
        if (downwardReason != null) json.append(",\"downward_reason\":\"").append(downwardReason).append("\"");
        return json.append("}").toString();
    }

    private UUID team(UUID org, String name, UUID leadMembership) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO teams (id, org_id, name, lead_membership_id) VALUES (?, ?, ?, ?)", id, org, name, leadMembership);
        return id;
    }

    private UUID member(UUID org, UUID userId, String template, UUID templateRole) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, ?)", id, org, userId, template);
        jdbc.update("""
                INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by)
                VALUES (gen_random_uuid(), ?, ?, ?, 'ORG', ?)
                """, org, id, templateRole, userId);
        return id;
    }

    private Person person(String name) throws Exception {
        String email = name + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        JsonNode signup = json(mockMvc.perform(post("/v1/auth/signup").contentType("application/json")
                        .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-battery\"}"))
                .andExpect(status().isCreated()).andReturn());
        UUID id = jdbc.queryForObject("SELECT id FROM users WHERE lower(email) = lower(?)", UUID.class, email);
        return new Person(id, email, signup.path("access_token").asText());
    }

    private String switchTo(String token, UUID org) throws Exception {
        return json(mockMvc.perform(auth(post("/v1/me/organizations/{org}/switch", org), token))
                .andExpect(status().isOk()).andReturn()).path("access_token").asText();
    }

    private BigDecimal lastPercent(String project) {
        return jdbc.queryForObject("SELECT last_progress_percent FROM projects WHERE id = ?", BigDecimal.class, project);
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
