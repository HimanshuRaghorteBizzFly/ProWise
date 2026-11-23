package com.prowise.work;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.identity.AccountTokenService;
import com.prowise.testsupport.TestAccounts;

/**
 * Task 3.5: progress from accepted work in the active baseline, snapshotted on every material change and never
 * rewritten. Fixtures from docs/domain-rules.md: 50%, then 40% after +25, then 16% after reopening; not measurable for
 * an empty scope; a reopened prerequisite suspends dependent credit; Git activity never changes progress.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T27")
@Tag("T29")
@Tag("AS-03")
@Tag("AS-08")
class ProgressSnapshotIntegrationTest {

    private static final UUID DEVELOPER = UUID.fromString("10000000-0000-0000-0000-000000000005");
    private static final UUID QA_REVIEWER = UUID.fromString("10000000-0000-0000-0000-000000000006");

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AccountTokenService accountTokens;

    private UUID orgId;
    private String ownerToken;
    private UUID devMembership;
    private UUID qaMembership;
    private String devToken;
    private String qaToken;
    private String projectId;

    @BeforeEach
    void setUp() throws Exception {
        TestDatabase.clean(jdbc);
        Person owner = person("owner");
        String slug = "snap-" + UUID.randomUUID().toString().substring(0, 6);
        orgId = UUID.fromString(tree(mockMvc.perform(auth(post("/v1/organizations"), owner.token()).contentType("application/json")
                        .content("{\"name\":\"" + slug + "\",\"slug\":\"" + slug + "\",\"timezone\":\"UTC\","
                                + "\"calendar\":{\"workdays\":[1,2,3,4,5],\"holidays\":[]}}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText());
        ownerToken = switchTo(owner.token(), orgId);
        Person dev = person("dev");
        Person qa = person("qa");
        devMembership = member(dev.id(), "DEVELOPER", DEVELOPER);
        qaMembership = member(qa.id(), "QA_REVIEWER", QA_REVIEWER);
        devToken = switchTo(dev.token(), orgId);
        qaToken = switchTo(qa.token(), orgId);
        Map<String, Object> project = new LinkedHashMap<>();
        project.put("name", "Portal");
        project.put("key", "POR");
        project.put("mode", "STRUCTURED");
        project.put("member_membership_ids", List.of(devMembership.toString(), qaMembership.toString()));
        projectId = tree(mockMvc.perform(auth(post("/v1/organizations/{o}/projects", orgId), ownerToken)
                        .contentType("application/json").content(json(project)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
    }

    @AfterEach
    void tearDown() {
        TestDatabase.clean(jdbc);
    }

    @Test
    void emptyScopeIsNotMeasurable() throws Exception {
        mockMvc.perform(auth(get("/v1/projects/{p}/structured-progress", projectId), devToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.percent").isEmpty())
                .andExpect(jsonPath("$.label").value("Not measurable"))
                .andExpect(jsonPath("$.snapshots.length()").value(0));
    }

    @Test
    void as03_acceptedLeavesGiveFiftyThenHundredAndInReviewWorkEarnsNothing() throws Exception {
        String a = readyTask("A");
        String b = readyTask("B");
        String c = readyTask("C");
        String v1 = approveScope(null, add(a, 20), add(b, 30), add(c, 50));
        accept(a);
        accept(b);
        startAndSubmit(c); // In Review: no credit yet

        mockMvc.perform(auth(get("/v1/projects/{p}/structured-progress", projectId), devToken))
                .andExpect(jsonPath("$.percent").value(50))
                .andExpect(jsonPath("$.explanation").value("2 of 3 leaves accepted, 50/100 points, baseline v1"))
                .andExpect(jsonPath("$.baseline.id").value(v1));
        // A merged pull request or green build changes nothing (rule 9).
        jdbc.update("""
                INSERT INTO github_activity (id, org_id, project_id, repository_name, event_type, actor, title, status,
                    linked_task_key)
                SELECT ?, ?, ?, 'acme/portal', 'PULL_REQUEST', 'dev', 'Merge C', 'MERGED', key FROM work_items WHERE id = ?
                """, "gh-" + UUID.randomUUID().toString().substring(0, 20), orgId, projectId, c);
        mockMvc.perform(auth(get("/v1/projects/{p}/structured-progress", projectId), devToken))
                .andExpect(jsonPath("$.percent").value(50));

        review(c, "APPROVED");
        mockMvc.perform(auth(get("/v1/projects/{p}/structured-progress", projectId), devToken))
                .andExpect(jsonPath("$.percent").value(100));
        assertThat(jdbc.queryForList("""
                SELECT display_value FROM progress_snapshots WHERE project_id = ? ORDER BY taken_at, id
                """, Integer.class, projectId)).containsExactly(0, 20, 50, 100);
        assertThat(jdbc.queryForObject("SELECT last_progress_percent FROM projects WHERE id = ?", Integer.class, projectId))
                .isEqualTo(100);
    }

    @Test
    void as08_approvingMoreScopeAddsAFortyPercentSnapshotAndKeepsTheOldFiftyOnItsBaseline() throws Exception {
        String a = readyTask("A");
        String b = readyTask("B");
        String c = readyTask("C");
        String v1 = approveScope(null, add(a, 20), add(b, 30), add(c, 50));
        accept(a);
        accept(b);
        String d = readyTask("D");
        String v2 = approveScope(v1, add(d, 25));

        JsonNode view = tree(mockMvc.perform(auth(get("/v1/projects/{p}/structured-progress", projectId), ownerToken))
                .andExpect(jsonPath("$.percent").value(40))
                .andReturn().getResponse().getContentAsString());
        JsonNode snapshots = view.path("snapshots");
        JsonNode fifty = snapshots.get(snapshots.size() - 2);
        JsonNode forty = snapshots.get(snapshots.size() - 1);
        assertThat(fifty.path("percent").asInt()).isEqualTo(50);
        assertThat(fifty.path("baseline_id").asText()).isEqualTo(v1);
        assertThat(fifty.path("baseline_version").asInt()).isEqualTo(1);
        assertThat(forty.path("percent").asInt()).isEqualTo(40);
        assertThat(forty.path("baseline_id").asText()).isEqualTo(v2);
        assertThat(forty.path("cause").asText()).isEqualTo("SCOPE_APPROVED");

        // Fixture 3: reopening the 30 leaf -> 20/125 = 16%.
        reopen(b, "Accessibility issues");
        mockMvc.perform(auth(get("/v1/projects/{p}/structured-progress", projectId), ownerToken))
                .andExpect(jsonPath("$.percent").value(16))
                .andExpect(jsonPath("$.numerator").value(20))
                .andExpect(jsonPath("$.denominator").value(125));
        // Snapshots are never rewritten.
        assertThat(sqlFails("UPDATE progress_snapshots SET display_value = 99")).isTrue();
        assertThat(sqlFails("DELETE FROM progress_snapshots")).isTrue();
    }

    @Test
    void aReopenedPrerequisiteSuspendsTheCreditOfDependentWork() throws Exception {
        String a = readyTask("A");
        String b = readyTask("B");
        approveScope(null, add(a, 50), add(b, 50));
        mockMvc.perform(auth(post("/v1/work-items/{id}/dependencies", b), ownerToken).contentType("application/json")
                .content(json(Map.of("predecessor_id", a)))).andExpect(status().isCreated());
        accept(a);
        accept(b);
        mockMvc.perform(auth(get("/v1/projects/{p}/structured-progress", projectId), devToken))
                .andExpect(jsonPath("$.percent").value(100));

        reopen(a, "Data migration bug");
        // B keeps its Done state but earns nothing while its prerequisite is not accepted.
        assertThat(jdbc.queryForObject("SELECT state FROM work_items WHERE id = ?", String.class, b)).isEqualTo("DONE");
        mockMvc.perform(auth(get("/v1/projects/{p}/structured-progress", projectId), devToken))
                .andExpect(jsonPath("$.percent").value(0))
                .andExpect(jsonPath("$.leaves[1].suspended").value(true));

        startAndSubmit(a);
        review(a, "APPROVED");
        mockMvc.perform(auth(get("/v1/projects/{p}/structured-progress", projectId), devToken))
                .andExpect(jsonPath("$.percent").value(100));
    }

    @Test
    void outsidersCannotReadProgress() throws Exception {
        Person outsider = person("outsider");
        member(outsider.id(), "DEVELOPER", DEVELOPER);
        String outsiderToken = switchTo(outsider.token(), orgId);
        mockMvc.perform(auth(get("/v1/projects/{p}/structured-progress", projectId), outsiderToken))
                .andExpect(status().isNotFound());
    }

    /* ================================================================== helpers */

    private static Map<String, Object> add(String itemId, int weight) {
        return Map.of("op", "ADD", "work_item_id", itemId, "weight", weight);
    }

    @SafeVarargs
    private String approveScope(String base, Map<String, Object>... changes) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("unit", "POINTS");
        body.put("reason", "Plan " + UUID.randomUUID());
        body.put("base_version_id", base);
        body.put("changes", List.of(changes));
        String id = tree(mockMvc.perform(auth(post("/v1/projects/{p}/scope-versions", projectId), ownerToken)
                        .contentType("application/json").content(json(body)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
        mockMvc.perform(auth(post("/v1/scope-versions/{id}/approve", id), ownerToken).contentType("application/json")
                .content(json(Map.of("expected_version", 0)))).andExpect(status().isOk());
        return id;
    }

    private void accept(String item) throws Exception {
        startAndSubmit(item);
        review(item, "APPROVED");
    }

    private void startAndSubmit(String item) throws Exception {
        if ("TODO".equals(jdbc.queryForObject("SELECT state FROM work_items WHERE id = ?", String.class, item))) {
            mockMvc.perform(auth(post("/v1/work-items/{id}/start", item), devToken).contentType("application/json")
                    .content(json(Map.of("expected_version", version(item))))).andExpect(status().isOk());
        }
        mockMvc.perform(auth(post("/v1/work-items/{id}/submissions", item), devToken).contentType("application/json")
                .content(json(Map.of("expected_version", version(item),
                        "evidence", List.of(Map.of("type", "PULL_REQUEST", "ref", "pr-" + item)))))).andExpect(status().isOk());
    }

    private void review(String item, String decision) throws Exception {
        Integer revision = jdbc.queryForObject("SELECT submitted_revision FROM work_items WHERE id = ?", Integer.class, item);
        mockMvc.perform(auth(post("/v1/work-items/{id}/reviews", item), qaToken).contentType("application/json")
                .content(json(Map.of("submitted_revision", revision, "decision", decision)))).andExpect(status().isOk());
    }

    private void reopen(String item, String reason) throws Exception {
        mockMvc.perform(auth(post("/v1/work-items/{id}/reopen", item), ownerToken).contentType("application/json")
                .content(json(Map.of("reason", reason, "expected_version", version(item))))).andExpect(status().isOk());
    }

    private String readyTask(String title) throws Exception {
        String id = tree(mockMvc.perform(auth(post("/v1/projects/{p}/work-items", projectId), ownerToken)
                        .contentType("application/json").content(json(Map.of("type", "TASK", "title", title))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
        mockMvc.perform(auth(patch("/v1/work-items/{id}", id), ownerToken).contentType("application/json")
                .content(json(Map.of("criteria", "Meets the agreed behaviour", "expected_version", 0)))).andExpect(status().isOk());
        mockMvc.perform(auth(put("/v1/work-items/{id}/assignment", id), ownerToken).contentType("application/json")
                .content(json(Map.of("primary_assignee_membership_id", devMembership.toString(),
                        "reviewer_membership_id", qaMembership.toString(), "expected_version", 1))))
                .andExpect(status().isOk());
        return id;
    }

    private long version(String item) {
        Long value = jdbc.queryForObject("SELECT version FROM work_items WHERE id = ?", Long.class, item);
        return value == null ? 0 : value;
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
