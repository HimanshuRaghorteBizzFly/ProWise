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
 * Task 3.2: scope versions. Drafts list add/remove/cancel/split/reweight changes against the current baseline;
 * approval atomically activates one baseline, supersedes the old one, records reason, author and approver, and never
 * changes earlier versions. One unit per version; zero/negative weights refused; cancelling keeps the denominator.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T25")
@Tag("AS-08")
class ScopeVersionIntegrationTest {

    private static final UUID DEVELOPER = UUID.fromString("10000000-0000-0000-0000-000000000005");

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AccountTokenService accountTokens;

    private UUID orgId;
    private String ownerToken;
    private UUID ownerId;
    private Person dev;
    private UUID devMembership;
    private String devToken;
    private String projectId;

    @BeforeEach
    void setUp() throws Exception {
        TestDatabase.clean(jdbc);
        Person owner = person("owner");
        String slug = "scope-" + UUID.randomUUID().toString().substring(0, 6);
        orgId = UUID.fromString(tree(mockMvc.perform(auth(post("/v1/organizations"), owner.token()).contentType("application/json")
                        .content("{\"name\":\"" + slug + "\",\"slug\":\"" + slug + "\",\"timezone\":\"UTC\","
                                + "\"calendar\":{\"workdays\":[1,2,3,4,5],\"holidays\":[]}}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText());
        ownerId = owner.id();
        ownerToken = switchTo(owner.token(), orgId);
        dev = person("dev");
        devMembership = member(dev.id(), "DEVELOPER", DEVELOPER);
        devToken = switchTo(dev.token(), orgId);
        Map<String, Object> project = new LinkedHashMap<>();
        project.put("name", "Billing");
        project.put("key", "BIL");
        project.put("mode", "STRUCTURED");
        project.put("member_membership_ids", List.of(devMembership.toString()));
        projectId = tree(mockMvc.perform(auth(post("/v1/organizations/{o}/projects", orgId), ownerToken)
                        .contentType("application/json").content(json(project)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
    }

    @AfterEach
    void tearDown() {
        TestDatabase.clean(jdbc);
    }

    /* ================================================================== T25 + AS-08 */

    @Test
    void approvingAnAdditionCreatesANewBaselineAndKeepsThePreviousOne() throws Exception {
        String a = readyTask("A");
        String b = readyTask("B");
        String c = readyTask("C");
        JsonNode v1 = approve(draft(null, "POINTS", "Initial plan", add(a, 20), add(b, 30), add(c, 50)), 0)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.version_no").value(1))
                .andExpect(jsonPath("$.approver.user_id").value(ownerId.toString()))
                .andReturn().getResponse().getContentAsString().transform(this::tree);
        String v1Id = v1.path("id").asText();
        assertThat(jdbc.queryForObject("SELECT active_baseline_id::text FROM projects WHERE id = ?", String.class, projectId))
                .isEqualTo(v1Id);
        assertThat(jdbc.queryForObject("SELECT plan_status FROM work_items WHERE id = ?", String.class, a)).isEqualTo("ACTIVE");
        assertThat(jdbc.queryForObject("SELECT weight FROM work_items WHERE id = ?", Integer.class, c)).isEqualTo(50);

        // 50 of 100 accepted, then +25 is proposed: the preview explains the effect before approval.
        jdbc.update("UPDATE work_items SET state = 'DONE' WHERE id IN (?, ?)", a, b);
        String d = readyTask("D");
        String v2 = draft(v1Id, "POINTS", "Customer asked for exports", add(d, 25));
        mockMvc.perform(auth(get("/v1/scope-versions/{id}", v2), ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.diff.added[0].work_item_id").value(d))
                .andExpect(jsonPath("$.effect.before.numerator").value(50))
                .andExpect(jsonPath("$.effect.before.denominator").value(100))
                .andExpect(jsonPath("$.effect.before.percent").value(50))
                .andExpect(jsonPath("$.effect.after.denominator").value(125))
                .andExpect(jsonPath("$.effect.after.percent").value(40))
                .andExpect(jsonPath("$.effect.summary").value("50/100 = 50% becomes 50/125 = 40%"));

        approve(v2, 0).andExpect(status().isOk()).andExpect(jsonPath("$.version_no").value(2))
                .andExpect(jsonPath("$.base_version_id").value(v1Id));

        assertThat(statusOf(v1Id)).isEqualTo("SUPERSEDED");
        assertThat(count("SELECT count(*) FROM scope_versions WHERE project_id = ? AND status = 'ACTIVE'", projectId)).isEqualTo(1);
        mockMvc.perform(auth(get("/v1/scope-versions/{id}", v1Id), devToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.leaves.length()").value(3))
                .andExpect(jsonPath("$.reason").value("Initial plan"));
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'scope.approved' AND reason = ?",
                "Customer asked for exports")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'ScopeChanged'")).isEqualTo(2);
    }

    @Test
    void approvedRemovalRetiresTheItemButEarlierVersionsStillListIt() throws Exception {
        String a = readyTask("A");
        String b = readyTask("B");
        String v1 = approved(draft(null, "POINTS", "Plan", add(a, 10), add(b, 10)));
        String v2 = draft(v1, "POINTS", "B is no longer needed", Map.of("op", "REMOVE", "work_item_id", b));
        mockMvc.perform(auth(get("/v1/scope-versions/{id}", v2), ownerToken))
                .andExpect(jsonPath("$.diff.removed[0].work_item_id").value(b));
        approve(v2, 0).andExpect(status().isOk());

        assertThat(jdbc.queryForObject("SELECT plan_status FROM work_items WHERE id = ?", String.class, b)).isEqualTo("RETIRED");
        assertThat(count("SELECT count(*) FROM scope_leaves WHERE scope_version_id = ?::uuid", v1)).isEqualTo(2);
        assertThat(count("SELECT count(*) FROM scope_leaves WHERE scope_version_id = ?::uuid", v2)).isEqualTo(1);
    }

    @Test
    void cancellingAloneKeepsTheDenominatorAndDoesNotRaiseThePercentage() throws Exception {
        String a = readyTask("A");
        String b = readyTask("B");
        String v1 = approved(draft(null, "POINTS", "Plan", add(a, 50), add(b, 50)));
        jdbc.update("UPDATE work_items SET state = 'DONE' WHERE id = ?", a);

        String v2 = draft(v1, "POINTS", "B cancelled by customer", Map.of("op", "CANCEL", "work_item_id", b));
        mockMvc.perform(auth(get("/v1/scope-versions/{id}", v2), ownerToken))
                .andExpect(jsonPath("$.effect.before.percent").value(50))
                .andExpect(jsonPath("$.effect.after.percent").value(50))
                .andExpect(jsonPath("$.effect.after.denominator").value(100));
        approve(v2, 0).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT state FROM work_items WHERE id = ?", String.class, b)).isEqualTo("CANCELLED");

        // Cancelling accepted work is refused: it would silently drop credit.
        draftRequest(v2, "POINTS", "drop A", Map.of("op", "CANCEL", "work_item_id", a))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("INVALID_SCOPE_CHANGE"));
    }

    @Test
    void splittingAnApprovedLeafCreatesProposedPartsThatCountOnlyAfterApproval() throws Exception {
        String a = readyTask("A");
        String v1 = approved(draft(null, "POINTS", "Plan", add(a, 30)));

        Map<String, Object> split = new LinkedHashMap<>();
        split.put("op", "SPLIT");
        split.put("work_item_id", a);
        split.put("into", List.of(Map.of("title", "A part 1", "weight", 10), Map.of("title", "A part 2", "weight", 20)));
        String v2 = draft(v1, "POINTS", "A is too large", split);
        List<String> parts = jdbc.queryForList("SELECT id FROM work_items WHERE parent_id = ? ORDER BY key", String.class, a);
        assertThat(parts).hasSize(2);
        assertThat(jdbc.queryForList("SELECT plan_status FROM work_items WHERE parent_id = ?", String.class, a))
                .containsOnly("DRAFT");
        assertThat(jdbc.queryForObject("SELECT primary_assignee_id FROM work_items WHERE id = ?", String.class, parts.get(0)))
                .isEqualTo(dev.id().toString());

        approve(v2, 0).andExpect(status().isOk());
        assertThat(jdbc.queryForList("SELECT work_item_id FROM scope_leaves WHERE scope_version_id = ?::uuid", String.class, v2))
                .containsExactlyInAnyOrderElementsOf(parts);
        assertThat(jdbc.queryForObject("SELECT weight FROM work_items WHERE id = ?", Integer.class, a)).isNull();
    }

    /* ================================================================== concurrency + staleness */

    @Test
    void twoConcurrentApprovalsOnTheSameBaseActivateOnlyOne() throws Exception {
        String a = readyTask("A");
        String b = readyTask("B");
        String c = readyTask("C");
        String v1 = approved(draft(null, "POINTS", "Plan", add(a, 10)));
        String left = draft(v1, "POINTS", "Add B", add(b, 10));
        String right = draft(v1, "POINTS", "Add C", add(c, 10));

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Callable<Integer>> calls = new ArrayList<>();
            for (String draft : List.of(left, right)) {
                calls.add(() -> {
                    start.await();
                    return approve(draft, 0).andReturn().getResponse().getStatus();
                });
            }
            List<Future<Integer>> futures = new ArrayList<>();
            for (Callable<Integer> call : calls) futures.add(pool.submit(call));
            start.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> f : futures) statuses.add(f.get());
            assertThat(statuses).containsExactlyInAnyOrder(200, 409);
        } finally {
            pool.shutdownNow();
        }
        assertThat(count("SELECT count(*) FROM scope_versions WHERE project_id = ? AND status = 'ACTIVE'", projectId)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM scope_versions WHERE project_id = ? AND status = 'SUPERSEDED'", projectId)).isEqualTo(1);
    }

    @Test
    void draftsAgainstAnOutdatedBaselineAreRejected() throws Exception {
        String a = readyTask("A");
        String b = readyTask("B");
        draftRequest(null, "POINTS", "Plan", add(a, 10)).andExpect(status().isCreated());
        String v1 = approved(draft(null, "POINTS", "Plan again", add(a, 10)));
        approved(draft(v1, "POINTS", "Add B", add(b, 5)));
        // A client that still thinks v1 is current.
        draftRequest(v1, "POINTS", "Late change", Map.of("op", "REWEIGHT", "work_item_id", a, "weight", 15))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        // Discarded and stale drafts cannot be approved.
        String old = jdbc.queryForObject("SELECT id::text FROM scope_versions WHERE status = 'DRAFT' AND reason = 'Plan'", String.class);
        approve(old, 0).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
    }

    /* ================================================================== validation */

    @Test
    void rejectsMixedUnitsBadWeightsAndWorkThatIsNotReady() throws Exception {
        String a = readyTask("A");
        String v1 = approved(draft(null, "POINTS", "Plan", add(a, 10)));
        String b = readyTask("B");

        draftRequest(v1, "EFFORT", "Switch unit", add(b, 4)).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("UNIT_MISMATCH"));
        draftRequest(v1, "POINTS", "Zero", add(b, 0)).andExpect(status().isBadRequest());
        draftRequest(v1, "POINTS", "Negative", add(b, -3)).andExpect(status().isBadRequest());
        draftRequest(v1, "POINTS", "", add(b, 3)).andExpect(status().isBadRequest());
        draftRequest(v1, "POINTS", "Twice", add(b, 3), add(b, 4)).andExpect(status().isUnprocessableEntity());
        draftRequest(v1, "POINTS", "Not in scope", Map.of("op", "REMOVE", "work_item_id", b))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("INVALID_SCOPE_CHANGE"));

        // Work without a primary assignee or acceptance criteria is not ready to be measured.
        String bare = createTask("Bare");
        draftRequest(v1, "POINTS", "Bare", add(bare, 3)).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("LEAF_NOT_READY"));
        // A parent with children is not a leaf; parent and child together would count twice.
        String parent = readyTask("Parent");
        createChild(parent, "Child");
        draftRequest(v1, "POINTS", "Parent", add(parent, 3)).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("LEAF_NOT_READY"));

        // Equal weight means every leaf weighs 1.
        String c = readyTask("C");
        draftRequest(null, "EQUAL", "Equal", add(c, 2)).andExpect(status().isConflict()); // base is v1, not none
        assertThat(count("SELECT count(*) FROM scope_versions WHERE status = 'ACTIVE'")).isEqualTo(1);
    }

    @Test
    void approvedVersionsAndTheirLeavesAreImmutableInTheDatabase() throws Exception {
        String a = readyTask("A");
        String v1 = approved(draft(null, "POINTS", "Plan", add(a, 10)));
        assertThat(sqlFails("UPDATE scope_versions SET reason = 'rewritten' WHERE id = ?::uuid", v1)).isTrue();
        assertThat(sqlFails("UPDATE scope_leaves SET weight = 99 WHERE scope_version_id = ?::uuid", v1)).isTrue();
        assertThat(sqlFails("DELETE FROM scope_leaves WHERE scope_version_id = ?::uuid", v1)).isTrue();
        assertThat(sqlFails("DELETE FROM scope_versions WHERE id = ?::uuid", v1)).isTrue();
    }

    /* ================================================================== permissions */

    @Test
    void developersReadScopeButCannotDraftOrApproveAndOutsidersSeeNothing() throws Exception {
        String a = readyTask("A");
        String draft = draft(null, "POINTS", "Plan", add(a, 10));

        mockMvc.perform(auth(post("/v1/projects/{p}/scope-versions", projectId), devToken).contentType("application/json")
                        .content(json(Map.of("unit", "POINTS", "reason", "mine", "changes", List.of(add(a, 99))))))
                .andExpect(status().isForbidden());
        mockMvc.perform(auth(post("/v1/scope-versions/{id}/approve", draft), devToken).contentType("application/json")
                        .content(json(Map.of("expected_version", 0))))
                .andExpect(status().isForbidden());
        mockMvc.perform(auth(get("/v1/scope-versions/{id}", draft), devToken)).andExpect(status().isOk());
        assertThat(statusOf(draft)).isEqualTo("DRAFT");

        Person outsider = person("outsider");
        member(outsider.id(), "DEVELOPER", DEVELOPER);
        String outsiderToken = switchTo(outsider.token(), orgId);
        mockMvc.perform(auth(get("/v1/scope-versions/{id}", draft), outsiderToken)).andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/projects/{p}/scope-versions", projectId), outsiderToken)).andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/scope-versions/{id}", UUID.randomUUID()), ownerToken)).andExpect(status().isNotFound());
    }

    @Test
    void discardingADraftRetiresItsProposedSplitParts() throws Exception {
        String a = readyTask("A");
        String v1 = approved(draft(null, "POINTS", "Plan", add(a, 30)));
        Map<String, Object> split = Map.of("op", "SPLIT", "work_item_id", a,
                "into", List.of(Map.of("title", "P1", "weight", 10), Map.of("title", "P2", "weight", 20)));
        String v2 = draft(v1, "POINTS", "Split", split);
        mockMvc.perform(auth(post("/v1/scope-versions/{id}/discard", v2), ownerToken).contentType("application/json")
                        .content(json(Map.of("expected_version", 0))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DISCARDED"));
        assertThat(jdbc.queryForList("SELECT plan_status FROM work_items WHERE parent_id = ?", String.class, a))
                .containsOnly("RETIRED");
        approve(v2, 0).andExpect(status().isConflict());
    }

    /* ================================================================== helpers */

    private static Map<String, Object> add(String itemId, int weight) {
        return Map.of("op", "ADD", "work_item_id", itemId, "weight", weight);
    }

    @SafeVarargs
    private String draft(String base, String unit, String reason, Map<String, Object>... changes) throws Exception {
        return tree(draftRequest(base, unit, reason, changes).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).path("id").asText();
    }

    @SafeVarargs
    private ResultActions draftRequest(String base, String unit, String reason, Map<String, Object>... changes) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("unit", unit);
        body.put("reason", reason);
        body.put("base_version_id", base);
        body.put("changes", List.of(changes));
        return mockMvc.perform(auth(post("/v1/projects/{p}/scope-versions", projectId), ownerToken)
                .contentType("application/json").content(json(body)));
    }

    private ResultActions approve(String versionId, long expectedVersion) throws Exception {
        return mockMvc.perform(auth(post("/v1/scope-versions/{id}/approve", versionId), ownerToken)
                .contentType("application/json").content(json(Map.of("expected_version", expectedVersion))));
    }

    private String approved(String draftId) throws Exception {
        approve(draftId, 0).andExpect(status().isOk());
        return draftId;
    }

    private String createTask(String title) throws Exception {
        return tree(mockMvc.perform(auth(post("/v1/projects/{p}/work-items", projectId), ownerToken)
                        .contentType("application/json").content(json(Map.of("type", "TASK", "title", title))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
    }

    private String createChild(String parent, String title) throws Exception {
        return tree(mockMvc.perform(auth(post("/v1/projects/{p}/work-items", projectId), ownerToken)
                        .contentType("application/json").content(json(Map.of("type", "SUBTASK", "title", title, "parent_id", parent))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
    }

    /** A draft task with acceptance criteria and the developer as primary assignee. */
    private String readyTask(String title) throws Exception {
        String id = createTask(title);
        mockMvc.perform(auth(patch("/v1/work-items/{id}", id), ownerToken).contentType("application/json")
                .content(json(Map.of("criteria", "Works as described", "expected_version", 0)))).andExpect(status().isOk());
        mockMvc.perform(auth(put("/v1/work-items/{id}/assignment", id), ownerToken).contentType("application/json")
                .content(json(Map.of("primary_assignee_membership_id", devMembership.toString(), "expected_version", 1))))
                .andExpect(status().isOk());
        return id;
    }

    private String statusOf(String versionId) {
        return jdbc.queryForObject("SELECT status FROM scope_versions WHERE id = ?::uuid", String.class, versionId);
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

    private boolean sqlFails(String sql, Object... args) {
        try {
            jdbc.update(sql, args);
            return false;
        } catch (RuntimeException expected) {
            return true;
        }
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
