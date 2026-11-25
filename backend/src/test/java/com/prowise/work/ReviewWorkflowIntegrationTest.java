package com.prowise.work;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
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
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.identity.AccountTokenService;
import com.prowise.testsupport.TestAccounts;

/**
 * Task 3.3: review and rework. Required review blocks Done until the submitted revision is approved with criteria and
 * checks satisfied; changes requested returns the work to In Progress with a new revision; a stale or unauthorized
 * decision changes nothing (409 STALE_REVIEW); reopening removes credit but keeps history; submitter and reviewer are
 * different people.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T22")
class ReviewWorkflowIntegrationTest {

    private static final UUID DEVELOPER = UUID.fromString("10000000-0000-0000-0000-000000000005");
    private static final UUID QA_REVIEWER = UUID.fromString("10000000-0000-0000-0000-000000000006");

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AccountTokenService accountTokens;

    private UUID orgId;
    private String ownerToken;
    private Person dev;
    private Person qa;
    private Person qa2;
    private UUID devMembership;
    private UUID qaMembership;
    private UUID qa2Membership;
    private String devToken;
    private String qaToken;
    private String qa2Token;
    private String projectId;
    private String task;

    @BeforeEach
    void setUp() throws Exception {
        TestDatabase.clean(jdbc);
        Person owner = person("owner");
        String slug = "review-" + UUID.randomUUID().toString().substring(0, 6);
        orgId = UUID.fromString(tree(mockMvc.perform(auth(post("/v1/organizations"), owner.token()).contentType("application/json")
                        .content("{\"name\":\"" + slug + "\",\"slug\":\"" + slug + "\",\"timezone\":\"UTC\","
                                + "\"calendar\":{\"workdays\":[1,2,3,4,5],\"holidays\":[]}}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText());
        ownerToken = switchTo(owner.token(), orgId);
        dev = person("dev");
        qa = person("qa");
        qa2 = person("qa2");
        devMembership = member(dev.id(), "DEVELOPER", DEVELOPER);
        qaMembership = member(qa.id(), "QA_REVIEWER", QA_REVIEWER);
        qa2Membership = member(qa2.id(), "QA_REVIEWER", QA_REVIEWER);
        devToken = switchTo(dev.token(), orgId);
        qaToken = switchTo(qa.token(), orgId);
        qa2Token = switchTo(qa2.token(), orgId);
        Map<String, Object> project = new LinkedHashMap<>();
        project.put("name", "Checkout");
        project.put("key", "CHK");
        project.put("mode", "STRUCTURED");
        project.put("member_membership_ids", List.of(devMembership.toString(), qaMembership.toString(), qa2Membership.toString()));
        projectId = tree(mockMvc.perform(auth(post("/v1/organizations/{o}/projects", orgId), ownerToken)
                        .contentType("application/json").content(json(project)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
        // Owner rule 2026-11-25: approvers are chosen per project (PROJECT-scoped grant), not by the QA template alone.
        approver(qaMembership);
        approver(qa2Membership);
        task = plannedTask("Payment form", 20);
    }

    private void approver(UUID membership) {
        jdbc.update("""
                INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, scope_id, granted_by)
                VALUES (?, ?, ?, '10000000-0000-0000-0000-000000000009', 'PROJECT', ?, ?)
                """, UUID.randomUUID(), orgId, membership, UUID.fromString(projectId), dev.id());
    }

    @Test
    void anOrganizationWideReviewerWhoWasNotChosenForTheProjectCannotApprove() throws Exception {
        // A third QA holds task.review through the organization template but is not one of this project's approvers.
        Person qa3 = person("qa3");
        UUID qa3Membership = member(qa3.id(), "QA_REVIEWER", QA_REVIEWER);
        jdbc.update("INSERT INTO project_members (project_id, org_id, membership_id, added_by) VALUES (?, ?, ?, ?)",
                projectId, orgId, qa3Membership, dev.id());
        String qa3Token = switchTo(qa3.token(), orgId);
        String open = plannedTaskWithoutReviewer("Refund form", 10);
        start(devToken, open);
        submit(devToken, open, "pr-9").andExpect(status().isOk());

        review(qa3Token, open, 1, "APPROVED", null).andExpect(status().isForbidden());
        assertThat(state(open)).isEqualTo("IN_REVIEW");
        // Any chosen approver decides when the task names no reviewer.
        review(qa2Token, open, 1, "APPROVED", null).andExpect(status().isOk()).andExpect(jsonPath("$.state").value("DONE"));
        assertThat(jdbc.queryForObject("SELECT evidence_ref FROM work_item_reviews WHERE work_item_id = ?", String.class, open))
                .startsWith("submission:");
        assertThat(count("SELECT count(*) FROM developer_notifications WHERE user_id = ? AND category = 'REVIEW_APPROVED'",
                dev.id().toString())).isEqualTo(1);
    }

    @Test
    void aDeveloperWhoIsAlsoAnApproverCannotApproveTheirOwnTask() throws Exception {
        approver(devMembership);
        String own = plannedTaskWithoutReviewer("Own work", 10);
        start(devToken, own);
        submit(devToken, own, "pr-own").andExpect(status().isOk());
        review(devToken, own, 1, "APPROVED", null).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("SELF_REVIEW_NOT_ALLOWED"));
        assertThat(state(own)).isEqualTo("IN_REVIEW");
    }

    @AfterEach
    void tearDown() {
        TestDatabase.clean(jdbc);
    }

    /* ================================================================== T22 happy path */

    @Test
    void requiredReviewBlocksDoneUntilTheReviewerApprovesTheSubmittedRevision() throws Exception {
        start(devToken, task).andExpect(status().isOk()).andExpect(jsonPath("$.state").value("IN_PROGRESS"));
        submit(devToken, task, "https://github.example/acme/pull/12").andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("IN_REVIEW"))
                .andExpect(jsonPath("$.submitted_revision").value(1));

        // The submitter can never approve their own work; neither can someone without task.review.
        review(devToken, task, 1, "APPROVED", null).andExpect(status().isForbidden());
        assertThat(state(task)).isEqualTo("IN_REVIEW");

        review(qaToken, task, 1, "APPROVED", null).andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("DONE"))
                .andExpect(jsonPath("$.accepted_revision").value(1));
        assertThat(count("SELECT count(*) FROM work_item_reviews WHERE work_item_id = ? AND decision = 'APPROVED'", task)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'WorkItemCompleted'")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'ReviewRequested'")).isEqualTo(1);

        JsonNode history = tree(mockMvc.perform(auth(get("/v1/work-items/{id}/reviews", task), devToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(history.path("submissions").get(0).path("evidence").get(0).path("ref").asText())
                .isEqualTo("https://github.example/acme/pull/12");
        assertThat(history.path("reviews").get(0).path("decision").asText()).isEqualTo("APPROVED");
    }

    @Test
    void changesRequestedNeedsAReasonAndReturnsTheWorkWithANewRevision() throws Exception {
        start(devToken, task);
        submit(devToken, task, "pr-1");
        review(qaToken, task, 1, "CHANGES_REQUESTED", null).andExpect(status().isBadRequest());
        review(qaToken, task, 1, "CHANGES_REQUESTED", "  ").andExpect(status().isBadRequest());
        assertThat(state(task)).isEqualTo("IN_REVIEW");

        review(qaToken, task, 1, "CHANGES_REQUESTED", "Card errors are not shown").andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.revision").value(2));

        // The old revision can no longer be approved.
        review(qaToken, task, 1, "APPROVED", null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_REVIEW"));
        assertThat(state(task)).isEqualTo("IN_PROGRESS");

        submit(devToken, task, "pr-1-fixed").andExpect(jsonPath("$.submitted_revision").value(2));
        review(qaToken, task, 2, "APPROVED", null).andExpect(status().isOk()).andExpect(jsonPath("$.accepted_revision").value(2));
    }

    @Test
    void approvingARevisionThatWasReplacedMeanwhileChangesNothing() throws Exception {
        start(devToken, task);
        submit(devToken, task, "first");
        // The reviewer opens revision 1; meanwhile the developer submits an improved revision 2.
        submit(devToken, task, "second").andExpect(status().isOk()).andExpect(jsonPath("$.submitted_revision").value(2));

        review(qaToken, task, 1, "APPROVED", null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_REVIEW"));
        assertThat(state(task)).isEqualTo("IN_REVIEW");
        assertThat(count("SELECT count(*) FROM work_item_reviews")).isZero();
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'WorkItemCompleted'")).isZero();
        assertThat(jdbc.queryForObject("SELECT status FROM work_item_submissions WHERE work_item_id = ? AND revision = 1",
                String.class, task)).isEqualTo("SUPERSEDED");
    }

    @Test
    void aReviewerRemovedBeforeDecidingCannotDecide() throws Exception {
        start(devToken, task);
        submit(devToken, task, "pr");
        long version = version(task);
        mockMvc.perform(auth(put("/v1/work-items/{id}/assignment", task), ownerToken).contentType("application/json")
                        .content(json(Map.of("primary_assignee_membership_id", devMembership.toString(),
                                "reviewer_membership_id", qa2Membership.toString(), "expected_version", version))))
                .andExpect(status().isOk());

        review(qaToken, task, 1, "APPROVED", null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_REVIEW"));
        assertThat(state(task)).isEqualTo("IN_REVIEW");
        review(qa2Token, task, 1, "APPROVED", null).andExpect(status().isOk());
    }

    @Test
    void aMissingRequiredCheckBlocksApprovalUntilItIsSatisfied() throws Exception {
        mockMvc.perform(auth(put("/v1/work-items/{id}/checks", task), ownerToken).contentType("application/json")
                        .content(json(Map.of("checks", List.of(Map.of("key", "security-scan", "label", "Security scan passed")),
                                "expected_version", version(task)))))
                .andExpect(status().isOk());
        start(devToken, task);
        submit(devToken, task, "pr");

        review(qaToken, task, 1, "APPROVED", null).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MISSING_CHECK"));
        assertThat(state(task)).isEqualTo("IN_REVIEW");

        // The submitter cannot tick their own checks.
        mockMvc.perform(auth(post("/v1/work-items/{id}/checks/{key}", task, "security-scan"), devToken)
                        .contentType("application/json").content(json(Map.of("satisfied", true))))
                .andExpect(status().isForbidden());
        mockMvc.perform(auth(post("/v1/work-items/{id}/checks/{key}", task, "security-scan"), qaToken)
                        .contentType("application/json").content(json(Map.of("satisfied", true))))
                .andExpect(status().isOk());
        review(qaToken, task, 1, "APPROVED", null).andExpect(status().isOk());
    }

    @Test
    void twoSimultaneousDecisionsOnTheSameRevisionResultInOne() throws Exception {
        start(devToken, task);
        submit(devToken, task, "pr");
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch go = new CountDownLatch(1);
        try {
            List<Callable<Integer>> calls = List.of(
                    () -> { go.await(); return review(qaToken, task, 1, "APPROVED", null).andReturn().getResponse().getStatus(); },
                    () -> { go.await(); return review(qaToken, task, 1, "CHANGES_REQUESTED", "Needs tests").andReturn().getResponse().getStatus(); });
            List<Future<Integer>> futures = new ArrayList<>();
            for (Callable<Integer> call : calls) futures.add(pool.submit(call));
            go.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> f : futures) statuses.add(f.get());
            assertThat(statuses).containsExactlyInAnyOrder(200, 409);
        } finally {
            pool.shutdownNow();
        }
        assertThat(count("SELECT count(*) FROM work_item_reviews WHERE work_item_id = ?", task)).isEqualTo(1);
    }

    /* ================================================================== reopen */

    @Test
    void reopeningRemovesCreditButKeepsTheHistory() throws Exception {
        start(devToken, task);
        submit(devToken, task, "pr");
        review(qaToken, task, 1, "APPROVED", null);

        reopen(devToken, task, "I found a bug").andExpect(status().isForbidden());
        reopen(ownerToken, task, " ").andExpect(status().isBadRequest());
        reopen(ownerToken, task, "Refunds fail in production").andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.accepted_revision").isEmpty())
                .andExpect(jsonPath("$.revision").value(2));

        assertThat(count("SELECT count(*) FROM work_item_reviews WHERE work_item_id = ?", task)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM work_item_submissions WHERE work_item_id = ?", task)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT superseded_revision FROM work_item_reopen_events WHERE work_item_id = ?",
                Integer.class, task)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'WorkItemReopened'")).isEqualTo(1);
        // Open work cannot be reopened.
        reopen(ownerToken, task, "again").andExpect(status().isConflict());
    }

    /* ================================================================== no required review */

    @Test
    void withoutRequiredReviewSubmittingCompletesOnlyWhenChecksPass() throws Exception {
        String quick = plannedTask("Copy fix", 5);
        mockMvc.perform(auth(patch("/v1/work-items/{id}", quick), ownerToken).contentType("application/json")
                        .content(json(Map.of("review_required", false, "expected_version", version(quick)))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.review_required").value(false));
        mockMvc.perform(auth(put("/v1/work-items/{id}/checks", quick), ownerToken).contentType("application/json")
                        .content(json(Map.of("checks", List.of(Map.of("key", "copy-review", "label", "Copy reviewed")),
                                "expected_version", version(quick)))))
                .andExpect(status().isOk());
        start(devToken, quick);
        submit(devToken, quick, "commit-abc").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MISSING_CHECK"));
        assertThat(state(quick)).isEqualTo("IN_PROGRESS");

        mockMvc.perform(auth(post("/v1/work-items/{id}/checks/{key}", quick, "copy-review"), ownerToken)
                .contentType("application/json").content(json(Map.of("satisfied", true)))).andExpect(status().isOk());
        submit(devToken, quick, "commit-abc").andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("DONE"))
                .andExpect(jsonPath("$.accepted_revision").value(1));
    }

    /* ================================================================== guards */

    @Test
    void onlyTheAssigneeWorksOnTheTaskAndOutsidersSeeNothing() throws Exception {
        start(qaToken, task).andExpect(status().isForbidden());
        start(devToken, task).andExpect(status().isOk());
        start(devToken, task).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVALID_TRANSITION"));
        submit(qaToken, task, "not mine").andExpect(status().isForbidden());

        Person outsider = person("outsider");
        member(outsider.id(), "DEVELOPER", DEVELOPER);
        String outsiderToken = switchTo(outsider.token(), orgId);
        submit(outsiderToken, task, "pr").andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/work-items/{id}/reviews", task), outsiderToken)).andExpect(status().isNotFound());
    }

    @Test
    void theLegacyStatusEndpointCannotSkipReview() throws Exception {
        mockMvc.perform(auth(patch("/v1/developer/tasks/{id}/status", task), devToken).contentType("application/json")
                        .content(json(Map.of("state", "DONE"))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("INVALID_TRANSITION"));
        mockMvc.perform(auth(patch("/v1/developer/tasks/{id}/status", task), devToken).contentType("application/json")
                        .content(json(Map.of("state", "IN_PROGRESS"))))
                .andExpect(status().isOk());
        mockMvc.perform(auth(patch("/v1/developer/tasks/{id}/status", task), devToken).contentType("application/json")
                        .content(json(Map.of("state", "IN_REVIEW"))))
                .andExpect(status().isOk());
        assertThat(state(task)).isEqualTo("IN_REVIEW");
        assertThat(count("SELECT count(*) FROM work_item_submissions WHERE work_item_id = ?", task)).isEqualTo(1);
    }

    /* ================================================================== my work */

    @Test
    void myWorkListsOnlyMyOwnItemsBlockersAndFeedback() throws Exception {
        start(devToken, task);
        submit(devToken, task, "pr");
        review(qaToken, task, 1, "CHANGES_REQUESTED", "Add input validation");
        mockMvc.perform(auth(post("/v1/work-items/{id}/blockers", task), devToken).contentType("application/json")
                .content(json(Map.of("reason", "Waiting for design", "severity", "NORMAL")))).andExpect(status().isCreated());

        mockMvc.perform(auth(get("/v1/me/work-items"), devToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(task))
                .andExpect(jsonPath("$[0].blocked").value(true));
        mockMvc.perform(auth(get("/v1/me/review-feedback"), devToken))
                .andExpect(jsonPath("$[0].decision").value("CHANGES_REQUESTED"))
                .andExpect(jsonPath("$[0].reason").value("Add input validation"));
        mockMvc.perform(auth(get("/v1/me/blockers"), devToken))
                .andExpect(jsonPath("$[0].reason").value("Waiting for design"));

        // The reviewer and other members see none of the developer's work in their own lists.
        mockMvc.perform(auth(get("/v1/me/work-items"), qaToken)).andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(auth(get("/v1/me/review-feedback"), qaToken)).andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(auth(get("/v1/me/blockers"), qa2Token)).andExpect(jsonPath("$.length()").value(0));

        // Removed from the project: the old work disappears from the list.
        jdbc.update("DELETE FROM project_members WHERE membership_id = ?", devMembership);
        Integer deniedBefore = jdbc.queryForObject("SELECT count(*) FROM security_evidence WHERE event_type = 'ACCESS_DENIED'", Integer.class);
        mockMvc.perform(auth(get("/v1/me/work-items"), devToken)).andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(auth(get("/v1/me/blockers"), devToken)).andExpect(jsonPath("$.length()").value(0));
        // Filtering one's own lists is not an access attempt: no denial evidence is written for it.
        assertThat(jdbc.queryForObject("SELECT count(*) FROM security_evidence WHERE event_type = 'ACCESS_DENIED'", Integer.class))
                .isEqualTo(deniedBefore);
    }

    /* ================================================================== helpers */

    private ResultActions start(String token, String item) throws Exception {
        return mockMvc.perform(auth(post("/v1/work-items/{id}/start", item), token).contentType("application/json")
                .content(json(Map.of("expected_version", version(item)))));
    }

    private ResultActions submit(String token, String item, String evidenceRef) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("expected_version", version(item));
        body.put("note", "Ready for review");
        body.put("evidence", List.of(Map.of("type", "LINK", "ref", evidenceRef, "label", "Pull request")));
        return mockMvc.perform(auth(post("/v1/work-items/{id}/submissions", item), token)
                .contentType("application/json").content(json(body)));
    }

    private ResultActions review(String token, String item, int revision, String decision, String reason) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("submitted_revision", revision);
        body.put("decision", decision);
        if (reason != null) body.put("reason", reason);
        return mockMvc.perform(auth(post("/v1/work-items/{id}/reviews", item), token)
                .contentType("application/json").content(json(body)));
    }

    private ResultActions reopen(String token, String item, String reason) throws Exception {
        return mockMvc.perform(auth(post("/v1/work-items/{id}/reopen", item), token).contentType("application/json")
                .content(json(Map.of("reason", reason, "expected_version", version(item)))));
    }

    /** A task in the approved scope, assigned to the developer, with no designated reviewer (any project approver). */
    private String plannedTaskWithoutReviewer(String title, int weight) throws Exception {
        String id = plannedTask(title, weight);
        jdbc.update("UPDATE work_items SET reviewer_id = NULL WHERE id = ?", id);
        return id;
    }

    /** A task in the approved scope, assigned to the developer with the QA reviewer. */
    private String plannedTask(String title, int weight) throws Exception {
        String id = tree(mockMvc.perform(auth(post("/v1/projects/{p}/work-items", projectId), ownerToken)
                        .contentType("application/json").content(json(Map.of("type", "TASK", "title", title))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
        mockMvc.perform(auth(patch("/v1/work-items/{id}", id), ownerToken).contentType("application/json")
                .content(json(Map.of("criteria", "Behaves as specified", "expected_version", 0)))).andExpect(status().isOk());
        mockMvc.perform(auth(put("/v1/work-items/{id}/assignment", id), ownerToken).contentType("application/json")
                .content(json(Map.of("primary_assignee_membership_id", devMembership.toString(),
                        "reviewer_membership_id", qaMembership.toString(), "expected_version", 1))))
                .andExpect(status().isOk());
        String base = jdbc.queryForList("SELECT id::text FROM scope_versions WHERE project_id = ? AND status = 'ACTIVE'",
                String.class, projectId).stream().findFirst().orElse(null);
        Map<String, Object> draft = new LinkedHashMap<>();
        draft.put("unit", "POINTS");
        draft.put("reason", "Plan " + title);
        draft.put("base_version_id", base);
        draft.put("changes", List.of(Map.of("op", "ADD", "work_item_id", id, "weight", weight)));
        String version = tree(mockMvc.perform(auth(post("/v1/projects/{p}/scope-versions", projectId), ownerToken)
                        .contentType("application/json").content(json(draft)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
        mockMvc.perform(auth(post("/v1/scope-versions/{id}/approve", version), ownerToken).contentType("application/json")
                .content(json(Map.of("expected_version", 0)))).andExpect(status().isOk());
        return id;
    }

    private long version(String item) {
        Long value = jdbc.queryForObject("SELECT version FROM work_items WHERE id = ?", Long.class, item);
        return value == null ? 0 : value;
    }

    private String state(String item) {
        return jdbc.queryForObject("SELECT state FROM work_items WHERE id = ?", String.class, item);
    }

    private UUID member(UUID userId, String template, UUID templateRoleId) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, ?)", id, orgId, userId, template);
        jdbc.update("INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by) VALUES (?, ?, ?, ?, 'ORG', ?)",
                UUID.randomUUID(), orgId, id, templateRoleId, userId);
        return id;
    }

    private Person person(String name) throws Exception {
        String email = name + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        TestAccounts.Account account = TestAccounts.signUpVerifyAndLogin(
                mockMvc, jdbc, accountTokens, objectMapper, email, "Correct-Horse-Battery-1!");
        return new Person(account.id(), account.accessToken());
    }

    private String switchTo(String token, UUID org) throws Exception {
        return tree(mockMvc.perform(auth(post("/v1/me/organizations/{org}/switch", org), token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("access_token").asText();
    }

    private int count(String sql, Object... args) {
        Integer value = jdbc.queryForObject(sql, Integer.class, args);
        return value == null ? 0 : value;
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private JsonNode tree(String body) {
        try {
            return objectMapper.readTree(body);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder builder, String token) {
        return builder.header("Authorization", "Bearer " + token);
    }

    private record Person(UUID id, String token) {}
}
