package com.prowise.work;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.identity.AccountTokenService;
import com.prowise.testsupport.TestAccounts;

/**
 * Task 3.1: breakdown and assignment. Direct tasks or milestone/deliverable hierarchies up to five levels including
 * the project; invalid nesting, cross-project parents, loops and excessive depth are rejected; one primary assignee,
 * an optional reviewer who is never the assignee, optional collaborators; reassigning keeps history; retiring planned
 * (approved) work needs a scope change; splitting an approved leaf proposes a scope change.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T12")
@Tag("T19")
@Tag("T20")
class WorkBreakdownIntegrationTest {

    private static final UUID DEVELOPER = UUID.fromString("10000000-0000-0000-0000-000000000005");
    private static final UUID PROJECT_MANAGER = UUID.fromString("10000000-0000-0000-0000-000000000003");

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AccountTokenService accountTokens;

    private Org org;
    private Person dev;
    private Person reviewer;
    private Person outsider;
    private UUID devMembership;
    private UUID reviewerMembership;
    private UUID outsiderMembership;
    private String devToken;
    private String outsiderToken;
    private String projectId;

    @BeforeEach
    void setUp() throws Exception {
        TestDatabase.clean(jdbc);
        org = organization("alpha");
        dev = person("dev");
        reviewer = person("reviewer");
        outsider = person("outsider");
        devMembership = member(org.id(), dev.id(), "DEVELOPER", DEVELOPER);
        reviewerMembership = member(org.id(), reviewer.id(), "DEVELOPER", DEVELOPER);
        outsiderMembership = member(org.id(), outsider.id(), "DEVELOPER", DEVELOPER);
        projectId = project(org, "CRM", "STRUCTURED", List.of(devMembership, reviewerMembership));
        devToken = switchTo(dev.token(), org.id());
        outsiderToken = switchTo(outsider.token(), org.id());
    }

    @AfterEach
    void tearDown() {
        TestDatabase.clean(jdbc);
    }

    /* ================================================================== T12 hierarchy */

    @Test
    void createsDirectTaskMilestoneTaskAndDeliverableSubtasksWithStableKeys() throws Exception {
        JsonNode direct = create(projectId, "TASK", null, "Login form").andExpect(status().isCreated())
                .andExpect(jsonPath("$.key").value("CRM-1"))
                .andExpect(jsonPath("$.state").value("TODO"))
                .andExpect(jsonPath("$.plan_status").value("DRAFT"))
                .andExpect(jsonPath("$.weight").isEmpty())
                .andExpect(jsonPath("$.depth").value(2))
                .andExpect(jsonPath("$.version").value(0))
                .andReturn().getResponse().getContentAsString().transform(this::tree);

        String milestone = id(create(projectId, "MILESTONE", null, "Release 1"));
        JsonNode underMilestone = tree(create(projectId, "TASK", milestone, "Payments").andExpect(status().isCreated())
                .andExpect(jsonPath("$.depth").value(3)).andReturn().getResponse().getContentAsString());
        String deliverable = id(create(projectId, "DELIVERABLE", milestone, "Billing module"));
        String task = id(create(projectId, "TASK", deliverable, "Invoices"));
        create(projectId, "SUBTASK", task, "PDF export").andExpect(status().isCreated())
                .andExpect(jsonPath("$.depth").value(5));
        create(projectId, "SUBTASK", task, "CSV export").andExpect(status().isCreated());

        assertThat(direct.path("key").asText()).isEqualTo("CRM-1");
        assertThat(underMilestone.path("parent_id").asText()).isEqualTo(milestone);
        List<String> keys = jdbc.queryForList("SELECT key FROM work_items WHERE project_id = ? ORDER BY key", String.class, projectId);
        assertThat(keys).hasSize(7).doesNotHaveDuplicates();
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'work_item.created'")).isEqualTo(7);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'WorkItemCreated'")).isEqualTo(7);

        mockMvc.perform(auth(get("/v1/projects/{p}/work-items", projectId), devToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(7));
    }

    @Test
    void rejectsInvalidNestingCrossProjectParentsAndExcessiveDepth() throws Exception {
        String task = id(create(projectId, "TASK", null, "Task"));
        String milestone = id(create(projectId, "MILESTONE", null, "Milestone"));

        create(projectId, "SUBTASK", null, "Orphan subtask").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_HIERARCHY"));
        create(projectId, "MILESTONE", task, "Milestone under task").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_HIERARCHY"));
        create(projectId, "DELIVERABLE", task, "Deliverable under task").andExpect(status().isUnprocessableEntity());
        create(projectId, "MILESTONE", milestone, "Milestone under milestone").andExpect(status().isUnprocessableEntity());
        create(projectId, "BUG", null, "Unknown type").andExpect(status().isBadRequest());

        // A parent from another project (same organization) or another organization looks the same: invalid parent.
        String otherProject = project(org, "OPS", "STRUCTURED", List.of(devMembership));
        String foreignParent = id(create(otherProject, "MILESTONE", null, "Other milestone"));
        create(projectId, "TASK", foreignParent, "Cross project").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_PARENT"));
        create(projectId, "TASK", "no-such-item", "Unknown parent").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_PARENT"));

        // Depth: project(1) > task(2) > subtask(3) > subtask(4) > subtask(5) is allowed, a sixth level is not.
        String s3 = id(create(projectId, "SUBTASK", task, "Level 3"));
        String s4 = id(create(projectId, "SUBTASK", s3, "Level 4"));
        String s5 = id(create(projectId, "SUBTASK", s4, "Level 5"));
        create(projectId, "SUBTASK", s5, "Level 6").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MAX_DEPTH_EXCEEDED"));

        // The database refuses a cross-project parent even if the service were bypassed.
        assertThat(sqlFails("UPDATE work_items SET parent_id = ? WHERE id = ?", foreignParent, task)).isTrue();
    }

    @Test
    void reparentingRejectsLoopsAndDepthOfTheMovedSubtree() throws Exception {
        String task = id(create(projectId, "TASK", null, "Task"));
        String s1 = id(create(projectId, "SUBTASK", task, "S1"));
        String s2 = id(create(projectId, "SUBTASK", s1, "S2"));

        // Moving S1 under its own child would create a loop.
        edit(s1, Map.of("parent_id", s2, "expected_version", 0)).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("WORK_ITEM_CYCLE"));
        edit(s1, Map.of("parent_id", s1, "expected_version", 0)).andExpect(status().isUnprocessableEntity());

        // Moving the S1 subtree (height 2) under S3 at depth 4 would put S2 at depth 6.
        String other = id(create(projectId, "TASK", null, "Other"));
        String s3 = id(create(projectId, "SUBTASK", other, "S3"));
        String s4 = id(create(projectId, "SUBTASK", s3, "S4"));
        edit(s1, Map.of("parent_id", s4, "expected_version", 0)).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MAX_DEPTH_EXCEEDED"));

        // A valid move works and keeps the subtree.
        edit(s1, Map.of("parent_id", s3, "expected_version", 0)).andExpect(status().isOk())
                .andExpect(jsonPath("$.parent_id").value(s3))
                .andExpect(jsonPath("$.version").value(1));
        assertThat(jdbc.queryForObject("SELECT parent_id FROM work_items WHERE id = ?", String.class, s2)).isEqualTo(s1);
    }

    @Test
    void concurrentCreatesGetDistinctKeys() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(4);
        try {
            List<Callable<Integer>> calls = new ArrayList<>();
            for (int i = 0; i < 8; i++) {
                String title = "Parallel " + i;
                calls.add(() -> create(projectId, "TASK", null, title).andReturn().getResponse().getStatus());
            }
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> f : pool.invokeAll(calls)) statuses.add(f.get());
            assertThat(statuses).containsOnly(201);
        } finally {
            pool.shutdownNow();
        }
        assertThat(jdbc.queryForList("SELECT key FROM work_items WHERE project_id = ?", String.class, projectId))
                .hasSize(8).doesNotHaveDuplicates();
    }

    /* ================================================================== T20 assignment */

    @Test
    void assignsOnePrimaryAReviewerAndCollaboratorsAndKeepsReassignmentHistory() throws Exception {
        String task = id(create(projectId, "TASK", null, "Checkout"));

        assign(task, devMembership, reviewerMembership, List.of(), 0, "Initial plan").andExpect(status().isOk())
                .andExpect(jsonPath("$.primary_assignee.user_id").value(dev.id().toString()))
                .andExpect(jsonPath("$.reviewer.user_id").value(reviewer.id().toString()))
                .andExpect(jsonPath("$.version").value(1));

        // Reassign primary to the reviewer is refused while they are still the reviewer.
        assign(task, reviewerMembership, reviewerMembership, List.of(), 1, "Swap").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("REVIEWER_IS_ASSIGNEE"));

        // Real reassignment: reviewer becomes primary, no reviewer, dev becomes collaborator.
        assign(task, reviewerMembership, null, List.of(devMembership), 1, "Dev is on leave").andExpect(status().isOk())
                .andExpect(jsonPath("$.primary_assignee.user_id").value(reviewer.id().toString()))
                .andExpect(jsonPath("$.collaborators[0].user_id").value(dev.id().toString()));

        JsonNode history = tree(mockMvc.perform(auth(get("/v1/work-items/{id}/assignment-history", task), org.token()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        List<String> primaryChanges = new ArrayList<>();
        for (JsonNode row : history) {
            if ("PRIMARY".equals(row.path("assignment_role").asText())) {
                primaryChanges.add(row.path("previous_user_id").asText("") + ">" + row.path("new_user_id").asText(""));
            }
        }
        assertThat(primaryChanges).containsExactly(">" + dev.id(), dev.id() + ">" + reviewer.id());
        assertThat(sqlFails("DELETE FROM work_item_assignment_history")).isTrue();
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'work_item.assigned'")).isEqualTo(2);
    }

    @Test
    void assigneesMustBeActiveMembersOfTheProject() throws Exception {
        String task = id(create(projectId, "TASK", null, "Task"));

        assign(task, outsiderMembership, null, List.of(), 0, null).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("NOT_PROJECT_MEMBER"));
        assign(task, UUID.randomUUID(), null, List.of(), 0, null).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("NOT_PROJECT_MEMBER"));
        assign(task, devMembership, null, List.of(outsiderMembership), 0, null).andExpect(status().isUnprocessableEntity());

        jdbc.update("UPDATE memberships SET status = 'DISABLED' WHERE id = ?", devMembership);
        assign(task, devMembership, null, List.of(), 0, null).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("NOT_PROJECT_MEMBER"));
        assertThat(count("SELECT count(*) FROM work_item_assignment_history")).isZero();
    }

    /* ================================================================== permissions */

    @Test
    void developerCannotPlanOrAssignAndOutsidersSeeNothing() throws Exception {
        String task = id(create(projectId, "TASK", null, "Task"));
        assign(task, devMembership, null, List.of(), 0, null).andExpect(status().isOk());

        // The developer reads the project's work but cannot create, assign or retire.
        mockMvc.perform(auth(get("/v1/work-items/{id}", task), devToken)).andExpect(status().isOk());
        mockMvc.perform(auth(post("/v1/projects/{p}/work-items", projectId), devToken)
                        .contentType("application/json").content(body("TASK", null, "Mine")))
                .andExpect(status().isForbidden());
        mockMvc.perform(auth(put("/v1/work-items/{id}/assignment", task), devToken).contentType("application/json")
                        .content(json(Map.of("primary_assignee_membership_id", devMembership.toString(), "expected_version", 1))))
                .andExpect(status().isForbidden());
        mockMvc.perform(auth(post("/v1/work-items/{id}/retire", task), devToken).contentType("application/json")
                        .content(json(Map.of("reason", "not needed", "expected_version", 1))))
                .andExpect(status().isForbidden());

        // The assignee may edit the description of their own work, but not the title, criteria or due date.
        mockMvc.perform(auth(patch("/v1/work-items/{id}", task), devToken).contentType("application/json")
                        .content(json(Map.of("description", "Implementation notes", "expected_version", 1))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.description").value("Implementation notes"));
        mockMvc.perform(auth(patch("/v1/work-items/{id}", task), devToken).contentType("application/json")
                        .content(json(Map.of("title", "Renamed", "expected_version", 2))))
                .andExpect(status().isForbidden());
        mockMvc.perform(auth(patch("/v1/work-items/{id}", task), devToken).contentType("application/json")
                        .content(json(Map.of("criteria", "Easier criteria", "expected_version", 2))))
                .andExpect(status().isForbidden());

        // A member of the organization who is not on the project: 404, same as an unknown id.
        mockMvc.perform(auth(get("/v1/work-items/{id}", task), outsiderToken)).andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/projects/{p}/work-items", projectId), outsiderToken)).andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/work-items/{id}", "unknown-item"), outsiderToken))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // Another organization: 404 for the owner of that organization too.
        Org other = organization("beta");
        mockMvc.perform(auth(get("/v1/work-items/{id}", task), other.token())).andExpect(status().isNotFound());
        mockMvc.perform(auth(patch("/v1/work-items/{id}", task), other.token()).contentType("application/json")
                        .content(json(Map.of("title", "Hijack", "expected_version", 2))))
                .andExpect(status().isNotFound());
    }

    @Test
    void projectManagerPlansAndStaleEditsAreRejected() throws Exception {
        Person pm = person("pm");
        UUID pmMembership = member(org.id(), pm.id(), "PROJECT_MANAGER", PROJECT_MANAGER);
        jdbc.update("UPDATE projects SET project_manager_membership_id = ? WHERE id = ?", pmMembership, projectId);
        String pmToken = switchTo(pm.token(), org.id());

        String task = id(mockMvc.perform(auth(post("/v1/projects/{p}/work-items", projectId), pmToken)
                .contentType("application/json").content(body("TASK", null, "PM task"))).andExpect(status().isCreated()));

        mockMvc.perform(auth(patch("/v1/work-items/{id}", task), pmToken).contentType("application/json")
                        .content(json(Map.of("title", "PM task v2", "criteria", "Loads in 2s", "due_on", "2027-01-15",
                                "criticality", "CRITICAL", "expected_version", 0))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("PM task v2"))
                .andExpect(jsonPath("$.criteria_version").value(2))
                .andExpect(jsonPath("$.due_on").value("2027-01-15"))
                .andExpect(jsonPath("$.criticality").value("CRITICAL"));

        mockMvc.perform(auth(patch("/v1/work-items/{id}", task), pmToken).contentType("application/json")
                        .content(json(Map.of("title", "Stale", "expected_version", 0))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        mockMvc.perform(auth(patch("/v1/work-items/{id}", task), pmToken).contentType("application/json")
                        .content(json(Map.of("title", "No version"))))
                .andExpect(status().isBadRequest());
        // Weights are set only by scope approval (task 3.2).
        mockMvc.perform(auth(patch("/v1/work-items/{id}", task), pmToken).contentType("application/json")
                        .content(json(Map.of("weight", 5, "expected_version", 1))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SCOPE_CHANGE_REQUIRED"));
        assertThat(jdbc.queryForObject("SELECT title FROM work_items WHERE id = ?", String.class, task)).isEqualTo("PM task v2");
    }

    @Test
    void individualProjectsAndArchivedProjectsTakeNoWorkItems() throws Exception {
        String solo = project(org, "SOLO", "INDIVIDUAL", List.of(devMembership));
        create(solo, "TASK", null, "Not allowed").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROJECT_NOT_STRUCTURED"));

        jdbc.update("UPDATE projects SET archived = TRUE WHERE id = ?", projectId);
        create(projectId, "TASK", null, "Archived").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROJECT_ARCHIVED"));
    }

    /* ================================================================== T19 retire / split */

    @Test
    void draftWorkRetiresWithReasonButPlannedWorkNeedsAScopeChange() throws Exception {
        String draft = id(create(projectId, "TASK", null, "Draft idea"));
        mockMvc.perform(auth(post("/v1/work-items/{id}/retire", draft), org.token()).contentType("application/json")
                        .content(json(Map.of("expected_version", 0))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(auth(post("/v1/work-items/{id}/retire", draft), org.token()).contentType("application/json")
                        .content(json(Map.of("reason", "Out of scope", "expected_version", 0))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan_status").value("RETIRED"))
                .andExpect(jsonPath("$.retired_reason").value("Out of scope"));
        assertThat(count("SELECT count(*) FROM work_items WHERE id = ?", draft)).isEqualTo(1); // never deleted
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'work_item.retired'")).isEqualTo(1);

        // An approved (ACTIVE) leaf belongs to the baseline: retiring or splitting it proposes a scope change.
        String planned = id(create(projectId, "TASK", null, "Planned leaf"));
        jdbc.update("UPDATE work_items SET plan_status = 'ACTIVE', weight = 20 WHERE id = ?", planned);
        mockMvc.perform(auth(post("/v1/work-items/{id}/retire", planned), org.token()).contentType("application/json")
                        .content(json(Map.of("reason", "Dropped", "expected_version", 0))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SCOPE_CHANGE_REQUIRED"));
        create(projectId, "SUBTASK", planned, "Split part").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SCOPE_CHANGE_REQUIRED"));
        create(projectId, "SUBTASK", draft, "Under retired").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_PARENT"));
    }

    /* ================================================================== helpers */

    private ResultActions create(String project, String type, String parent, String title)
            throws Exception {
        return mockMvc.perform(auth(post("/v1/projects/{p}/work-items", project), org.token())
                .contentType("application/json").content(body(type, parent, title)));
    }

    private ResultActions edit(String item, Map<String, Object> fields) throws Exception {
        return mockMvc.perform(auth(patch("/v1/work-items/{id}", item), org.token()).contentType("application/json").content(json(fields)));
    }

    private ResultActions assign(String item, UUID primary, UUID reviewerId,
            List<UUID> collaborators, long version, String reason) throws Exception {
        Map<String, Object> fields = new java.util.LinkedHashMap<>();
        fields.put("primary_assignee_membership_id", primary == null ? null : primary.toString());
        fields.put("reviewer_membership_id", reviewerId == null ? null : reviewerId.toString());
        fields.put("collaborator_membership_ids", collaborators.stream().map(UUID::toString).toList());
        fields.put("expected_version", version);
        if (reason != null) fields.put("reason", reason);
        return mockMvc.perform(auth(put("/v1/work-items/{id}/assignment", item), org.token())
                .contentType("application/json").content(json(fields)));
    }

    private String body(String type, String parent, String title) throws Exception {
        Map<String, Object> fields = new java.util.LinkedHashMap<>();
        fields.put("type", type);
        fields.put("title", title);
        if (parent != null) fields.put("parent_id", parent);
        return json(fields);
    }

    private String id(ResultActions actions) throws Exception {
        return tree(actions.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
    }

    private String project(Org owner, String key, String mode, List<UUID> members) throws Exception {
        Map<String, Object> fields = new java.util.LinkedHashMap<>();
        fields.put("name", key + " project");
        fields.put("key", key);
        fields.put("mode", mode);
        fields.put("member_membership_ids", members.stream().map(UUID::toString).toList());
        if ("INDIVIDUAL".equals(mode)) fields.put("accountable_membership_id", members.get(0).toString());
        return tree(mockMvc.perform(auth(post("/v1/organizations/{org}/projects", owner.id()), owner.token())
                        .contentType("application/json").content(json(fields)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
    }

    private UUID member(UUID orgId, UUID userId, String template, UUID templateRoleId) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, ?)", id, orgId, userId, template);
        jdbc.update("""
                INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by)
                VALUES (?, ?, ?, ?, 'ORG', ?)
                """, UUID.randomUUID(), orgId, id, templateRoleId, userId);
        return id;
    }

    private Org organization(String slug) throws Exception {
        Person owner = person(slug + "-owner");
        String unique = slug + "-" + UUID.randomUUID().toString().substring(0, 6);
        String id = tree(mockMvc.perform(auth(post("/v1/organizations"), owner.token()).contentType("application/json")
                        .content("{\"name\":\"" + unique + "\",\"slug\":\"" + unique + "\",\"timezone\":\"Europe/London\","
                                + "\"calendar\":{\"workdays\":[1,2,3,4,5],\"holidays\":[]}}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
        UUID orgId = UUID.fromString(id);
        return new Org(orgId, owner.id(), switchTo(owner.token(), orgId));
    }

    private Person person(String name) throws Exception {
        String email = name + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        TestAccounts.Account account = TestAccounts.signUpVerifyAndLogin(
                mockMvc, jdbc, accountTokens, objectMapper, email, "Correct-Horse-Battery-1!");
        return new Person(account.id(), email, account.accessToken());
    }

    private String switchTo(String token, UUID orgId) throws Exception {
        return tree(mockMvc.perform(auth(post("/v1/me/organizations/{org}/switch", orgId), token))
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

    @SuppressWarnings("unused")
    private JsonNode tree(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private static MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder builder, String token) {
        return builder.header("Authorization", "Bearer " + token);
    }

    private record Org(UUID id, UUID ownerId, String token) {}

    private record Person(UUID id, String email, String token) {}
}
