package com.prowise.work;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
 * Task 3.4: Finish-to-Start dependencies inside one project (no self-links, duplicates or cycles, also under
 * concurrent requests), a start guard while a prerequisite is unfinished, successors flagged (not reversed) when an
 * accepted prerequisite reopens, removal of a predecessor only after its links are treated, and blockers as a separate
 * flag with reason, owner and severity.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T21")
@Tag("T24")
class DependencyBlockerIntegrationTest {

    private static final UUID DEVELOPER = UUID.fromString("10000000-0000-0000-0000-000000000005");

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AccountTokenService accountTokens;

    private UUID orgId;
    private String ownerToken;
    private UUID devMembership;
    private UUID dev2Membership;
    private String devToken;
    private String dev2Token;
    private String projectId;

    @BeforeEach
    void setUp() throws Exception {
        TestDatabase.clean(jdbc);
        Person owner = person("owner");
        String slug = "deps-" + UUID.randomUUID().toString().substring(0, 6);
        orgId = UUID.fromString(tree(mockMvc.perform(auth(post("/v1/organizations"), owner.token()).contentType("application/json")
                        .content("{\"name\":\"" + slug + "\",\"slug\":\"" + slug + "\",\"timezone\":\"UTC\","
                                + "\"calendar\":{\"workdays\":[1,2,3,4,5],\"holidays\":[]}}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText());
        ownerToken = switchTo(owner.token(), orgId);
        Person dev = person("dev");
        Person dev2 = person("dev2");
        devMembership = member(dev.id(), "DEVELOPER", DEVELOPER);
        dev2Membership = member(dev2.id(), "DEVELOPER", DEVELOPER);
        devToken = switchTo(dev.token(), orgId);
        dev2Token = switchTo(dev2.token(), orgId);
        projectId = project("Platform", "PLT", List.of(devMembership, dev2Membership));
    }

    @AfterEach
    void tearDown() {
        TestDatabase.clean(jdbc);
    }

    /* ================================================================== T24 */

    @Test
    void rejectsSelfLinksDuplicatesCyclesAndOtherProjects() throws Exception {
        String a = task(projectId, "A", devMembership);
        String b = task(projectId, "B", devMembership);
        String c = task(projectId, "C", devMembership);

        link(a, a).andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("INVALID_DEPENDENCY"));
        link(a, b).andExpect(status().isCreated())
                .andExpect(jsonPath("$.dependency.predecessor_id").value(a))
                .andExpect(jsonPath("$.dependency.successor_id").value(b));
        link(a, b).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_DEPENDENCY"));
        link(b, c).andExpect(status().isCreated());
        link(c, a).andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("DEPENDENCY_CYCLE"));

        String other = project("Other", "OTH", List.of(devMembership));
        String foreign = task(other, "Foreign", devMembership);
        link(foreign, a).andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("INVALID_DEPENDENCY"));
        assertThat(count("SELECT count(*) FROM work_item_dependencies")).isEqualTo(2);
        // The database refuses a cross-project or self link even if the service were bypassed.
        assertThat(sqlFails("INSERT INTO work_item_dependencies (id, org_id, project_id, predecessor_id, successor_id, created_by) "
                + "SELECT gen_random_uuid(), org_id, project_id, id, id, created_by FROM work_items WHERE id = ?", a)).isTrue();

        // Changing A surfaces everything downstream.
        mockMvc.perform(auth(get("/v1/work-items/{id}/dependencies", a), devToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocks.length()").value(1))
                .andExpect(jsonPath("$.affected.length()").value(2));
    }

    @Test
    void twoSimultaneousReverseLinksCannotFormALoop() throws Exception {
        String a = task(projectId, "A", devMembership);
        String b = task(projectId, "B", devMembership);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch go = new CountDownLatch(1);
        try {
            List<Callable<Integer>> calls = List.of(
                    () -> { go.await(); return link(a, b).andReturn().getResponse().getStatus(); },
                    () -> { go.await(); return link(b, a).andReturn().getResponse().getStatus(); });
            List<Future<Integer>> futures = new ArrayList<>();
            for (Callable<Integer> call : calls) futures.add(pool.submit(call));
            go.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> f : futures) statuses.add(f.get());
            assertThat(statuses).containsExactlyInAnyOrder(201, 422);
        } finally {
            pool.shutdownNow();
        }
        assertThat(count("SELECT count(*) FROM work_item_dependencies")).isEqualTo(1);
    }

    @Test
    void aSuccessorCannotStartWhileItsPrerequisiteIsUnfinished() throws Exception {
        String a = task(projectId, "A", devMembership);
        String b = task(projectId, "B", devMembership);
        link(a, b).andExpect(status().isCreated());

        start(devToken, b).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("BLOCKED_BY_DEPENDENCY"));
        assertThat(state(b)).isEqualTo("TODO");
        jdbc.update("UPDATE work_items SET state = 'DONE', accepted_revision = 1 WHERE id = ?", a);
        start(devToken, b).andExpect(status().isOk());
    }

    @Test
    void reopeningAnAcceptedPrerequisiteFlagsSuccessorsWithoutReversingThem() throws Exception {
        String a = task(projectId, "A", devMembership);
        String b = task(projectId, "B", devMembership);
        String c = task(projectId, "C", devMembership);
        link(a, b);
        link(b, c);
        jdbc.update("UPDATE work_items SET state = 'DONE', accepted_revision = 1 WHERE id IN (?, ?)", a, b);
        jdbc.update("UPDATE work_items SET state = 'IN_PROGRESS' WHERE id = ?", c);

        mockMvc.perform(auth(post("/v1/work-items/{id}/reopen", a), ownerToken).contentType("application/json")
                        .content(json(Map.of("reason", "Regression found", "expected_version", version(a)))))
                .andExpect(status().isOk());

        assertThat(state(b)).isEqualTo("DONE");
        assertThat(state(c)).isEqualTo("IN_PROGRESS");
        assertThat(jdbc.queryForObject("SELECT dependency_flag FROM work_items WHERE id = ?", String.class, b))
                .contains("reopened");
        assertThat(jdbc.queryForObject("SELECT dependency_flag FROM work_items WHERE id = ?", String.class, c)).isNotNull();
        mockMvc.perform(auth(get("/v1/work-items/{id}", b), devToken))
                .andExpect(jsonPath("$.dependency_flag").isNotEmpty());
    }

    @Test
    void aPredecessorWithLinksIsRemovedOnlyAfterTheLinksAreTreated() throws Exception {
        String a = draftTask("Draft A");
        String b = draftTask("Draft B");
        String linkId = tree(link(a, b).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString())
                .path("dependency").path("id").asText();

        mockMvc.perform(auth(post("/v1/work-items/{id}/retire", a), ownerToken).contentType("application/json")
                        .content(json(Map.of("reason", "Not needed", "expected_version", version(a)))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DEPENDENCIES_EXIST"));

        mockMvc.perform(auth(delete("/v1/dependencies/{id}", linkId), devToken)).andExpect(status().isForbidden());
        mockMvc.perform(auth(delete("/v1/dependencies/{id}", linkId), ownerToken)).andExpect(status().isNoContent());
        mockMvc.perform(auth(post("/v1/work-items/{id}/retire", a), ownerToken).contentType("application/json")
                        .content(json(Map.of("reason", "Not needed", "expected_version", version(a)))))
                .andExpect(status().isOk());
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'dependency.removed'")).isEqualTo(1);
    }

    /* ================================================================== T21 blockers */

    @Test
    void blockedIsASeparateFlagWithReasonOwnerAndSeverity() throws Exception {
        String a = task(projectId, "A", devMembership);
        start(devToken, a);

        blocker(devToken, a, null, "CRITICAL", null).andExpect(status().isBadRequest());
        blocker(devToken, a, "Waiting for API keys", "URGENT", null).andExpect(status().isBadRequest());
        String blockerId = tree(blocker(devToken, a, "Waiting for API keys", "CRITICAL", dev2Membership)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.severity").value("CRITICAL"))
                .andExpect(jsonPath("$.owner.user_id").isNotEmpty())
                .andExpect(jsonPath("$.resolved").value(false))
                .andReturn().getResponse().getContentAsString()).path("id").asText();

        assertThat(state(a)).isEqualTo("IN_PROGRESS");
        assertThat(jdbc.queryForObject("SELECT is_blocked FROM work_items WHERE id = ?", Boolean.class, a)).isTrue();
        mockMvc.perform(auth(get("/v1/projects/{p}/work-item-blockers", projectId), ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(blockerId))
                .andExpect(jsonPath("$[0].age_hours").isNumber());

        mockMvc.perform(auth(post("/v1/blockers/{id}/resolve", blockerId), devToken).contentType("application/json")
                        .content(json(Map.of("resolution", "Keys received"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.resolved").value(true));
        assertThat(state(a)).isEqualTo("IN_PROGRESS");
        assertThat(jdbc.queryForObject("SELECT is_blocked FROM work_items WHERE id = ?", Boolean.class, a)).isFalse();
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'BlockerRaised'")).isEqualTo(1);
    }

    @Test
    void blockerOwnersMustWorkOnTheProjectAndOnlyThoseInvolvedReportOrResolve() throws Exception {
        String a = task(projectId, "A", devMembership);
        Person outsider = person("outsider");
        UUID outsiderMembership = member(outsider.id(), "DEVELOPER", DEVELOPER);
        String outsiderToken = switchTo(outsider.token(), orgId);

        blocker(devToken, a, "Blocked", "NORMAL", outsiderMembership).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("NOT_PROJECT_MEMBER"));
        // Someone else's task: the other developer reads it but cannot raise its blockers.
        blocker(dev2Token, a, "Not mine", "NORMAL", null).andExpect(status().isForbidden());
        blocker(outsiderToken, a, "Outsider", "NORMAL", null).andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/work-items/{id}/blockers", a), outsiderToken)).andExpect(status().isNotFound());

        String blockerId = tree(blocker(devToken, a, "Blocked", "NORMAL", null).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).path("id").asText();
        mockMvc.perform(auth(post("/v1/blockers/{id}/resolve", blockerId), outsiderToken).contentType("application/json")
                .content(json(Map.of("resolution", "x")))).andExpect(status().isNotFound());
        // Developers cannot add links between tasks.
        String b = task(projectId, "B", devMembership);
        mockMvc.perform(auth(post("/v1/work-items/{id}/dependencies", b), devToken).contentType("application/json")
                .content(json(Map.of("predecessor_id", a)))).andExpect(status().isForbidden());
    }

    @Test
    void theLegacyDeveloperBlockerEndpointUsesTheSameRules() throws Exception {
        String a = task(projectId, "A", devMembership);
        start(devToken, a);
        mockMvc.perform(auth(post("/v1/developer/tasks/{id}/blockers", a), devToken).contentType("application/json")
                        .content(json(Map.of("reason", "Sandbox down", "severity", "HIGH"))))
                .andExpect(status().isCreated());
        assertThat(state(a)).isEqualTo("IN_PROGRESS");
        assertThat(jdbc.queryForObject("SELECT severity FROM task_blockers WHERE task_id = ?", String.class, a)).isEqualTo("NORMAL");
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'blocker.raised'")).isEqualTo(1);
    }

    /* ================================================================== helpers */

    private ResultActions link(String predecessor, String successor) throws Exception {
        return mockMvc.perform(auth(post("/v1/work-items/{id}/dependencies", successor), ownerToken)
                .contentType("application/json").content(json(Map.of("predecessor_id", predecessor))));
    }

    private ResultActions blocker(String token, String item, String reason, String severity, UUID owner) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        if (reason != null) body.put("reason", reason);
        body.put("severity", severity);
        if (owner != null) body.put("owner_membership_id", owner.toString());
        return mockMvc.perform(auth(post("/v1/work-items/{id}/blockers", item), token)
                .contentType("application/json").content(json(body)));
    }

    private ResultActions start(String token, String item) throws Exception {
        return mockMvc.perform(auth(post("/v1/work-items/{id}/start", item), token).contentType("application/json")
                .content(json(Map.of("expected_version", version(item)))));
    }

    private String draftTask(String title) throws Exception {
        return tree(mockMvc.perform(auth(post("/v1/projects/{p}/work-items", projectId), ownerToken)
                        .contentType("application/json").content(json(Map.of("type", "TASK", "title", title))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
    }

    /** A task with criteria and a primary assignee (draft; enough for workflow and dependencies). */
    private String task(String project, String title, UUID assignee) throws Exception {
        String id = tree(mockMvc.perform(auth(post("/v1/projects/{p}/work-items", project), ownerToken)
                        .contentType("application/json").content(json(Map.of("type", "TASK", "title", title))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
        mockMvc.perform(auth(patch("/v1/work-items/{id}", id), ownerToken).contentType("application/json")
                .content(json(Map.of("criteria", "Done when it works", "expected_version", 0)))).andExpect(status().isOk());
        mockMvc.perform(auth(put("/v1/work-items/{id}/assignment", id), ownerToken).contentType("application/json")
                .content(json(Map.of("primary_assignee_membership_id", assignee.toString(), "expected_version", 1))))
                .andExpect(status().isOk());
        return id;
    }

    private String project(String name, String key, List<UUID> members) throws Exception {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("name", name);
        fields.put("key", key);
        fields.put("mode", "STRUCTURED");
        fields.put("member_membership_ids", members.stream().map(UUID::toString).toList());
        return tree(mockMvc.perform(auth(post("/v1/organizations/{o}/projects", orgId), ownerToken)
                        .contentType("application/json").content(json(fields)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
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
