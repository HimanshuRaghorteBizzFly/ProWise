package com.prowise.operator.console;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.testsupport.ConsoleSessions;

/** Operator announcement and email drafts: CRUD with versions, submit, Super Admin review, HTML refusal, audit. */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Tag("NFR-06")
class OperatorDraftsIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder encoder;
    @Autowired private ObjectMapper mapper;

    private String admin;
    private String messaging;
    private String messagingId;

    @BeforeEach
    void setUp() throws Exception {
        TestDatabase.clean(jdbc);
        ConsoleSessions.cleanup(jdbc);
        admin = ConsoleSessions.superAdmin(mvc, jdbc, encoder, mapper);
        messagingId = ConsoleSessions.operatorId("msg");
        messaging = ConsoleSessions.operator(mvc, jdbc, encoder, mapper, messagingId, "DEPARTMENT_OPERATOR", "lifecycle-messaging");
        jdbc.update("DELETE FROM operator_activity_logs");
    }

    @AfterEach
    void tearDown() {
        ConsoleSessions.cleanup(jdbc);
    }

    // ---------------------------------------------------------------- announcement drafts

    @Test
    void announcementDraftLifecycleWithVersionsSubmitAndSuperAdminPublish() throws Exception {
        JsonNode created = json(send(messaging, post("/v1/operator/announcement-drafts"), Map.of(
                "title", "Planned maintenance", "message", "Sunday 02:00 UTC", "type", "maintenance",
                "scheduled_for", "2030-01-05T02:00:00Z")).andExpect(status().isCreated()));
        String id = created.path("id").asText();
        assertThat(created.path("status").asText()).isEqualTo("DRAFT");
        assertThat(created.path("type").asText()).isEqualTo("MAINTENANCE");
        assertThat(created.path("author_type").asText()).isEqualTo("OPERATOR");
        assertThat(created.path("author_id").asText()).isEqualTo(messagingId);
        assertThat(created.path("version").asLong()).isZero();

        // Missing version = 400; stale = 409; current = 200 with version + 1.
        send(messaging, put("/v1/operator/announcement-drafts/" + id), Map.of("title", "T", "message", "M"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("expected_version"));
        send(messaging, put("/v1/operator/announcement-drafts/" + id), Map.of("title", "T", "message", "M", "expected_version", 7))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        send(messaging, put("/v1/operator/announcement-drafts/" + id),
                Map.of("title", "Planned maintenance v2", "message", "Sunday 03:00 UTC", "expected_version", 0))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.title").value("Planned maintenance v2"));

        send(messaging, post("/v1/operator/announcement-drafts/" + id + "/submit"), Map.of("expected_version", 0))
                .andExpect(status().isConflict());
        send(messaging, post("/v1/operator/announcement-drafts/" + id + "/submit"), Map.of("expected_version", 1))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PENDING_REVIEW"))
                .andExpect(jsonPath("$.submitted_by").value(messagingId + "@console.test"));
        // Submitted drafts are frozen for the operator.
        send(messaging, put("/v1/operator/announcement-drafts/" + id), Map.of("title", "x", "message", "y", "expected_version", 2))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVALID_STATE"));

        // Operators cannot publish (Super Admin API) nor review.
        send(messaging, post("/v1/admin/announcements/" + id + "/publish"), Map.of("expected_version", 2))
                .andExpect(status().isForbidden());
        send(messaging, post("/v1/admin/announcements/" + id + "/request-changes"), Map.of("expected_version", 2))
                .andExpect(status().isForbidden());

        // Super Admin sends it back; the author edits and resubmits; the Super Admin publishes it.
        send(admin, post("/v1/admin/announcements/" + id + "/request-changes"),
                Map.of("expected_version", 2, "reviewer_note", "Add the region"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CHANGES_REQUESTED"))
                .andExpect(jsonPath("$.reviewer_note").value("Add the region"));
        send(messaging, put("/v1/operator/announcement-drafts/" + id),
                Map.of("title", "Planned maintenance EU", "message", "Sunday 03:00 UTC, EU", "expected_version", 3))
                .andExpect(status().isOk());
        send(messaging, post("/v1/operator/announcement-drafts/" + id + "/submit"), Map.of("expected_version", 4))
                .andExpect(status().isOk());
        send(admin, post("/v1/admin/announcements/" + id + "/publish"), Map.of("expected_version", 5))
                .andExpect(status().isOk());
        as(messaging, get("/v1/operator/announcement-drafts/" + id)).andExpect(jsonPath("$.status").value("PUBLISHED"));
        as(messaging, get("/v1/operator/announcement-drafts?status=PUBLISHED")).andExpect(jsonPath("$.total").value(1));

        // Audited in the operator activity log and the platform audit log.
        assertThat(jdbc.queryForList("SELECT action FROM operator_activity_logs WHERE resource_id = ? ORDER BY created_at",
                String.class, id)).contains("ANNOUNCEMENT_DRAFT_CREATED", "ANNOUNCEMENT_DRAFT_UPDATED",
                "ANNOUNCEMENT_DRAFT_SUBMITTED", "ANNOUNCEMENT_DRAFT_CHANGES_REQUESTED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit_logs WHERE action LIKE 'ANNOUNCEMENT_DRAFT_%'",
                Integer.class)).isGreaterThanOrEqualTo(5);
    }

    @Test
    void announcementDraftValidationOwnershipDeleteAndSuperAdminOnlyRowsHidden() throws Exception {
        send(messaging, post("/v1/operator/announcement-drafts"), Map.of("title", " ", "type", "bad type!"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.field_errors.length()").value(3));
        String id = json(send(messaging, post("/v1/operator/announcement-drafts"), Map.of("title", "A", "message", "B"))
                .andExpect(status().isCreated())).path("id").asText();

        // Another department operator with the announcement permission may read but not change the author's draft.
        String other = ConsoleSessions.operator(mvc, jdbc, encoder, mapper, ConsoleSessions.operatorId("cc"),
                "DEPARTMENT_OPERATOR", "customer-communications");
        as(other, get("/v1/operator/announcement-drafts/" + id)).andExpect(status().isOk());
        as(other, delete("/v1/operator/announcement-drafts/" + id).param("expectedVersion", "0")).andExpect(status().isForbidden());
        // A department without the permission cannot even read.
        String finance = ConsoleSessions.operator(mvc, jdbc, encoder, mapper, ConsoleSessions.operatorId("fin"),
                "DEPARTMENT_OPERATOR", "finance-tax");
        as(finance, get("/v1/operator/announcement-drafts/" + id)).andExpect(status().isForbidden());

        // A Super Admin announcement (created in the admin console) is not an operator draft: 404 here.
        jdbc.update("INSERT INTO announcements (id, title, message) VALUES ('ann-admin-only', 'Admin', 'x')");
        as(messaging, get("/v1/operator/announcement-drafts/ann-admin-only")).andExpect(status().isNotFound());
        as(messaging, get("/v1/operator/announcement-drafts")).andExpect(jsonPath("$.total").value(1));

        as(messaging, delete("/v1/operator/announcement-drafts/" + id)).andExpect(status().isBadRequest());
        as(messaging, delete("/v1/operator/announcement-drafts/" + id).param("expectedVersion", "3")).andExpect(status().isConflict());
        as(messaging, delete("/v1/operator/announcement-drafts/" + id).param("expectedVersion", "0")).andExpect(status().isNoContent());
        as(messaging, get("/v1/operator/announcement-drafts/" + id)).andExpect(status().isNotFound());
        as(messaging, delete("/v1/operator/announcement-drafts/unknown").param("expectedVersion", "0")).andExpect(status().isNotFound());
    }

    @Test
    void concurrentAnnouncementEditsWithTheSameVersionHaveOneWinner() throws Exception {
        String id = json(send(messaging, post("/v1/operator/announcement-drafts"), Map.of("title", "A", "message", "B"))
                .andExpect(status().isCreated())).path("id").asText();
        List<Integer> codes = concurrently(4, n -> send(messaging, put("/v1/operator/announcement-drafts/" + id),
                Map.of("title", "T" + n, "message", "M", "expected_version", 0)).andReturn().getResponse().getStatus());
        assertThat(codes).containsOnly(200, 409);
        assertThat(codes.stream().filter(c -> c == 200).count()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT version FROM announcements WHERE id = ?", Long.class, id)).isEqualTo(1L);
    }

    @Test
    void operatorCreateReplaysWithTheSameIdempotencyKey() throws Exception {
        Map<String, Object> body = Map.of("title", "Once", "message", "Only once");
        JsonNode first = json(mvc.perform(post("/v1/operator/announcement-drafts").header("Authorization", "Bearer " + messaging)
                .header("Idempotency-Key", "ann-create-1").contentType("application/json")
                .content(mapper.writeValueAsString(body))).andExpect(status().isCreated()));
        JsonNode second = json(mvc.perform(post("/v1/operator/announcement-drafts").header("Authorization", "Bearer " + messaging)
                .header("Idempotency-Key", "ann-create-1").contentType("application/json")
                .content(mapper.writeValueAsString(body))).andExpect(status().isCreated()));
        assertThat(second.path("id").asText()).isEqualTo(first.path("id").asText());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcements WHERE title = 'Once'", Integer.class)).isEqualTo(1);
    }

    // ---------------------------------------------------------------- email drafts

    @Test
    void emailDraftLifecycleReviewAndRejectionLoop() throws Exception {
        JsonNode created = json(send(messaging, post("/v1/operator/email-drafts"), Map.of(
                "name", "Renewal reminder", "category", "Reminders", "subject", "Your plan renews soon",
                "body_text", "Hello", "body_html", "<p>Hello <a href=\"https://prowise.example/billing\">billing</a></p>",
                "audience_description", "Owners of annual plans")).andExpect(status().isCreated()));
        String id = created.path("id").asText();
        assertThat(created.path("status").asText()).isEqualTo("DRAFT");
        assertThat(created.path("created_by").asText()).isEqualTo(messagingId);

        send(messaging, put("/v1/operator/email-drafts/" + id), Map.of("name", "n", "subject", "s", "body_text", "b"))
                .andExpect(status().isBadRequest());
        send(messaging, put("/v1/operator/email-drafts/" + id),
                Map.of("name", "n", "subject", "s", "body_text", "b", "expected_version", 5)).andExpect(status().isConflict());
        send(messaging, put("/v1/operator/email-drafts/" + id),
                Map.of("name", "Renewal reminder v2", "subject", "s", "body_text", "b", "expected_version", 0))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        send(messaging, post("/v1/operator/email-drafts/" + id + "/submit"), Map.of("expected_version", 1))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("SUBMITTED"));

        // Operators cannot review; the Super Admin rejects, the author edits (back to DRAFT) and resubmits, then approval.
        send(messaging, post("/v1/admin/email-drafts/" + id + "/approve"), Map.of("expected_version", 2))
                .andExpect(status().isForbidden());
        send(admin, post("/v1/admin/email-drafts/" + id + "/reject"), Map.of("expected_version", 2, "reviewer_note", "Shorter"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("REJECTED"));
        send(messaging, put("/v1/operator/email-drafts/" + id),
                Map.of("name", "Renewal reminder v3", "subject", "s", "body_text", "short", "expected_version", 3))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DRAFT"));
        send(messaging, post("/v1/operator/email-drafts/" + id + "/submit"), Map.of("expected_version", 4)).andExpect(status().isOk());
        send(admin, post("/v1/admin/email-drafts/" + id + "/approve"), Map.of("expected_version", 5))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.reviewed_by").exists());
        // Approved drafts are frozen; nothing was sent.
        as(messaging, delete("/v1/operator/email-drafts/" + id).param("expectedVersion", "6")).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM email_delivery_logs", Integer.class)).isZero();
        as(admin, get("/v1/admin/email-drafts?status=APPROVED")).andExpect(jsonPath("$.total").value(1));
        assertThat(jdbc.queryForList("SELECT action FROM operator_activity_logs WHERE resource_id = ?", String.class, id))
                .contains("EMAIL_DRAFT_CREATED", "EMAIL_DRAFT_SUBMITTED", "EMAIL_DRAFT_REJECTED", "EMAIL_DRAFT_APPROVED");
    }

    @Test
    void emailDraftRefusesUnsafeHtml() throws Exception {
        List<String> unsafe = List.of(
                "<script>alert(1)</script>",
                "<p onclick=\"steal()\">x</p>",
                "<img src=x onerror=alert(1)>",
                "<a href=\"javascript:alert(1)\">x</a>",
                "<a href=\"jav&#x09;ascript:alert(1)\">x</a>",
                "<a href=\"&#106;avascript:alert(1)\">x</a>",
                "<iframe src=\"https://evil.example\"></iframe>",
                "<object data=\"x\"></object>",
                "<a href=\"data:text/html;base64,PHNjcmlwdD4=\">x</a>");
        for (String html : unsafe) {
            send(messaging, post("/v1/operator/email-drafts"), Map.of("name", "n", "subject", "s", "body_text", "b", "body_html", html))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                    .andExpect(jsonPath("$.field_errors[0].field").value("body_html"));
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM operator_email_drafts", Integer.class)).isZero();
        send(messaging, post("/v1/operator/email-drafts"), Map.of("name", "n", "subject", "s", "body_text", "b",
                "body_html", "<h1 style=\"color:#333\">Online maintenance</h1><p>Read the <a href=\"https://x.example/on\">notes</a>.</p>"))
                .andExpect(status().isCreated());
        // Other departments have no email draft permission.
        String finance = ConsoleSessions.operator(mvc, jdbc, encoder, mapper, ConsoleSessions.operatorId("fin"),
                "DEPARTMENT_OPERATOR", "finance-tax");
        send(finance, post("/v1/operator/email-drafts"), Map.of("name", "n", "subject", "s", "body_text", "b"))
                .andExpect(status().isForbidden());
    }

    // ---------------------------------------------------------------- helpers

    private ResultActions send(String token, MockHttpServletRequestBuilder request, Map<String, ?> body) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + token).contentType("application/json")
                .content(mapper.writeValueAsString(new HashMap<>(body))));
    }

    private ResultActions as(String token, MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(request.header("Authorization", "Bearer " + token));
    }

    private JsonNode json(ResultActions actions) throws Exception {
        return mapper.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    private interface Call {
        int call(int n) throws Exception;
    }

    private static List<Integer> concurrently(int threads, Call call) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Integer>> futures = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                int n = i;
                futures.add(pool.submit(() -> {
                    start.await();
                    return call.call(n);
                }));
            }
            start.countDown();
            List<Integer> results = new ArrayList<>();
            for (Future<Integer> f : futures) results.add(f.get());
            return results;
        } finally {
            pool.shutdownNow();
        }
    }
}
