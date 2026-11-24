package com.prowise.work;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;

/**
 * Task 3.1: the Create Project setup (documents, phases, tasks with points and a reviewer, in one transaction),
 * the breakdown rules (T12), work types (T19) and assignment with history (T20).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T12")
@Tag("T19")
@Tag("T20")
@Tag("T25")
@Tag("AS-08")
class WorkBreakdownIntegrationTest {

    private static final UUID PM_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000003");
    private static final UUID LEAD_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000004");
    private static final UUID DEV_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000005");
    private static final UUID QA_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000006");

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;

    @BeforeEach
    @AfterEach
    void clean() {
        TestDatabase.clean(jdbc);
    }

    /* ================================================================== Create Project setup */

    @Test
    @DisplayName("Setup: a Structured project is created with its documents, phases and tasks in one transaction")
    void configuredProjectIsCreatedWithItsBreakdown() throws Exception {
        World w = world("setup");
        String doc = upload(w, w.pmToken(), "brief.pdf", "application/pdf", "%PDF brief".getBytes());
        JsonNode created = json(configured(w, w.pmToken(), "CRM", List.of(doc),
                phases(phase("Discovery", task("Interviews", "5", w.qa()), task("Report", "3", w.qa())),
                        phase("Build", task("API", "8", w.qa()))))
                .andExpect(status().isCreated()).andReturn());
        String projectId = created.path("project").path("id").asText();
        assertThat(created.path("project").path("mode").asText()).isEqualTo("STRUCTURED");
        JsonNode items = created.path("items");
        assertThat(items).hasSize(5);
        assertThat(texts(items, "key")).containsExactly("CRM-1", "CRM-2", "CRM-3", "CRM-4", "CRM-5");
        assertThat(texts(items, "type")).containsExactly("MILESTONE", "TASK", "TASK", "MILESTONE", "TASK");
        assertThat(items.get(1).path("parent_id").asText()).isEqualTo(items.get(0).path("id").asText());
        assertThat(items.get(1).path("points").decimalValue()).isEqualByComparingTo("5");
        assertThat(items.get(1).path("unit").asText()).isEqualTo("pts");
        assertThat(items.get(1).path("reviewer").path("email").asText()).isEqualTo(w.qaEmail());
        assertThat(items.get(1).path("leaf").asBoolean()).isTrue();
        assertThat(items.get(0).path("leaf").asBoolean()).isFalse();
        assertThat(created.path("documents")).hasSize(1);
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'project.breakdown_created'")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'ProjectBreakdownCreated'")).isEqualTo(1);

        mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}/documents/{doc}", w.org(), projectId, doc), w.pmToken()))
                .andExpect(status().isOk()).andExpect(content().bytes("%PDF brief".getBytes()));
        // The reviewer was added to the project, so they can read it; an unrelated developer cannot (404).
        mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}/work-items", w.org(), projectId), w.qaToken()))
                .andExpect(status().isOk());
        mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}/documents", w.org(), projectId), w.devToken()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Setup: documents, a phase and a task with points and reviewer are all required; failures create nothing")
    void setupStepsAreRequiredAndAtomic() throws Exception {
        World w = world("required");
        String doc = upload(w, w.pmToken(), "a.txt", "text/plain", "a".getBytes());
        configured(w, w.pmToken(), "AAA", List.of(), phases(phase("P", task("T", "1", w.qa()))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("document_ids"));
        configured(w, w.pmToken(), "AAA", List.of(doc), "[]")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("phases"));
        configured(w, w.pmToken(), "AAA", List.of(doc), phases(phase("Empty")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("phases"));
        configured(w, w.pmToken(), "AAA", List.of(doc), phases(phase("P", task("T", "0", w.qa()))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("phases[0].tasks[0].points"));
        configured(w, w.pmToken(), "AAA", List.of(doc), phases(phase("P", task("T", "2", null))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field_errors[0].field").value("phases[0].tasks[0].reviewer_membership_id"));
        configured(w, w.pmToken(), "AAA", List.of(doc), phases(phase("P", task("T", "2", UUID.randomUUID()))))
                .andExpect(status().isNotFound());
        // Someone else's upload cannot be attached.
        String othersDoc = upload(w, w.ownerToken(), "b.txt", "text/plain", "b".getBytes());
        configured(w, w.pmToken(), "AAA", List.of(othersDoc), phases(phase("P", task("T", "2", w.qa()))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("document_ids"));
        // A duplicate key fails after validation: the whole setup rolls back.
        configured(w, w.pmToken(), "AAA", List.of(doc), phases(phase("P", task("T", "2", w.qa())))).andExpect(status().isCreated());
        String doc2 = upload(w, w.pmToken(), "c.txt", "text/plain", "c".getBytes());
        configured(w, w.pmToken(), "AAA", List.of(doc2), phases(phase("P", task("T", "2", w.qa())))).andExpect(status().isConflict());
        assertThat(count("SELECT count(*) FROM projects WHERE org_id = ?", w.org())).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM file_metadata WHERE id = ? AND project_id IS NULL", doc2)).isEqualTo(1);
        // Individual projects keep the plain create form.
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects/configured", w.org()), w.pmToken()).contentType("application/json")
                        .content("{\"project\":{\"name\":\"Solo\",\"key\":\"SOLO\",\"mode\":\"INDIVIDUAL\"},\"document_ids\":[\"" + doc2 + "\"],\"phases\":[]}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("project.mode"));
        // A developer without project.create cannot use the setup.
        configured(w, w.devToken(), "DEV", List.of(doc2), phases(phase("P", task("T", "2", w.qa())))).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Documents: at most 10 MB each, never empty")
    void documentSizeLimit() throws Exception {
        World w = world("size");
        mockMvc.perform(auth(post("/v1/organizations/{org}/project-documents", w.org()), w.pmToken())
                        .param("file_name", "big.bin").contentType("application/octet-stream").content(new byte[10 * 1024 * 1024 + 1]))
                .andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"));
        mockMvc.perform(auth(post("/v1/organizations/{org}/project-documents", w.org()), w.pmToken())
                        .param("file_name", "empty.txt").contentType("text/plain").content(new byte[0]))
                .andExpect(status().isBadRequest());
        mockMvc.perform(auth(post("/v1/organizations/{org}/project-documents", w.org()), w.pmToken())
                        .param("file_name", "max.bin").contentType("application/octet-stream").content(new byte[10 * 1024 * 1024]))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.file_size").value(10 * 1024 * 1024));
    }

    /* ================================================================== T12 breakdown */

    @Test
    @DisplayName("T12: direct task, phase + task, deliverable + task + subtasks; invalid nesting and cross-project parents are rejected")
    void breakdownNesting() throws Exception {
        World w = world("t12");
        String projectId = setupProject(w, "NEST");
        String other = setupProject(w, "OTHR");
        List<String> setupIds = itemIds(w, projectId);
        String setupTask = setupIds.get(1);
        // Containers are plain edits.
        String milestone = id(add(w, projectId, "MILESTONE", null, "Phase 2", null).andExpect(status().isCreated()));
        String deliverable = id(add(w, projectId, "DELIVERABLE", milestone, "Deliverable", null).andExpect(status().isCreated()));
        // Tasks with points change the approved scope (task 3.2): added through a scope change, at every valid level.
        add(w, projectId, "TASK", null, "Direct task", "2")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SCOPE_CHANGE_REQUIRED"));
        draft(w, projectId, 1, "{\"kind\":\"ADD\",\"title\":\"Direct task\",\"points\":2}").andExpect(status().isCreated());
        draft(w, projectId, 1, "{\"kind\":\"ADD\",\"title\":\"Task in phase\",\"points\":3,\"parent_id\":\"" + milestone + "\"}")
                .andExpect(status().isCreated());
        draft(w, projectId, 1, "{\"kind\":\"ADD\",\"title\":\"Task in deliverable\",\"points\":3,\"parent_id\":\"" + deliverable + "\"}")
                .andExpect(status().isCreated());
        // Subtasks come from splitting a task (also a scope change).
        draft(w, projectId, 1, "{\"kind\":\"SPLIT\",\"work_item_id\":\"" + setupTask + "\",\"parts\":[{\"title\":\"A\",\"points\":2},{\"title\":\"B\",\"points\":3}]}")
                .andExpect(status().isCreated());
        add(w, projectId, "SUBTASK", setupTask, "Sub", "1")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SCOPE_CHANGE_REQUIRED"));
        // Invalid nesting.
        add(w, projectId, "SUBTASK", null, "Sub at root", "1").andExpect(status().isBadRequest());
        add(w, projectId, "MILESTONE", milestone, "Nested phase", null).andExpect(status().isBadRequest());
        add(w, projectId, "DELIVERABLE", setupTask, "Deliverable in task", null).andExpect(status().isBadRequest());
        add(w, projectId, "TASK", setupTask, "Task in task", "1").andExpect(status().isBadRequest());
        draft(w, projectId, 1, "{\"kind\":\"ADD\",\"title\":\"Task in task\",\"points\":1,\"parent_id\":\"" + setupTask + "\"}")
                .andExpect(status().isBadRequest());
        // Cross-project parents.
        String foreignParent = itemIds(w, other).get(0);
        add(w, projectId, "DELIVERABLE", foreignParent, "Cross project", null)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("parent_id"));
        draft(w, projectId, 1, "{\"kind\":\"ADD\",\"title\":\"Cross\",\"points\":1,\"parent_id\":\"" + foreignParent + "\"}")
                .andExpect(status().isBadRequest());
        // Keys stay stable and unique.
        List<String> keys = texts(json(mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}/work-items", w.org(), projectId), w.pmToken()))
                .andReturn()), "key");
        assertThat(keys).doesNotHaveDuplicates();
    }

    @Test
    @DisplayName("T19: points changes and removing a planned task need a scope change; empty containers can be retired")
    void scopeChangesAreGuarded() throws Exception {
        World w = world("scope");
        String projectId = setupProject(w, "SCOP");
        JsonNode items = json(mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}/work-items", w.org(), projectId), w.pmToken())).andReturn());
        JsonNode task = items.get(1);
        mockMvc.perform(auth(patch("/v1/organizations/{org}/projects/{p}/work-items/{i}", w.org(), projectId, task.path("id").asText()), w.pmToken())
                        .contentType("application/json").content("{\"points\":9,\"expected_version\":0}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SCOPE_CHANGE_REQUIRED"));
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/work-items/{i}/retire", w.org(), projectId, task.path("id").asText()), w.pmToken())
                        .contentType("application/json").content("{\"expected_version\":0}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SCOPE_CHANGE_REQUIRED"));
        mockMvc.perform(auth(patch("/v1/organizations/{org}/projects/{p}/work-items/{i}", w.org(), projectId, task.path("id").asText()), w.pmToken())
                        .contentType("application/json").content("{\"title\":\"Renamed\",\"expected_version\":0}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Renamed")).andExpect(jsonPath("$.version").value(1));
        mockMvc.perform(auth(patch("/v1/organizations/{org}/projects/{p}/work-items/{i}", w.org(), projectId, task.path("id").asText()), w.pmToken())
                        .contentType("application/json").content("{\"title\":\"Stale\",\"expected_version\":0}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        String empty = id(add(w, projectId, "MILESTONE", null, "Unused phase", null));
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/work-items/{i}/retire", w.org(), projectId, empty), w.pmToken())
                        .contentType("application/json").content("{\"expected_version\":0}"))
                .andExpect(status().isOk());
        assertThat(count("SELECT count(*) FROM work_items WHERE id = ? AND retired_at IS NOT NULL", empty)).isEqualTo(1);
    }

    @Test
    @DisplayName("T19: work types are created, read, edited and retired; a retired type cannot be used")
    void workTypes() throws Exception {
        World w = world("types");
        String projectId = setupProject(w, "TYPE");
        JsonNode type = json(mockMvc.perform(auth(post("/v1/organizations/{org}/work-types", w.org()), w.pmToken())
                        .contentType("application/json").content("{\"name\":\"Feature\"}"))
                .andExpect(status().isCreated()).andReturn());
        String typeId = type.path("id").asText();
        mockMvc.perform(auth(post("/v1/organizations/{org}/work-types", w.org()), w.pmToken())
                        .contentType("application/json").content("{\"name\":\"feature\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_WORK_TYPE"));
        mockMvc.perform(auth(patch("/v1/organizations/{org}/work-types/{t}", w.org(), typeId), w.pmToken())
                        .contentType("application/json").content("{\"name\":\"Feature work\",\"expected_version\":0}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Feature work"));
        mockMvc.perform(auth(post("/v1/organizations/{org}/work-types/{t}/retire", w.org(), typeId), w.pmToken())
                        .contentType("application/json").content("{\"expected_version\":1}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.retired").value(true));
        mockMvc.perform(auth(get("/v1/organizations/{org}/work-types", w.org()), w.devToken()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].retired").value(true));
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/work-items", w.org(), projectId), w.pmToken())
                        .contentType("application/json").content("{\"type\":\"MILESTONE\",\"title\":\"X\",\"work_type_id\":\"" + typeId + "\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("work_type_id"));
        mockMvc.perform(auth(post("/v1/organizations/{org}/work-types", w.org()), w.devToken())
                        .contentType("application/json").content("{\"name\":\"Bug\"}"))
                .andExpect(status().isForbidden());
    }

    /* ================================================================== T20 assignment */

    @Test
    @DisplayName("T20: the team lead assigns a team member, reassignment keeps history, other leads and outsiders cannot")
    void teamLeadAssignsTasks() throws Exception {
        World w = world("t20");
        UUID team = team(w, w.lead(), w.dev());
        String projectId = setupProject(w, "TEAM", team);
        JsonNode task = json(mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}/work-items", w.org(), projectId), w.leadToken()))
                .andExpect(status().isOk()).andReturn()).get(1);
        String taskId = task.path("id").asText();

        JsonNode queue = json(mockMvc.perform(auth(get("/v1/organizations/{org}/work-items/assignable", w.org()), w.leadToken()))
                .andExpect(status().isOk()).andReturn());
        assertThat(queue).isNotEmpty();
        assertThat(queue.get(0).path("item").path("assignee").isNull()).isTrue();
        JsonNode people = json(mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}/assignees", w.org(), projectId), w.leadToken()))
                .andExpect(status().isOk()).andReturn());
        assertThat(texts(people, "email")).contains(w.devEmail(), w.leadEmail()).doesNotContain(w.qaEmail());

        // Not a member of the project's team.
        assign(w.leadToken(), w, projectId, taskId, w.qa(), 0).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field_errors[0].field").value("assignee_membership_id"));
        assign(w.leadToken(), w, projectId, taskId, w.dev(), 0).andExpect(status().isOk())
                .andExpect(jsonPath("$.assignee.email").value(w.devEmail()))
                .andExpect(jsonPath("$.reviewer.email").value(w.qaEmail()));
        assign(w.leadToken(), w, projectId, taskId, w.dev(), 0).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_VERSION"));
        assign(w.leadToken(), w, projectId, taskId, w.lead(), 1).andExpect(status().isOk());
        JsonNode history = json(mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{p}/work-items/{i}/assignment-history",
                        w.org(), projectId, taskId), w.pmToken())).andExpect(status().isOk()).andReturn());
        assertThat(history).hasSize(3); // setup reviewer, then dev, then lead
        assertThat(history.get(2).path("previous_assignee").path("email").asText()).isEqualTo(w.devEmail());
        assertThat(history.get(2).path("new_assignee").path("email").asText()).isEqualTo(w.leadEmail());
        assertThat(history.get(1).path("new_assignee").path("email").asText()).isEqualTo(w.devEmail());
        // The assigned developer can now open the project (assigned work).
        mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}", w.org(), projectId), w.devToken())).andExpect(status().isOk());
        // Phases are never assigned.
        String phase = json(mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}/work-items", w.org(), projectId), w.leadToken()))
                .andReturn()).get(0).path("id").asText();
        assign(w.leadToken(), w, projectId, phase, w.dev(), 0).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_A_LEAF"));
        // The developer cannot assign, and the lead of another team cannot even read the project.
        assign(w.devToken(), w, projectId, taskId, w.dev(), 2).andExpect(status().isForbidden());
        Person other = person("other-lead");
        UUID otherLead = member(w.org(), other.id(), "TEAM_LEAD", LEAD_ROLE);
        team(w, otherLead);
        assign(switchTo(other.token(), w.org()), w, projectId, taskId, w.dev(), 2).andExpect(status().isNotFound());
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'work_item.assigned'")).isEqualTo(2);
    }

    /* ================================================================== 3.2 scope versions (T25, AS-08) */

    @Test
    @DisplayName("3.2: the setup's tasks become version 1, approved at once by a Project Manager")
    void setupCreatesTheFirstApprovedScope() throws Exception {
        World w = world("v1");
        String projectId = setupProject(w, "VONE");
        JsonNode versions = scopeVersions(w, projectId);
        assertThat(versions).hasSize(1);
        JsonNode v1 = versions.get(0);
        assertThat(v1.path("status").asText()).isEqualTo("ACTIVE");
        assertThat(v1.path("version_no").asInt()).isEqualTo(1);
        assertThat(v1.path("unit").asText()).isEqualTo("POINTS");
        assertThat(v1.path("total_points").decimalValue()).isEqualByComparingTo("8");
        assertThat(v1.path("leaves")).hasSize(2);
        assertThat(v1.path("approver_email").asText()).isNotBlank();
    }

    @Test
    @DisplayName("3.2: a creator without project.scope.change leaves the first scope as a draft for an approver")
    void adminCreatorLeavesTheFirstScopeAsDraft() throws Exception {
        World w = world("adm");
        Person admin = person("admin");
        member(w.org(), admin.id(), "ORGANIZATION_ADMIN", UUID.fromString("10000000-0000-0000-0000-000000000002"));
        String adminToken = switchTo(admin.token(), w.org());
        String doc = upload(w, adminToken, "a.txt", "text/plain", "a".getBytes());
        String body = "{\"project\":{\"name\":\"Admin project\",\"key\":\"ADMN\",\"mode\":\"STRUCTURED\",\"project_manager_membership_id\":\""
                + w.pm() + "\"},\"document_ids\":[\"" + doc + "\"],\"phases\":" + phases(phase("P", task("T", "4", w.qa()))) + "}";
        String projectId = json(mockMvc.perform(auth(post("/v1/organizations/{org}/projects/configured", w.org()), adminToken)
                        .contentType("application/json").content(body))
                .andExpect(status().isCreated()).andReturn()).path("project").path("id").asText();
        JsonNode versions = scopeVersions(w, projectId);
        assertThat(versions.get(0).path("status").asText()).isEqualTo("DRAFT");
        approve(w.pmToken(), w, projectId, versions.get(0).path("id").asText(), 0).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE")).andExpect(jsonPath("$.version_no").value(1));
    }

    @Test
    @DisplayName("T25/AS-08: approving +25 points makes 100 into 125; the earlier version stays unchanged and readable")
    void approvedAdditionCreatesANewVersion() throws Exception {
        World w = world("t25");
        String projectId = setupProject(w, "ADDS", null, "20", "30", "50");
        JsonNode draft = json(draft(w, projectId, 1, "{\"kind\":\"ADD\",\"title\":\"Audit trail\",\"points\":25}")
                .andExpect(status().isCreated()).andReturn());
        assertThat(draft.path("status").asText()).isEqualTo("DRAFT");
        assertThat(draft.path("total_points").decimalValue()).isEqualByComparingTo("125");
        assertThat(texts(workItems(w, projectId), "title")).doesNotContain("Audit trail"); // proposed work is hidden

        approve(w.pmToken(), w, projectId, draft.path("id").asText(), 0).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE")).andExpect(jsonPath("$.version_no").value(2))
                .andExpect(jsonPath("$.reason").value("Scope change"))
                .andExpect(jsonPath("$.author_email").value(w.pmEmail())).andExpect(jsonPath("$.approver_email").value(w.pmEmail()));
        JsonNode versions = scopeVersions(w, projectId);
        assertThat(texts(versions, "status")).containsExactly("ACTIVE", "SUPERSEDED");
        assertThat(versions.get(1).path("total_points").decimalValue()).isEqualByComparingTo("100"); // earlier version untouched
        assertThat(versions.get(1).path("leaves")).hasSize(3);
        assertThat(versions.get(0).path("total_points").decimalValue()).isEqualByComparingTo("125");
        assertThat(texts(workItems(w, projectId), "title")).contains("Audit trail");
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'scope.approved'")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'ScopeChanged'")).isEqualTo(1);
        approve(w.pmToken(), w, projectId, draft.path("id").asText(), 1).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SCOPE_VERSION_DECIDED"));
        String supersededId = versions.get(1).path("id").asText();
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update(
                "UPDATE scope_leaves SET weight = 1 WHERE scope_version_id = CAST(? AS uuid)", supersededId))
                .hasMessageContaining("immutable");
    }

    @Test
    @DisplayName("T25: an approved removal takes the task out; cancelling alone keeps the denominator; points change via a draft")
    void removalCancellationAndReweight() throws Exception {
        World w = world("rm");
        String projectId = setupProject(w, "REMV", null, "20", "30", "50");
        List<String> tasks = leafIds(w, projectId);
        String removal = json(draft(w, projectId, 1, "{\"kind\":\"REMOVE\",\"work_item_id\":\"" + tasks.get(2) + "\"}")
                .andExpect(status().isCreated()).andReturn()).path("id").asText();
        approve(w.pmToken(), w, projectId, removal, 0).andExpect(status().isOk()).andExpect(jsonPath("$.total_points").value(50.0));
        assertThat(leafIds(w, projectId)).hasSize(2);
        String cancel = json(draft(w, projectId, 2, "{\"kind\":\"CANCEL\",\"work_item_id\":\"" + tasks.get(1) + "\"}")
                .andExpect(status().isCreated()).andReturn()).path("id").asText();
        JsonNode cancelled = json(approve(w.pmToken(), w, projectId, cancel, 0).andExpect(status().isOk()).andReturn());
        assertThat(cancelled.path("total_points").decimalValue()).isEqualByComparingTo("50"); // still counted
        boolean found = false;
        for (JsonNode leaf : cancelled.path("leaves")) {
            if (leaf.path("work_item_id").asText().equals(tasks.get(1))) { assertThat(leaf.path("cancelled").asBoolean()).isTrue(); found = true; }
        }
        assertThat(found).isTrue();
        String reweight = json(draft(w, projectId, 3, "{\"kind\":\"REWEIGHT\",\"work_item_id\":\"" + tasks.get(0) + "\",\"points\":10}")
                .andExpect(status().isCreated()).andReturn()).path("id").asText();
        approve(w.pmToken(), w, projectId, reweight, 0).andExpect(status().isOk()).andExpect(jsonPath("$.total_points").value(40.0));
        draft(w, projectId, 4, "{\"kind\":\"REWEIGHT\",\"work_item_id\":\"" + tasks.get(0) + "\",\"points\":0}").andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("3.2: concurrent approvals cannot activate two versions; a stale base is 409 STALE_VERSION")
    void concurrentApprovalsActivateOneVersion() throws Exception {
        World w = world("race");
        String projectId = setupProject(w, "RACE");
        String a = json(draft(w, projectId, 1, "{\"kind\":\"ADD\",\"title\":\"A\",\"points\":1}").andReturn()).path("id").asText();
        String b = json(draft(w, projectId, 1, "{\"kind\":\"ADD\",\"title\":\"B\",\"points\":2}").andReturn()).path("id").asText();
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        java.util.concurrent.CountDownLatch start = new java.util.concurrent.CountDownLatch(1);
        List<java.util.concurrent.Future<Integer>> results = new ArrayList<>();
        for (String id : List.of(a, b)) {
            results.add(pool.submit(() -> {
                start.await();
                return approve(w.pmToken(), w, projectId, id, 0).andReturn().getResponse().getStatus();
            }));
        }
        start.countDown();
        List<Integer> statuses = new ArrayList<>();
        for (java.util.concurrent.Future<Integer> result : results) statuses.add(result.get());
        pool.shutdown();
        assertThat(statuses).containsExactlyInAnyOrder(200, 409);
        assertThat(count("SELECT count(*) FROM scope_versions WHERE project_id = ? AND status = 'ACTIVE'", projectId)).isEqualTo(1);
        draft(w, projectId, 1, "{\"kind\":\"ADD\",\"title\":\"C\",\"points\":1}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/scope-versions", w.org(), projectId), w.leadToken())
                        .contentType("application/json")
                        .content("{\"reason\":\"x\",\"expected_base_version\":2,\"changes\":[{\"kind\":\"ADD\",\"title\":\"D\",\"points\":1}]}"))
                .andExpect(status().isNotFound()); // the lead of no team cannot even read the project
    }

    /* ================================================================== 3.3 review and rework, 3.5 accepted work */

    @Test
    @Tag("T22")
    @DisplayName("T22: assignee submits, reviewer approves; Done earns its points and writes audit, outbox and a snapshot")
    void submitAndApproveEarnsCredit() throws Exception {
        World w = world("rv1");
        String projectId = setupProject(w, "RVONE", null, "20", "30", "50");
        String task = leafIds(w, projectId).get(0);
        assign(w.pmToken(), w, projectId, task, w.dev(), version(w, projectId, task)).andExpect(status().isOk());

        submit(w.qaToken(), w, projectId, task).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("NOT_TASK_ASSIGNEE"));
        submit(w.devToken(), w, projectId, task).andExpect(status().isOk()).andExpect(jsonPath("$.item.state").value("IN_REVIEW"));
        decide(w.devToken(), w, projectId, task, "approve", 1, List.of(), null).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_TASK_REVIEWER"));
        decide(w.qaToken(), w, projectId, task, "approve", 1, List.of(), "Looks good").andExpect(status().isOk())
                .andExpect(jsonPath("$.item.state").value("DONE")).andExpect(jsonPath("$.accepted_revision").value(1));

        JsonNode progress = progress(w, projectId);
        assertThat(progress.path("numerator").decimalValue()).isEqualByComparingTo("20");
        assertThat(progress.path("denominator").decimalValue()).isEqualByComparingTo("100");
        assertThat(progress.path("display_percent").decimalValue()).isEqualByComparingTo("20");
        assertThat(progress.path("method").asText()).isEqualTo("calculated");
        assertThat(texts(progress.path("snapshots"), "cause")).containsExactly("SCOPE_APPROVED", "TASK_APPROVED");
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'task.review_approved'")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'WorkItemCompleted'")).isEqualTo(1);
        assertThat(json(mockMvc.perform(auth(get("/v1/organizations/{org}/review-queue", w.org()), w.qaToken())).andReturn())).isEmpty();
        assertThat(json(mockMvc.perform(auth(get("/v1/organizations/{org}/my-tasks", w.org()), w.devToken())).andReturn())).hasSize(1);
    }

    @Test
    @Tag("T22")
    @DisplayName("T22: approving an older revision after changes were requested fails with STALE_REVIEW")
    void staleRevisionCannotBeApproved() throws Exception {
        World w = world("rv2");
        String projectId = setupProject(w, "RVTWO");
        String task = leafIds(w, projectId).get(0);
        assign(w.pmToken(), w, projectId, task, w.dev(), version(w, projectId, task)).andExpect(status().isOk());
        submit(w.devToken(), w, projectId, task).andExpect(status().isOk());
        assertThat(json(mockMvc.perform(auth(get("/v1/organizations/{org}/review-queue", w.org()), w.qaToken())).andReturn())).hasSize(1);

        decide(w.qaToken(), w, projectId, task, "request-changes", 1, List.of(), null).andExpect(status().isBadRequest());
        decide(w.qaToken(), w, projectId, task, "request-changes", 1, List.of(), "Add tests").andExpect(status().isOk())
                .andExpect(jsonPath("$.item.state").value("IN_PROGRESS")).andExpect(jsonPath("$.current_revision").value(2));
        submit(w.devToken(), w, projectId, task).andExpect(status().isOk()).andExpect(jsonPath("$.submitted_revision").value(2));
        decide(w.qaToken(), w, projectId, task, "approve", 1, List.of(), null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_REVIEW"));
        decide(w.qaToken(), w, projectId, task, "approve", 2, List.of(), null).andExpect(status().isOk());
    }

    @Test
    @Tag("T22")
    @DisplayName("T22: every required check must pass before approval")
    void missingCheckBlocksApproval() throws Exception {
        World w = world("rv3");
        String projectId = setupProject(w, "RVTHR");
        String task = leafIds(w, projectId).get(0);
        JsonNode withChecks = json(mockMvc.perform(auth(put("/v1/organizations/{org}/projects/{p}/work-items/{i}/checks", w.org(), projectId, task),
                        w.pmToken()).contentType("application/json")
                        .content("{\"labels\":[\"Tests pass\",\"Docs updated\"],\"expected_version\":" + version(w, projectId, task) + "}"))
                .andExpect(status().isOk()).andReturn());
        List<String> checkIds = texts(withChecks.path("checks"), "id");
        assertThat(checkIds).hasSize(2);
        assign(w.pmToken(), w, projectId, task, w.dev(), version(w, projectId, task)).andExpect(status().isOk());
        submit(w.devToken(), w, projectId, task).andExpect(status().isOk());

        decide(w.qaToken(), w, projectId, task, "approve", 1, checkIds.subList(0, 1), null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MISSING_CHECK"));
        decide(w.qaToken(), w, projectId, task, "approve", 1, checkIds, null).andExpect(status().isOk());
    }

    @Test
    @Tag("T22")
    @Tag("T27")
    @Tag("AS-03")
    @DisplayName("T27/AS-03: 20+30 of 100 is 50%; +25 approved is 40%; reopening the 30 is 16%; history and snapshots kept")
    void acceptedWorkFixturesThroughTheApi() throws Exception {
        World w = world("rv4");
        String projectId = setupProject(w, "RVFOU", null, "20", "30", "50");
        List<String> leaves = leafIds(w, projectId);
        for (String task : leaves.subList(0, 2)) {
            assign(w.pmToken(), w, projectId, task, w.dev(), version(w, projectId, task)).andExpect(status().isOk());
            submit(w.devToken(), w, projectId, task).andExpect(status().isOk());
            decide(w.qaToken(), w, projectId, task, "approve", 1, List.of(), null).andExpect(status().isOk());
        }
        assertThat(progress(w, projectId).path("display_percent").decimalValue()).isEqualByComparingTo("50");

        JsonNode draft = json(draft(w, projectId, 1, "{\"kind\":\"ADD\",\"title\":\"Audit trail\",\"points\":25}")
                .andExpect(status().isCreated()).andReturn());
        approve(w.pmToken(), w, projectId, draft.path("id").asText(), 0).andExpect(status().isOk());
        assertThat(progress(w, projectId).path("display_percent").decimalValue()).isEqualByComparingTo("40");

        String thirty = leaves.get(1);
        reopen(w.qaToken(), w, projectId, thirty, "x").andExpect(status().isForbidden()); // the reviewer lacks project.edit
        reopen(w.pmToken(), w, projectId, thirty, "").andExpect(status().isBadRequest());
        JsonNode reopened = json(reopen(w.pmToken(), w, projectId, thirty, "Bug found in production").andExpect(status().isOk()).andReturn());
        assertThat(reopened.path("item").path("state").asText()).isEqualTo("IN_PROGRESS");
        assertThat(reopened.path("accepted_revision").isNull() || reopened.path("accepted_revision").isMissingNode()).isTrue();

        JsonNode progress = progress(w, projectId);
        assertThat(progress.path("display_percent").decimalValue()).isEqualByComparingTo("16");
        assertThat(progress.path("scope_version_no").asInt()).isEqualTo(2);
        JsonNode snapshots = progress.path("snapshots");
        assertThat(texts(snapshots, "cause")).containsExactly("SCOPE_APPROVED", "TASK_APPROVED", "TASK_APPROVED", "SCOPE_APPROVED", "TASK_REOPENED");
        assertThat(texts(snapshots, "scope_version_no")).containsExactly("1", "1", "1", "2", "2");
        assertThat(texts(snapshots, "display_percent")).containsExactly("0", "20", "50", "40", "16");

        JsonNode history = json(mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{p}/work-items/{i}/reviews", w.org(), projectId, thirty),
                w.pmToken())).andExpect(status().isOk()).andReturn());
        assertThat(texts(history, "kind")).containsExactly("SUBMITTED", "APPROVED", "REOPENED");
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update("UPDATE progress_snapshots SET percent = 1"))
                .isInstanceOf(Exception.class);
    }

    @Test
    @Tag("T22")
    @DisplayName("T22: two decisions on the same task version: one wins, the other is STALE_VERSION")
    void staleVersionOnReviewDecision() throws Exception {
        World w = world("rv5");
        String projectId = setupProject(w, "RVFIV");
        String task = leafIds(w, projectId).get(0);
        assign(w.pmToken(), w, projectId, task, w.dev(), version(w, projectId, task)).andExpect(status().isOk());
        submit(w.devToken(), w, projectId, task).andExpect(status().isOk());
        int seen = version(w, projectId, task);
        decide(w.qaToken(), w, projectId, task, "approve", 1, List.of(), null, seen).andExpect(status().isOk());
        decide(w.qaToken(), w, projectId, task, "request-changes", 1, List.of(), "Late", seen).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_VERSION"));
        assertThat(count("SELECT count(*) FROM task_reviews WHERE kind = 'APPROVED'")).isEqualTo(1);
    }

    @Test
    @Tag("T22")
    @DisplayName("T22: another organization's task and progress are 404")
    void foreignTaskIsNotFound() throws Exception {
        World w = world("rv6");
        World other = world("rv6b");
        String projectId = setupProject(w, "RVSIX");
        String task = leafIds(w, projectId).get(0);
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/work-items/{i}/submit", other.org(), projectId, task), other.devToken())
                .contentType("application/json").content("{\"expected_version\":0}")).andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{p}/progress", other.org(), projectId), other.pmToken()))
                .andExpect(status().isNotFound());
    }

    @Test
    @Tag("T27")
    @Tag("AS-03")
    @DisplayName("3.5: the project list shows the accepted-work figure; an empty scope is Not measurable, never 0% or invented")
    void projectListCarriesAcceptedWork() throws Exception {
        World w = world("pl");
        String projectId = setupProject(w, "PLONE", null, "20", "80");
        String task = leafIds(w, projectId).get(0);
        assign(w.pmToken(), w, projectId, task, w.dev(), version(w, projectId, task)).andExpect(status().isOk());
        submit(w.devToken(), w, projectId, task).andExpect(status().isOk());
        decide(w.qaToken(), w, projectId, task, "approve", 1, List.of(), null).andExpect(status().isOk());
        JsonNode list = json(mockMvc.perform(auth(get("/v1/organizations/{org}/projects", w.org()), w.pmToken())).andExpect(status().isOk()).andReturn());
        JsonNode project = list.path("items").get(0);
        assertThat(project.path("key").asText()).isEqualTo("PLONE");
        assertThat(project.path("progress").path("percent").decimalValue()).isEqualByComparingTo("20");
        assertThat(project.path("progress").path("reported_at").asText()).isNotBlank();

        // A Structured project without an approved scope has no measurable figure.
        jdbc.update("UPDATE projects SET last_progress_percent = NULL WHERE id = ?", projectId);
        JsonNode empty = json(mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{p}", w.org(), projectId), w.pmToken())).andReturn());
        assertThat(empty.path("progress").path("percent").isNull()).isTrue();
        assertThat(empty.path("progress").path("label").asText()).isEqualTo("Not measurable");
    }

    /* ================================================================== 3.1 cross-project reads */

    @Test
    @Tag("T20")
    @DisplayName("3.1: work items across readable projects, filtered; one item by id; foreign or unreadable = 404")
    void workItemsAcrossReadableProjects() throws Exception {
        World w = world("wq");
        UUID team = team(w, w.lead(), w.dev());
        String a = setupProject(w, "WQA", team, "3", "5");
        String b = setupProject(w, "WQB", null, "8");
        String task = leafIds(w, a).get(0);
        assign(w.leadToken(), w, a, task, w.dev(), version(w, a, task)).andExpect(status().isOk());

        JsonNode all = json(mockMvc.perform(auth(get("/v1/organizations/{org}/work-items", w.org()), w.pmToken())).andExpect(status().isOk()).andReturn());
        assertThat(texts(all, "project_key")).containsExactlyInAnyOrder("WQA", "WQA", "WQB");
        JsonNode mine = json(mockMvc.perform(auth(get("/v1/organizations/{org}/work-items", w.org()), w.devToken()).param("assignee", "me"))
                .andExpect(status().isOk()).andReturn());
        assertThat(mine).hasSize(1);
        assertThat(mine.get(0).path("item").path("id").asText()).isEqualTo(task);
        JsonNode unassigned = json(mockMvc.perform(auth(get("/v1/organizations/{org}/work-items", w.org()), w.pmToken())
                .param("assignee", "none").param("project_id", a)).andExpect(status().isOk()).andReturn());
        assertThat(unassigned).hasSize(1);
        mockMvc.perform(auth(get("/v1/organizations/{org}/work-items", w.org()), w.pmToken()).param("state", "FINISHED"))
                .andExpect(status().isBadRequest());

        // The lead reads the team project only: project B is absent, its item is 404.
        JsonNode leadView = json(mockMvc.perform(auth(get("/v1/organizations/{org}/work-items", w.org()), w.leadToken())).andExpect(status().isOk()).andReturn());
        assertThat(texts(leadView, "project_key")).containsOnly("WQA");
        mockMvc.perform(auth(get("/v1/organizations/{org}/work-items/{i}", w.org(), leafIds(w, b).get(0)), w.leadToken())).andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/organizations/{org}/work-items/{i}", w.org(), task), w.leadToken())).andExpect(status().isOk())
                .andExpect(jsonPath("$.project_key").value("WQA")).andExpect(jsonPath("$.item.assignee.membership_id").value(w.dev().toString()));
        World other = world("wq-b");
        mockMvc.perform(auth(get("/v1/organizations/{org}/work-items/{i}", other.org(), task), other.pmToken())).andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/organizations/{org}/work-items/{i}", w.org(), task), other.pmToken())).andExpect(status().isNotFound());
    }

    @Test
    @Tag("T20")
    @DisplayName("3.1: My team lists the teams I lead or belong to with each member's open work; others see nothing")
    void myTeamsShowsOpenWorkPerMember() throws Exception {
        World w = world("mt");
        UUID team = team(w, w.lead(), w.dev());
        String project = setupProject(w, "MYT", team, "3", "5");
        String task = leafIds(w, project).get(1);
        assign(w.leadToken(), w, project, task, w.dev(), version(w, project, task)).andExpect(status().isOk());

        JsonNode teams = json(mockMvc.perform(auth(get("/v1/organizations/{org}/my-teams", w.org()), w.leadToken())).andExpect(status().isOk()).andReturn());
        assertThat(teams).hasSize(1);
        assertThat(teams.get(0).path("you_lead").asBoolean()).isTrue();
        JsonNode members = teams.get(0).path("members");
        assertThat(texts(members, "email")).contains(w.devEmail(), w.leadEmail());
        for (JsonNode member : members) {
            if (member.path("email").asText().equals(w.devEmail())) {
                assertThat(member.path("open_tasks").asInt()).isEqualTo(1);
                assertThat(member.path("open_points").decimalValue()).isEqualByComparingTo("5");
            }
        }
        JsonNode asMember = json(mockMvc.perform(auth(get("/v1/organizations/{org}/my-teams", w.org()), w.devToken())).andExpect(status().isOk()).andReturn());
        assertThat(asMember.get(0).path("you_lead").asBoolean()).isFalse();
        assertThat(json(mockMvc.perform(auth(get("/v1/organizations/{org}/my-teams", w.org()), w.qaToken())).andExpect(status().isOk()).andReturn()))
                .isEmpty();
    }

    /* ================================================================== 3.2 cross-project scope reads */

    @Test
    @Tag("T25")
    @DisplayName("3.2: scope versions across readable projects with approval right; one version by id; foreign = 404")
    void scopeVersionsAcrossProjects() throws Exception {
        World w = world("sv");
        String projectId = setupProject(w, "SVONE", null, "20", "30");
        String draftId = json(draft(w, projectId, 1, "{\"kind\":\"ADD\",\"title\":\"Audit trail\",\"points\":25}").andExpect(status().isCreated())
                .andReturn()).path("id").asText();

        JsonNode drafts = json(mockMvc.perform(auth(get("/v1/organizations/{org}/scope-versions", w.org()), w.pmToken()).param("status", "DRAFT"))
                .andExpect(status().isOk()).andReturn());
        assertThat(drafts).hasSize(1);
        assertThat(drafts.get(0).path("project_key").asText()).isEqualTo("SVONE");
        assertThat(drafts.get(0).path("can_approve").asBoolean()).isTrue();
        assertThat(drafts.get(0).path("active").path("total_points").decimalValue()).isEqualByComparingTo("50");
        assertThat(drafts.get(0).path("version").path("total_points").decimalValue()).isEqualByComparingTo("75");
        mockMvc.perform(auth(get("/v1/organizations/{org}/scope-versions", w.org()), w.pmToken()).param("status", "PENDING"))
                .andExpect(status().isBadRequest());

        // A reader without project.scope.change sees it but may not approve it; the lead of no team cannot see it at all.
        mockMvc.perform(auth(get("/v1/organizations/{org}/scope-versions/{v}", w.org(), draftId), w.qaToken()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.can_approve").value(false)); // the task reviewer is a project member
        JsonNode one = json(mockMvc.perform(auth(get("/v1/organizations/{org}/scope-versions/{v}", w.org(), draftId), w.ownerToken()))
                .andExpect(status().isOk()).andReturn());
        assertThat(one.path("version").path("changes").get(0).path("title").asText()).isEqualTo("Audit trail");
        assertThat(json(mockMvc.perform(auth(get("/v1/organizations/{org}/scope-versions", w.org()), w.leadToken())).andReturn())).isEmpty();
        World other = world("sv-b");
        mockMvc.perform(auth(get("/v1/organizations/{org}/scope-versions/{v}", other.org(), draftId), other.pmToken())).andExpect(status().isNotFound());
    }

    /* ================================================================== 3.4 dependencies and blockers */

    @Test
    @Tag("T24")
    @DisplayName("T24: self-links, duplicates and loops are refused; a change returns everything downstream")
    void linksRefuseSelfDuplicatesAndCycles() throws Exception {
        World w = world("dep1");
        String projectId = setupProject(w, "DEPONE", null, "1", "2", "3");
        List<String> t = leafIds(w, projectId);
        link(w, projectId, t.get(0), t.get(0)).andExpect(status().isBadRequest());
        JsonNode first = json(link(w, projectId, t.get(1), t.get(0)).andExpect(status().isCreated()).andReturn()); // A -> B
        assertThat(texts(first.path("affected"), "id")).containsExactly(t.get(1));
        link(w, projectId, t.get(1), t.get(0)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_DEPENDENCY"));
        JsonNode second = json(link(w, projectId, t.get(2), t.get(1)).andExpect(status().isCreated()).andReturn()); // B -> C
        assertThat(texts(second.path("affected"), "id")).containsExactly(t.get(2));
        link(w, projectId, t.get(0), t.get(2)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DEPENDENCY_CYCLE")); // C -> A

        // A blocker on A surfaces both B and C as affected work.
        JsonNode raised = json(blocker(w, w.pmToken(), projectId, t.get(0), "CRITICAL", w.lead(), "Vendor API down").andExpect(status().isCreated()).andReturn());
        assertThat(texts(raised.path("affected"), "id")).containsExactlyInAnyOrder(t.get(1), t.get(2));

        // Another organization cannot link to these tasks.
        World other = world("dep1b");
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/work-items/{i}/dependencies", other.org(), projectId, t.get(0)), other.pmToken())
                .contentType("application/json").content("{\"predecessor_id\":\"" + t.get(1) + "\",\"expected_version\":0}"))
                .andExpect(status().isNotFound());
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'dependency.linked'")).isEqualTo(2);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'DependencyLinked'")).isEqualTo(2);
    }

    @Test
    @Tag("T24")
    @DisplayName("T24: A->B and B->A fired at the same time: exactly one succeeds")
    void simultaneousReverseLinksCannotFormALoop() throws Exception {
        World w = world("dep2");
        String projectId = setupProject(w, "DEPTWO");
        List<String> t = leafIds(w, projectId);
        int va = version(w, projectId, t.get(0));
        int vb = version(w, projectId, t.get(1));
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        java.util.concurrent.CountDownLatch start = new java.util.concurrent.CountDownLatch(1);
        List<java.util.concurrent.Future<Integer>> results = new ArrayList<>();
        results.add(pool.submit(() -> { start.await(); return link(w, projectId, t.get(1), t.get(0), vb).andReturn().getResponse().getStatus(); }));
        results.add(pool.submit(() -> { start.await(); return link(w, projectId, t.get(0), t.get(1), va).andReturn().getResponse().getStatus(); }));
        start.countDown();
        List<Integer> statuses = new ArrayList<>();
        for (java.util.concurrent.Future<Integer> result : results) statuses.add(result.get());
        pool.shutdown();
        assertThat(statuses).containsExactlyInAnyOrder(201, 409);
        assertThat(count("SELECT count(*) FROM work_item_dependencies WHERE project_id = ?", projectId)).isEqualTo(1);
    }

    @Test
    @Tag("T21")
    @DisplayName("T21: flag an In Progress task blocked with reason and owner; clearing it keeps the task's state")
    void blockerIsASeparateFlag() throws Exception {
        World w = world("blk");
        String projectId = setupProject(w, "BLOCK");
        String task = leafIds(w, projectId).get(0);
        assign(w.pmToken(), w, projectId, task, w.dev(), version(w, projectId, task)).andExpect(status().isOk());
        submit(w.devToken(), w, projectId, task).andExpect(status().isOk());
        decide(w.qaToken(), w, projectId, task, "request-changes", 1, List.of(), "Fix the edge case").andExpect(status().isOk()); // now In Progress

        blocker(w, w.devToken(), projectId, task, "URGENT", w.lead(), "x").andExpect(status().isBadRequest());
        blocker(w, w.devToken(), projectId, task, "CRITICAL", null, "x").andExpect(status().isBadRequest());
        JsonNode raised = json(blocker(w, w.devToken(), projectId, task, "CRITICAL", w.lead(), "Waiting for staging credentials")
                .andExpect(status().isCreated()).andReturn());
        JsonNode b = raised.path("blocker");
        assertThat(b.path("severity").asText()).isEqualTo("CRITICAL");
        assertThat(b.path("owner").path("membership_id").asText()).isEqualTo(w.lead().toString());
        assertThat(b.path("opened_at").asText()).isNotBlank();
        assertThat(jdbc.queryForObject("SELECT state FROM work_items WHERE id = ?", String.class, task)).isEqualTo("IN_PROGRESS");
        assertThat(jdbc.queryForObject("SELECT is_blocked FROM work_items WHERE id = ?", Boolean.class, task)).isTrue();
        JsonNode board = json(mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{p}/dependencies", w.org(), projectId), w.pmToken()))
                .andExpect(status().isOk()).andReturn());
        assertThat(board.path("blockers")).hasSize(1);

        String blockerId = b.path("id").asText();
        resolve(w.qaToken(), w, projectId, task, blockerId, "Done", b.path("version").asInt()).andExpect(status().isForbidden()); // not owner/opener/editor
        resolve(w.leadToken(), w, projectId, task, blockerId, "", b.path("version").asInt()).andExpect(status().isBadRequest());
        resolve(w.leadToken(), w, projectId, task, blockerId, "Credentials issued", b.path("version").asInt()).andExpect(status().isOk())
                .andExpect(jsonPath("$.blocker.resolution").value("Credentials issued"));
        resolve(w.leadToken(), w, projectId, task, blockerId, "Again", b.path("version").asInt()).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_VERSION"));
        assertThat(jdbc.queryForObject("SELECT state FROM work_items WHERE id = ?", String.class, task)).isEqualTo("IN_PROGRESS");
        assertThat(jdbc.queryForObject("SELECT is_blocked FROM work_items WHERE id = ?", Boolean.class, task)).isFalse();
        assertThat(count("SELECT count(*) FROM audit_log WHERE action IN ('blocker.raised', 'blocker.resolved')")).isEqualTo(2);
    }

    @Test
    @Tag("T24")
    @Tag("AS-05")
    @DisplayName("Successor waits for an accepted predecessor; reopening it flags the successor and moves no date")
    void successorWaitsAndIsFlaggedWhenPredecessorReopens() throws Exception {
        World w = world("dep3");
        String projectId = setupProject(w, "DEPTHR");
        List<String> t = leafIds(w, projectId);
        String a = t.get(0);
        String b = t.get(1);
        link(w, projectId, b, a).andExpect(status().isCreated());
        for (String task : t) assign(w.pmToken(), w, projectId, task, w.dev(), version(w, projectId, task)).andExpect(status().isOk());

        submit(w.devToken(), w, projectId, b).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PREDECESSOR_OPEN"));
        JsonNode mine = json(mockMvc.perform(auth(get("/v1/organizations/{org}/my-tasks", w.org()), w.devToken())).andReturn());
        for (JsonNode node : mine) {
            if (node.path("item").path("id").asText().equals(b)) assertThat(texts(node.path("waiting_on"), "id")).containsExactly(a);
        }

        submit(w.devToken(), w, projectId, a).andExpect(status().isOk());
        decide(w.qaToken(), w, projectId, a, "approve", 1, List.of(), null).andExpect(status().isOk());
        submit(w.devToken(), w, projectId, b).andExpect(status().isOk());

        String dueBefore = jdbc.queryForObject("SELECT CAST(due_date AS text) FROM work_items WHERE id = ?", String.class, b);
        reopen(w.pmToken(), w, projectId, a, "Regression found").andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT state FROM work_items WHERE id = ?", String.class, b)).isEqualTo("IN_REVIEW"); // not reversed
        assertThat(jdbc.queryForObject("SELECT dependency_flag_reason FROM work_items WHERE id = ?", String.class, b)).contains("reopened");
        assertThat(jdbc.queryForObject("SELECT CAST(due_date AS text) FROM work_items WHERE id = ?", String.class, b)).isEqualTo(dueBefore);
        JsonNode board = json(mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{p}/dependencies", w.org(), projectId), w.pmToken()))
                .andExpect(status().isOk()).andReturn());
        assertThat(texts(board.path("flags"), "work_item_id")).containsExactly(b);

        mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/work-items/{i}/dependency-flag/clear", w.org(), projectId, b), w.pmToken())
                .contentType("application/json").content("{\"expected_version\":" + version(w, projectId, b) + "}")).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT dependency_flagged_at IS NULL FROM work_items WHERE id = ?", Boolean.class, b)).isTrue();
    }

    @Test
    @Tag("T24")
    @DisplayName("Removing or cancelling a predecessor needs explicit treatment of its links (drop or bridge)")
    void predecessorRemovalNeedsExplicitLinkTreatment() throws Exception {
        World w = world("dep4");
        String projectId = setupProject(w, "DEPFOU", null, "1", "2", "3");
        List<String> t = leafIds(w, projectId);
        // A draft made before the links appear is still refused at approval.
        String late = json(draft(w, projectId, 1, "{\"kind\":\"REMOVE\",\"work_item_id\":\"" + t.get(0) + "\"}").andExpect(status().isCreated())
                .andReturn()).path("id").asText();
        link(w, projectId, t.get(1), t.get(0)).andExpect(status().isCreated()); // A -> B
        link(w, projectId, t.get(2), t.get(1)).andExpect(status().isCreated()); // B -> C
        approve(w.pmToken(), w, projectId, late, 0).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LINKS_NEED_TREATMENT"));

        draft(w, projectId, 1, "{\"kind\":\"REMOVE\",\"work_item_id\":\"" + t.get(1) + "\"}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LINKS_NEED_TREATMENT"));
        draft(w, projectId, 1, "{\"kind\":\"CANCEL\",\"work_item_id\":\"" + t.get(1) + "\"}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LINKS_NEED_TREATMENT"));

        release(w, projectId, t.get(1), "SOMETHING").andExpect(status().isBadRequest());
        JsonNode bridged = json(release(w, projectId, t.get(1), "BRIDGE").andExpect(status().isOk()).andReturn());
        assertThat(texts(bridged.path("affected"), "id")).containsExactly(t.get(2));
        assertThat(count("SELECT count(*) FROM work_item_dependencies WHERE predecessor_id = ? AND successor_id = ?", t.get(0), t.get(2))).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM work_item_dependencies WHERE predecessor_id = ? OR successor_id = ?", t.get(1), t.get(1))).isZero();
        draft(w, projectId, 1, "{\"kind\":\"REMOVE\",\"work_item_id\":\"" + t.get(1) + "\"}").andExpect(status().isCreated());
    }

    @Test
    @Tag("T21")
    @DisplayName("3.4: open blockers across readable projects, critical first, with affected work; one blocker by id; foreign = 404")
    void blockersAcrossProjects() throws Exception {
        World w = world("ob");
        String projectId = setupProject(w, "OBONE", null, "1", "2");
        List<String> t = leafIds(w, projectId);
        link(w, projectId, t.get(1), t.get(0)).andExpect(status().isCreated());
        blocker(w, w.pmToken(), projectId, t.get(1), "NORMAL", w.qa(), "Waiting on design").andExpect(status().isCreated());
        String critical = json(blocker(w, w.pmToken(), projectId, t.get(0), "CRITICAL", w.qa(), "Vendor API down")
                .andExpect(status().isCreated()).andReturn()).path("blocker").path("id").asText();

        JsonNode open = json(mockMvc.perform(auth(get("/v1/organizations/{org}/blockers", w.org()), w.pmToken())).andExpect(status().isOk()).andReturn());
        assertThat(open).hasSize(2);
        assertThat(open.get(0).path("blocker").path("severity").asText()).isEqualTo("CRITICAL");
        assertThat(texts(open.get(0).path("affected"), "id")).containsExactly(t.get(1));
        assertThat(open.get(0).path("can_resolve").asBoolean()).isTrue();
        JsonNode asOwner = json(mockMvc.perform(auth(get("/v1/organizations/{org}/blockers/{b}", w.org(), critical), w.qaToken()))
                .andExpect(status().isOk()).andReturn());
        assertThat(asOwner.path("can_resolve").asBoolean()).isTrue(); // the owner clears it
        assertThat(json(mockMvc.perform(auth(get("/v1/organizations/{org}/blockers", w.org()), w.leadToken())).andReturn())).isEmpty();
        mockMvc.perform(auth(get("/v1/organizations/{org}/blockers/{b}", w.org(), critical), w.leadToken())).andExpect(status().isNotFound());
        World other = world("ob-b");
        mockMvc.perform(auth(get("/v1/organizations/{org}/blockers/{b}", other.org(), critical), other.pmToken())).andExpect(status().isNotFound());
    }

    private ResultActions link(World w, String projectId, String successor, String predecessor) throws Exception {
        return link(w, projectId, successor, predecessor, version(w, projectId, successor));
    }

    private ResultActions link(World w, String projectId, String successor, String predecessor, int version) throws Exception {
        return mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/work-items/{i}/dependencies", w.org(), projectId, successor), w.pmToken())
                .contentType("application/json").content("{\"predecessor_id\":\"" + predecessor + "\",\"expected_version\":" + version + "}"));
    }

    private ResultActions release(World w, String projectId, String itemId, String treatment) throws Exception {
        return mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/work-items/{i}/dependencies/release", w.org(), projectId, itemId), w.pmToken())
                .contentType("application/json").content("{\"treatment\":\"" + treatment + "\",\"expected_version\":" + version(w, projectId, itemId) + "}"));
    }

    private ResultActions blocker(World w, String token, String projectId, String itemId, String severity, UUID owner, String reason) throws Exception {
        String body = "{\"reason\":" + objectMapper.writeValueAsString(reason) + ",\"severity\":\"" + severity + "\""
                + (owner == null ? "" : ",\"owner_membership_id\":\"" + owner + "\"") + ",\"expected_version\":" + version(w, projectId, itemId) + "}";
        return mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/work-items/{i}/blockers", w.org(), projectId, itemId), token)
                .contentType("application/json").content(body));
    }

    private ResultActions resolve(String token, World w, String projectId, String itemId, String blockerId, String resolution, int version) throws Exception {
        return mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/work-items/{i}/blockers/{b}/resolve", w.org(), projectId, itemId, blockerId), token)
                .contentType("application/json")
                .content("{\"resolution\":" + objectMapper.writeValueAsString(resolution) + ",\"expected_version\":" + version + "}"));
    }

    private int version(World w, String projectId, String itemId) throws Exception {
        for (JsonNode node : workItems(w, projectId)) if (node.path("id").asText().equals(itemId)) return node.path("version").asInt();
        throw new AssertionError("no item " + itemId);
    }

    private ResultActions submit(String token, World w, String projectId, String itemId) throws Exception {
        return mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/work-items/{i}/submit", w.org(), projectId, itemId), token)
                .contentType("application/json").content("{\"expected_version\":" + version(w, projectId, itemId) + "}"));
    }

    private ResultActions decide(String token, World w, String projectId, String itemId, String action, int revision, List<String> checks,
            String note) throws Exception {
        return decide(token, w, projectId, itemId, action, revision, checks, note, version(w, projectId, itemId));
    }

    private ResultActions decide(String token, World w, String projectId, String itemId, String action, int revision, List<String> checks,
            String note, int version) throws Exception {
        String body = "{\"reviewed_revision\":" + revision + ",\"passed_check_ids\":" + objectMapper.writeValueAsString(checks)
                + (note == null ? "" : ",\"note\":" + objectMapper.writeValueAsString(note)) + ",\"expected_version\":" + version + "}";
        return mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/work-items/{i}/" + action, w.org(), projectId, itemId), token)
                .contentType("application/json").content(body));
    }

    private ResultActions reopen(String token, World w, String projectId, String itemId, String reason) throws Exception {
        return mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/work-items/{i}/reopen", w.org(), projectId, itemId), token)
                .contentType("application/json")
                .content("{\"reason\":" + objectMapper.writeValueAsString(reason) + ",\"expected_version\":" + version(w, projectId, itemId) + "}"));
    }

    private JsonNode progress(World w, String projectId) throws Exception {
        return json(mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{p}/progress", w.org(), projectId), w.pmToken()))
                .andExpect(status().isOk()).andReturn());
    }

    private ResultActions draft(World w, String projectId, int base, String... changes) throws Exception {
        String body = "{\"reason\":\"Scope change\",\"expected_base_version\":" + base + ",\"changes\":[" + String.join(",", changes) + "]}";
        return mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/scope-versions", w.org(), projectId), w.pmToken())
                .contentType("application/json").content(body));
    }

    private ResultActions approve(String token, World w, String projectId, String versionId, int version) throws Exception {
        return mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/scope-versions/{v}/approve", w.org(), projectId, versionId), token)
                .contentType("application/json").content("{\"expected_version\":" + version + "}"));
    }

    private JsonNode scopeVersions(World w, String projectId) throws Exception {
        return json(mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{p}/scope-versions", w.org(), projectId), w.pmToken()))
                .andExpect(status().isOk()).andReturn());
    }

    private JsonNode workItems(World w, String projectId) throws Exception {
        return json(mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}/work-items", w.org(), projectId), w.pmToken()))
                .andExpect(status().isOk()).andReturn());
    }

    private List<String> leafIds(World w, String projectId) throws Exception {
        List<String> ids = new ArrayList<>();
        workItems(w, projectId).forEach(node -> { if (node.path("leaf").asBoolean()) ids.add(node.path("id").asText()); });
        return ids;
    }

    /* ================================================================== fixture */

    private record Person(UUID id, String email, String token) {}

    private record World(UUID org, String ownerToken, UUID pm, String pmToken, UUID lead, String leadEmail, String leadToken,
            UUID dev, String devEmail, String devToken, UUID qa, String qaEmail, String qaToken, UUID ownerId, String pmEmail) {}

    private World world(String slug) throws Exception {
        Person owner = person(slug + "-owner");
        String unique = slug + "-" + UUID.randomUUID().toString().substring(0, 6);
        UUID org = UUID.fromString(json(mockMvc.perform(auth(post("/v1/organizations"), owner.token()).contentType("application/json")
                        .content("{\"name\":\"" + unique + "\",\"slug\":\"" + unique + "\",\"timezone\":\"Europe/London\",\"calendar\":{}}"))
                .andExpect(status().isCreated()).andReturn()).path("id").asText());
        Person pm = person(slug + "-pm");
        Person lead = person(slug + "-lead");
        Person dev = person(slug + "-dev");
        Person qa = person(slug + "-qa");
        UUID pmM = member(org, pm.id(), "PROJECT_MANAGER", PM_ROLE);
        UUID leadM = member(org, lead.id(), "TEAM_LEAD", LEAD_ROLE);
        UUID devM = member(org, dev.id(), "DEVELOPER", DEV_ROLE);
        UUID qaM = member(org, qa.id(), "QA_REVIEWER", QA_ROLE);
        return new World(org, switchTo(owner.token(), org), pmM, switchTo(pm.token(), org), leadM, lead.email(),
                switchTo(lead.token(), org), devM, dev.email(), switchTo(dev.token(), org), qaM, qa.email(),
                switchTo(qa.token(), org), owner.id(), pm.email());
    }

    private String setupProject(World w, String key) throws Exception {
        return setupProject(w, key, null);
    }

    private String setupProject(World w, String key, UUID team) throws Exception {
        return setupProject(w, key, team, "5", "3");
    }

    /** One phase with one task per given points value. */
    private String setupProject(World w, String key, UUID team, String... points) throws Exception {
        String[] tasks = new String[points.length];
        for (int i = 0; i < points.length; i++) tasks[i] = task("Task " + (i + 1), points[i], w.qa());
        String doc = upload(w, w.pmToken(), key + ".txt", "text/plain", key.getBytes());
        String teamJson = team == null ? "" : ",\"team_id\":\"" + team + "\"";
        String body = "{\"project\":{\"name\":\"" + key + " project\",\"key\":\"" + key + "\",\"mode\":\"STRUCTURED\",\"status\":\"ACTIVE\""
                + ",\"project_manager_membership_id\":\"" + w.pm() + "\"" + teamJson + "},\"document_ids\":[\"" + doc + "\"],\"phases\":"
                + phases(phase("Phase 1", tasks)) + "}";
        return json(mockMvc.perform(auth(post("/v1/organizations/{org}/projects/configured", w.org()), w.pmToken())
                        .contentType("application/json").content(body))
                .andExpect(status().isCreated()).andReturn()).path("project").path("id").asText();
    }

    private ResultActions configured(World w, String token, String key, List<String> docs, String phasesJson) throws Exception {
        StringBuilder ids = new StringBuilder("[");
        for (int i = 0; i < docs.size(); i++) ids.append(i == 0 ? "" : ",").append('"').append(docs.get(i)).append('"');
        String body = "{\"project\":{\"name\":\"" + key + " project\",\"key\":\"" + key + "\",\"mode\":\"STRUCTURED\"},\"document_ids\":"
                + ids.append("]") + ",\"phases\":" + phasesJson + "}";
        return mockMvc.perform(auth(post("/v1/organizations/{org}/projects/configured", w.org()), token)
                .contentType("application/json").content(body));
    }

    private static String phases(String... phases) {
        return "[" + String.join(",", phases) + "]";
    }

    private static String phase(String title, String... tasks) {
        return "{\"title\":\"" + title + "\",\"tasks\":[" + String.join(",", tasks) + "]}";
    }

    private static String task(String title, String points, UUID reviewer) {
        return "{\"title\":\"" + title + "\",\"points\":" + points
                + (reviewer == null ? "" : ",\"reviewer_membership_id\":\"" + reviewer + "\"") + "}";
    }

    private String upload(World w, String token, String name, String type, byte[] bytes) throws Exception {
        return json(mockMvc.perform(auth(post("/v1/organizations/{org}/project-documents", w.org()), token)
                        .param("file_name", name).contentType(type).content(bytes))
                .andExpect(status().isCreated()).andReturn()).path("id").asText();
    }

    private ResultActions add(World w, String projectId, String type, String parent, String title, String points) throws Exception {
        String body = "{\"type\":\"" + type + "\",\"title\":\"" + title + "\""
                + (parent == null ? "" : ",\"parent_id\":\"" + parent + "\"") + (points == null ? "" : ",\"points\":" + points) + "}";
        return mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/work-items", w.org(), projectId), w.pmToken())
                .contentType("application/json").content(body));
    }

    private ResultActions assign(String token, World w, String projectId, String itemId, UUID assignee, int version) throws Exception {
        return mockMvc.perform(auth(post("/v1/organizations/{org}/projects/{p}/work-items/{i}/assignment", w.org(), projectId, itemId), token)
                .contentType("application/json")
                .content("{\"assignee_membership_id\":\"" + assignee + "\",\"expected_version\":" + version + "}"));
    }

    private List<String> itemIds(World w, String projectId) throws Exception {
        return texts(json(mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}/work-items", w.org(), projectId), w.pmToken()))
                .andReturn()), "id");
    }

    private String id(ResultActions result) throws Exception {
        String body = result.andReturn().getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(body);
        return node.has("id") ? node.path("id").asText() : null;
    }

    private UUID team(World w, UUID lead, UUID... members) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO teams (id, org_id, name, lead_membership_id) VALUES (?, ?, ?, ?)", id, w.org(), "Team " + id, lead);
        for (UUID member : members) {
            jdbc.update("INSERT INTO team_members (team_id, org_id, membership_id, added_by) VALUES (?, ?, ?, ?)", id, w.org(), member, w.ownerId());
        }
        return id;
    }

    private UUID member(UUID org, UUID userId, String template, UUID role) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, ?)", id, org, userId, template);
        jdbc.update("INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by) VALUES (gen_random_uuid(), ?, ?, ?, 'ORG', ?)",
                org, id, role, userId);
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

    private static List<String> texts(JsonNode array, String field) {
        List<String> values = new ArrayList<>();
        array.forEach(node -> values.add(node.path(field).asText()));
        return values;
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
