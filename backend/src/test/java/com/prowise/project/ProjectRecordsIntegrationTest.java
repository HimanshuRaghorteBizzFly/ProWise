package com.prowise.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;

/**
 * Task 2.1 acceptance over HTTP + PostgreSQL: T09 (required fields, unique key, valid dates, same-org owners),
 * T11 (solo project with one accountable developer, zero tasks, no invented percentage), the permitted list with
 * stable cursor paging, 404 for unreadable projects, expectedVersion and target-date history.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T09")
@Tag("T11")
class ProjectRecordsIntegrationTest {

    static final UUID DEVELOPER = UUID.fromString("10000000-0000-0000-0000-000000000005");
    static final UUID VIEWER = UUID.fromString("10000000-0000-0000-0000-000000000007");

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private com.prowise.identity.AccountTokenService accountTokens;

    @BeforeEach
    @AfterEach
    void clean() {
        TestDatabase.clean(jdbc);
    }

    /* ================================================================== T11 */

    @Test
    void newSoloProjectHasOneAccountableDeveloperZeroTasksAndNoPercentage() throws Exception {
        Org org = organization("solo");
        Person dev = person("dev");
        UUID devMembership = member(org.id(), dev.id(), "DEVELOPER", DEVELOPER, "ORG", null);

        JsonNode project = json(mockMvc.perform(auth(post("/v1/organizations/{org}/projects", org.id()), org.token())
                        .contentType("application/json")
                        .content(body("Customer portal", "crm", "INDIVIDUAL", devMembership, "2026-12-01", "2027-03-31")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.key").value("CRM"))
                .andExpect(jsonPath("$.mode").value("INDIVIDUAL"))
                .andExpect(jsonPath("$.lifecycle").value("PLANNED"))
                .andExpect(jsonPath("$.task_count").value(0))
                .andExpect(jsonPath("$.progress.percent").isEmpty())
                .andExpect(jsonPath("$.progress.label").value("Not reported"))
                .andExpect(jsonPath("$.accountable.membership_id").value(devMembership.toString()))
                .andExpect(jsonPath("$.target_on").value("2027-03-31"))
                .andExpect(jsonPath("$.timezone").value("Europe/London"))
                .andExpect(jsonPath("$.version").value(0))
                .andReturn());
        String id = project.path("id").asText();

        assertThat(jdbc.queryForObject("SELECT last_progress_percent FROM projects WHERE id = ?", java.math.BigDecimal.class, id)).isNull();
        assertThat(count("SELECT count(*) FROM work_items WHERE project_id = ?", id)).isZero();
        assertThat(jdbc.queryForObject("SELECT accountable_owner_id FROM projects WHERE id = ?", String.class, id))
                .isEqualTo(dev.id().toString()); // legacy column kept in sync for the Developer pages
        assertThat(count("SELECT count(*) FROM project_members WHERE project_id = ? AND membership_id = ?", id, devMembership)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM audit_log WHERE org_id = ? AND action = 'project.created'", org.id())).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE org_id = ? AND event_type = 'ProjectCreated'", org.id())).isEqualTo(1);

        // The accountable developer sees the project immediately (ready to report progress in 2.2).
        String devToken = switchTo(dev.token(), org.id());
        mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}", org.id(), id), devToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.progress.label").value("Not reported"));

        // An Individual project without an accountable developer is refused.
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects", org.id()), org.token()).contentType("application/json")
                        .content(body("No owner", "NOWN", "INDIVIDUAL", null, null, null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field_errors[0].field").value("accountable_membership_id"));
    }

    /* ================================================================== T09 */

    @Test
    void duplicateKeyInTheSameOrganizationIsRejected() throws Exception {
        Org org = organization("dup");
        Org other = organization("dup-other");
        create(org, "First", "CRM", "STRUCTURED", null);
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects", org.id()), org.token()).contentType("application/json")
                        .content(body("Second", "crm", "STRUCTURED", null, null, null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_PROJECT_KEY"))
                .andExpect(jsonPath("$.field_errors[0].field").value("key"))
                .andExpect(jsonPath("$.request_id").isNotEmpty());
        // Keys are unique per organization only.
        create(other, "Elsewhere", "CRM", "STRUCTURED", null);
        assertThat(count("SELECT count(*) FROM projects WHERE org_id = ?", org.id())).isEqualTo(1);
    }

    @Test
    void newProjectCannotStartInThePastAndTargetFollowsStart() throws Exception {
        Org org = organization("past");
        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Europe/London"));
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects", org.id()), org.token()).contentType("application/json")
                        .content(body("Past", "PAST", "STRUCTURED", null, today.minusDays(1).toString(), today.plusDays(10).toString())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field_errors[0].field").value("start_on"));
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects", org.id()), org.token()).contentType("application/json")
                        .content(body("Old target", "OLDT", "STRUCTURED", null, null, today.minusDays(1).toString())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field_errors[0].field").value("target_on"));
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects", org.id()), org.token()).contentType("application/json")
                        .content(body("Today", "TODAY", "STRUCTURED", null, today.toString(), today.toString())))
                .andExpect(status().isCreated());
        assertThat(count("SELECT count(*) FROM projects WHERE org_id = ?", org.id())).isEqualTo(1);
    }

    @Test
    void invalidDatesTimezoneAndRequiredFieldsAreRejected() throws Exception {
        Org org = organization("dates");
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects", org.id()), org.token()).contentType("application/json")
                        .content(body("Backwards", "BACK", "STRUCTURED", null, "2027-05-01", "2027-04-30")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_DATE_RANGE"))
                .andExpect(jsonPath("$.field_errors[0].field").value("target_on"));
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects", org.id()), org.token()).contentType("application/json")
                        .content("{\"name\":\"Zone\",\"key\":\"ZONE\",\"mode\":\"STRUCTURED\",\"timezone\":\"GMT+5\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field_errors[0].field").value("timezone"));
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects", org.id()), org.token()).contentType("application/json")
                        .content("{\"key\":\"NONAME\",\"mode\":\"STRUCTURED\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field_errors[0].field").value("name"));
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects", org.id()), org.token()).contentType("application/json")
                        .content("{\"name\":\"Bad key\",\"key\":\"1-bad\",\"mode\":\"STRUCTURED\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field_errors[0].field").value("key"));
        assertThat(count("SELECT count(*) FROM projects WHERE org_id = ?", org.id())).isZero();
    }

    @Test
    void foreignOwnerOrMemberIsRejected() throws Exception {
        Org org = organization("foreign");
        Org other = organization("foreign-b");
        UUID foreignMembership = jdbc.queryForObject("SELECT id FROM memberships WHERE org_id = ?", UUID.class, other.id());

        mockMvc.perform(auth(post("/v1/organizations/{org}/projects", org.id()), org.token()).contentType("application/json")
                        .content(body("Foreign owner", "FOWN", "INDIVIDUAL", foreignMembership, null, null)))
                .andExpect(status().isNotFound());
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects", org.id()), org.token()).contentType("application/json")
                        .content("{\"name\":\"Foreign member\",\"key\":\"FMEM\",\"mode\":\"STRUCTURED\",\"member_membership_ids\":[\""
                                + foreignMembership + "\"]}"))
                .andExpect(status().isNotFound());
        Person gone = person("gone");
        UUID disabled = member(org.id(), gone.id(), "DEVELOPER", DEVELOPER, "ORG", null);
        jdbc.update("UPDATE memberships SET status = 'DISABLED' WHERE id = ?", disabled);
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects", org.id()), org.token()).contentType("application/json")
                        .content(body("Disabled owner", "DOWN", "INDIVIDUAL", disabled, null, null)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MEMBER_INACTIVE"));
        assertThat(count("SELECT count(*) FROM projects WHERE org_id = ?", org.id())).isZero();
        // The database refuses a cross-organization owner as well.
        String id = create(org, "Real", "REAL", "STRUCTURED", null).path("id").asText();
        assertThatThrownBy(() -> jdbc.update("UPDATE projects SET accountable_membership_id = ? WHERE id = ?", foreignMembership, id))
                .isInstanceOf(DataAccessException.class);
    }

    /* ================================================================== permitted list and 404 */

    @Test
    void listReturnsOnlyPermittedProjectsAndUnreadableProjectsAre404() throws Exception {
        Org org = organization("perm");
        Org other = organization("perm-other");
        Person dev = person("perm-dev");
        UUID devMembership = member(org.id(), dev.id(), "DEVELOPER", DEVELOPER, "ORG", null);
        String assigned = create(org, "Assigned to dev", "ASG", "INDIVIDUAL", devMembership).path("id").asText();
        String hidden = create(org, "Not assigned", "HID", "STRUCTURED", null).path("id").asText();
        String scoped = create(org, "Viewer scoped", "VSC", "STRUCTURED", null).path("id").asText();
        Person viewer = person("perm-viewer");
        member(org.id(), viewer.id(), "VIEWER", VIEWER, "PROJECT", UUID.fromString(scoped));

        assertThat(ids(list(org.id(), org.token(), ""))).containsExactlyInAnyOrder(assigned, hidden, scoped);
        String devToken = switchTo(dev.token(), org.id());
        assertThat(ids(list(org.id(), devToken, ""))).containsExactly(assigned);
        String viewerToken = switchTo(viewer.token(), org.id());
        assertThat(ids(list(org.id(), viewerToken, ""))).containsExactly(scoped);

        // Unreadable project URLs are 404 with no metadata, for every non-permitted caller.
        MvcResult denied = mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}", org.id(), hidden), devToken))
                .andExpect(status().isNotFound()).andReturn();
        assertThat(denied.getResponse().getContentAsString()).doesNotContain("Not assigned").doesNotContain("HID");
        mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}", org.id(), assigned), viewerToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}", org.id(), scoped), other.token()))
                .andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/organizations/{org}/projects", org.id()), other.token()))
                .andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/organizations/{org}/projects/{id}", org.id(), UUID.randomUUID()), org.token()))
                .andExpect(status().isNotFound());
        // A project-scoped reader cannot edit, and cannot create.
        mockMvc.perform(auth(patch("/v1/organizations/{org}/projects/{id}", org.id(), scoped), viewerToken)
                        .contentType("application/json").content("{\"name\":\"Renamed\",\"expected_version\":0}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(auth(post("/v1/organizations/{org}/projects", org.id()), viewerToken).contentType("application/json")
                .content(body("Nope", "NOPE", "STRUCTURED", null, null, null))).andExpect(status().isForbidden());
        assertThat(count("SELECT count(*) FROM security_evidence WHERE target_type = 'PROJECT'", new Object[0])).isPositive();
        // Setup options (people and teams) need project.create or project.edit.
        mockMvc.perform(auth(get("/v1/organizations/{org}/projects/options", org.id()), org.token()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.default_timezone").value("Europe/London"));
        mockMvc.perform(auth(get("/v1/organizations/{org}/projects/options", org.id()), viewerToken))
                .andExpect(status().isForbidden());

        // Filters: search, mode, status, owner.
        assertThat(ids(list(org.id(), org.token(), "&q=scoped"))).containsExactly(scoped);
        assertThat(ids(list(org.id(), org.token(), "&mode=INDIVIDUAL"))).containsExactly(assigned);
        assertThat(ids(list(org.id(), org.token(), "&owner=" + devMembership))).containsExactly(assigned);
        assertThat(ids(list(org.id(), org.token(), "&status=ACTIVE"))).isEmpty();
    }

    @Test
    void cursorPaginationIsStableWithDuplicateNames() throws Exception {
        Org org = organization("page");
        String[] names = {"Same", "same", "Alpha", "Same", "beta", "Gamma", "alpha"};
        for (int i = 0; i < names.length; i++) create(org, names[i], "P" + i + "X", "STRUCTURED", null);

        List<String> first = walk(org, 3);
        List<String> second = walk(org, 3);
        assertThat(first).hasSize(names.length).doesNotHaveDuplicates().isEqualTo(second);
        List<String[]> expected = jdbc.query("SELECT id, lower(name) AS n FROM projects WHERE org_id = ?",
                (rs, n) -> new String[] {rs.getString("n"), rs.getString("id")}, org.id());
        expected.sort(Comparator.<String[], String>comparing(r -> r[0]).thenComparing(r -> r[1]));
        assertThat(first).isEqualTo(expected.stream().map(r -> r[1]).toList());
        mockMvc.perform(auth(get("/v1/organizations/{org}/projects", org.id()).param("cursor", "not-a-cursor"), org.token()))
                .andExpect(status().isBadRequest());
    }

    /* ================================================================== edits */

    @Test
    void staleExpectedVersionIsAConflict() throws Exception {
        Org org = organization("stale");
        String id = create(org, "Versioned", "VER", "STRUCTURED", null).path("id").asText();
        mockMvc.perform(auth(patch("/v1/organizations/{org}/projects/{id}", org.id(), id), org.token())
                        .contentType("application/json").content("{\"name\":\"Versioned 2\",\"expected_version\":0}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        mockMvc.perform(auth(patch("/v1/organizations/{org}/projects/{id}", org.id(), id), org.token())
                        .contentType("application/json").content("{\"name\":\"Versioned 3\",\"expected_version\":0}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_VERSION"))
                .andExpect(jsonPath("$.request_id").isNotEmpty());
        assertThat(jdbc.queryForObject("SELECT name FROM projects WHERE id = ?", String.class, id)).isEqualTo("Versioned 2");
        // Mode is not editable here (separate approved transition).
        mockMvc.perform(auth(patch("/v1/organizations/{org}/projects/{id}", org.id(), id), org.token())
                        .contentType("application/json").content("{\"mode\":\"INDIVIDUAL\",\"expected_version\":1}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MODE_CHANGE_NOT_ALLOWED"));
    }

    @Test
    void targetDateChangeNeedsPreviousDateAndReasonAndWritesHistory() throws Exception {
        Org org = organization("target");
        JsonNode created = json(mockMvc.perform(auth(post("/v1/organizations/{org}/projects", org.id()), org.token())
                        .contentType("application/json").content(body("Dated", "DAT", "STRUCTURED", null, "2026-12-01", "2027-01-31")))
                .andExpect(status().isCreated()).andReturn());
        String id = created.path("id").asText();
        String url = "/v1/organizations/{org}/projects/{id}";

        mockMvc.perform(auth(patch(url, org.id(), id), org.token()).contentType("application/json")
                        .content("{\"target_on\":\"2027-02-28\",\"previous_target_on\":\"2027-01-31\",\"expected_version\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TARGET_DATE_REASON_REQUIRED"));
        mockMvc.perform(auth(patch(url, org.id(), id), org.token()).contentType("application/json")
                        .content("{\"target_on\":\"2027-02-28\",\"previous_target_on\":\"2027-01-15\",\"target_date_reason\":\"Scope grew\",\"expected_version\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field_errors[0].field").value("previous_target_on"));
        mockMvc.perform(auth(patch(url, org.id(), id), org.token()).contentType("application/json")
                        .content("{\"target_on\":\"2026-11-01\",\"previous_target_on\":\"2027-01-31\",\"target_date_reason\":\"x\",\"expected_version\":0}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_DATE_RANGE"));
        assertThat(count("SELECT count(*) FROM project_date_history WHERE project_id = ?", id)).isZero();

        mockMvc.perform(auth(patch(url, org.id(), id), org.token()).contentType("application/json")
                        .content("{\"target_on\":\"2027-02-28\",\"previous_target_on\":\"2027-01-31\",\"target_date_reason\":\"Scope grew\",\"expected_version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.target_on").value("2027-02-28"));
        mockMvc.perform(auth(get(url + "/date-history", org.id(), id), org.token()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].previous_target_on").value("2027-01-31"))
                .andExpect(jsonPath("$[0].new_target_on").value("2027-02-28"))
                .andExpect(jsonPath("$[0].reason").value("Scope grew"));
        assertThat(count("SELECT count(*) FROM outbox_event WHERE org_id = ? AND event_type = 'ProjectTargetDateChanged'", org.id()))
                .isEqualTo(1);
        assertThatThrownBy(() -> jdbc.update("UPDATE project_date_history SET reason = 'edited' WHERE project_id = ?", id))
                .isInstanceOf(DataAccessException.class).hasMessageContaining("append-only");

        // Lifecycle: allowed moves need a reason; delivery is not an edit.
        mockMvc.perform(auth(patch(url, org.id(), id), org.token()).contentType("application/json")
                        .content("{\"lifecycle\":\"ACTIVE\",\"expected_version\":1}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(auth(patch(url, org.id(), id), org.token()).contentType("application/json")
                        .content("{\"lifecycle\":\"ACTIVE\",\"lifecycle_reason\":\"Kick-off done\",\"expected_version\":1}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.lifecycle").value("ACTIVE"));
        mockMvc.perform(auth(patch(url, org.id(), id), org.token()).contentType("application/json")
                        .content("{\"lifecycle\":\"DELIVERED\",\"lifecycle_reason\":\"done\",\"expected_version\":2}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("LIFECYCLE_TRANSITION_NOT_ALLOWED"));
    }

    /* ------------------------------------------------------------------ helpers */

    record Person(UUID id, String email, String token) {}

    record Org(UUID id, UUID ownerId, String token) {}

    private List<String> walk(Org org, int limit) throws Exception {
        List<String> seen = new ArrayList<>();
        String cursor = null;
        for (int guard = 0; guard < 20; guard++) {
            MockHttpServletRequestBuilder request = get("/v1/organizations/{org}/projects", org.id()).param("limit", String.valueOf(limit));
            if (cursor != null) request.param("cursor", cursor);
            JsonNode page = json(mockMvc.perform(auth(request, org.token())).andExpect(status().isOk()).andReturn());
            page.path("items").forEach(item -> seen.add(item.path("id").asText()));
            if (!page.path("has_more").asBoolean()) return seen;
            cursor = page.path("next_cursor").asText();
        }
        throw new AssertionError("pagination did not end");
    }

    private JsonNode list(UUID orgId, String token, String query) throws Exception {
        return json(mockMvc.perform(auth(get("/v1/organizations/" + orgId + "/projects?limit=100" + query), token))
                .andExpect(status().isOk()).andReturn());
    }

    private static List<String> ids(JsonNode page) {
        List<String> ids = new ArrayList<>();
        page.path("items").forEach(item -> ids.add(item.path("id").asText()));
        return ids;
    }

    private JsonNode create(Org org, String name, String key, String mode, UUID accountable) throws Exception {
        return json(mockMvc.perform(auth(post("/v1/organizations/{org}/projects", org.id()), org.token())
                        .contentType("application/json").content(body(name, key, mode, accountable, null, null)))
                .andExpect(status().isCreated()).andReturn());
    }

    private static String body(String name, String key, String mode, UUID accountable, String start, String target) {
        StringBuilder json = new StringBuilder("{\"name\":\"").append(name).append("\",\"key\":\"").append(key)
                .append("\",\"mode\":\"").append(mode).append("\",\"description\":\"Scope of ")
                .append(name.toLowerCase(Locale.ROOT)).append("\"");
        if (accountable != null) json.append(",\"accountable_membership_id\":\"").append(accountable).append("\"");
        if (start != null) json.append(",\"start_on\":\"").append(start).append("\"");
        if (target != null) json.append(",\"target_on\":\"").append(target).append("\"");
        return json.append("}").toString();
    }

    private UUID member(UUID orgId, UUID userId, String template, UUID templateRoleId, String scope, UUID scopeId) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, ?)", id, orgId, userId, template);
        jdbc.update("""
                INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, scope_id, granted_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), orgId, id, templateRoleId, scope, scopeId, userId);
        return id;
    }

    private Org organization(String slug) throws Exception {
        Person owner = person(slug + "-owner");
        String unique = slug + "-" + UUID.randomUUID().toString().substring(0, 6);
        String id = json(mockMvc.perform(auth(post("/v1/organizations"), owner.token()).contentType("application/json")
                        .content("{\"name\":\"" + unique + "\",\"slug\":\"" + unique + "\",\"timezone\":\"Europe/London\","
                                + "\"calendar\":{\"workdays\":[1,2,3,4,5],\"holidays\":[]}}"))
                .andExpect(status().isCreated()).andReturn()).path("id").asText();
        UUID orgId = UUID.fromString(id);
        return new Org(orgId, owner.id(), switchTo(owner.token(), orgId));
    }

    private Person person(String name) throws Exception {
        String email = name + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        // Signup returns 202 without a session (D9); verify through the real endpoint, then sign in.
        com.prowise.testsupport.TestAccounts.Account account = com.prowise.testsupport.TestAccounts.signUpVerifyAndLogin(
                mockMvc, jdbc, accountTokens, objectMapper, email, "Correct-Horse-Battery-1!");
        return new Person(account.id(), email, account.accessToken());
    }

    private String switchTo(String token, UUID orgId) throws Exception {
        return json(mockMvc.perform(auth(post("/v1/me/organizations/{org}/switch", orgId), token))
                .andExpect(status().isOk()).andReturn()).path("access_token").asText();
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
