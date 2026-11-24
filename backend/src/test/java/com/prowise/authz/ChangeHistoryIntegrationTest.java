package com.prowise.authz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

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

/**
 * Task 1.4 acceptance over the real HTTP stack and PostgreSQL: optimistic concurrency (expectedVersion),
 * Idempotency-Key replay, append-only audit, and T07 audit records for role changes and member disable.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T07")
@Tag("NFR-04")
class ChangeHistoryIntegrationTest {

    private static final String SECRET_WORDS = "(?is).*(password|token|secret|hash|bearer|cookie).*";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper objectMapper;
    @Autowired private com.prowise.identity.AccountTokenService accountTokens;

    @BeforeEach
    @AfterEach
    void cleanDatabase() {
        TestDatabase.clean(jdbc);
    }

    /* ---------------- race: one wins, the other gets 409 STALE_VERSION ---------------- */

    @Test
    void concurrentConflictingRoleEditsOneWinsOtherGetsStaleVersion() throws Exception {
        Org org = organization("race");
        String roleId = createRole(org, "Release manager", null).path("id").asText();

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<MvcResult>> edits = new ArrayList<>();
        for (String name : List.of("Release manager A", "Release manager B")) {
            Callable<MvcResult> edit = () -> {
                start.await();
                return mockMvc.perform(auth(patch("/v1/organizations/{org}/roles/{role}", org.id(), roleId), org.token())
                        .contentType("application/json")
                        .content(roleBody(name, 0))).andReturn();
            };
            edits.add(pool.submit(edit));
        }
        start.countDown();
        List<MvcResult> results = new ArrayList<>();
        for (Future<MvcResult> edit : edits) results.add(edit.get(60, TimeUnit.SECONDS));
        pool.shutdown();

        List<Integer> statuses = results.stream().map(r -> r.getResponse().getStatus()).sorted().toList();
        assertThat(statuses).containsExactly(200, 409);
        MvcResult loser = results.stream().filter(r -> r.getResponse().getStatus() == 409).findFirst().orElseThrow();
        JsonNode error = json(loser);
        assertThat(error.path("code").asText()).isEqualTo("STALE_VERSION");
        assertThat(error.path("message").asText()).isNotBlank();
        assertThat(error.path("request_id").asText()).isNotBlank();
        assertThat(error.has("field_errors")).isTrue();

        assertThat(jdbc.queryForObject("SELECT version FROM roles WHERE id = ?::uuid", Long.class, roleId)).isEqualTo(1L);
        assertThat(auditCount(org.id(), "role.changed")).isEqualTo(1);
        assertThat(eventCount(org.id(), "RoleChanged")).isEqualTo(1);
    }

    @Test
    void staleExpectedVersionIsRejectedWithoutSideEffects() throws Exception {
        Org org = organization("stale");
        String roleId = createRole(org, "Auditor", null).path("id").asText();
        mockMvc.perform(auth(patch("/v1/organizations/{org}/roles/{role}", org.id(), roleId), org.token())
                .contentType("application/json").content(roleBody("Auditor 2", 0))).andExpect(status().isOk());

        mockMvc.perform(auth(patch("/v1/organizations/{org}/roles/{role}", org.id(), roleId), org.token())
                        .contentType("application/json").content(roleBody("Auditor 3", 0)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_VERSION"));

        assertThat(jdbc.queryForObject("SELECT name FROM roles WHERE id = ?::uuid", String.class, roleId))
                .isEqualTo("Auditor 2");
        assertThat(auditCount(org.id(), "role.changed")).isEqualTo(1);
    }

    /* ---------------- Idempotency-Key ---------------- */

    @Test
    void replayedIdempotencyKeyReturnsEarlierResultAndCreatesNoSecondRecord() throws Exception {
        Org org = organization("idem");
        String key = UUID.randomUUID().toString();

        MvcResult first = mockMvc.perform(roleCreate(org, "Support lead", key)).andExpect(status().isCreated()).andReturn();
        MvcResult replay = mockMvc.perform(roleCreate(org, "Support lead", key))
                .andExpect(status().isCreated())
                .andExpect(header().string("Idempotent-Replayed", "true"))
                .andReturn();

        assertThat(json(replay).path("id").asText()).isEqualTo(json(first).path("id").asText());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM roles WHERE org_id = ? AND name = 'Support lead'",
                Integer.class, org.id())).isEqualTo(1);
        assertThat(auditCount(org.id(), "role.created")).isEqualTo(1);
        assertThat(eventCount(org.id(), "RoleCreated")).isEqualTo(1);
    }

    @Test
    void sameIdempotencyKeyWithDifferentBodyIsConflict() throws Exception {
        Org org = organization("idem-diff");
        String key = UUID.randomUUID().toString();
        mockMvc.perform(roleCreate(org, "Ops lead", key)).andExpect(status().isCreated());

        mockMvc.perform(roleCreate(org, "Different name", key))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"))
                .andExpect(jsonPath("$.request_id").isNotEmpty());

        assertThat(jdbc.queryForObject("SELECT count(*) FROM roles WHERE org_id = ? AND NOT is_template",
                Integer.class, org.id())).isEqualTo(1);
    }

    @Test
    void failedRequestDoesNotBurnTheIdempotencyKey() throws Exception {
        Org org = organization("idem-fail");
        String key = UUID.randomUUID().toString();
        // Unknown permission key: 4xx, nothing stored, the same key can be used after fixing the request.
        mockMvc.perform(auth(post("/v1/organizations/{org}/roles", org.id()), org.token())
                        .header("Idempotency-Key", key).contentType("application/json")
                        .content("{\"name\":\"Broken\",\"permission_keys\":[\"no.such.key\"],\"expected_version\":0}"))
                .andExpect(status().is4xxClientError());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM idempotency_key", Integer.class)).isZero();
    }

    /* ---------------- append-only audit ---------------- */

    @Test
    void auditRowsCannotBeUpdatedOrDeleted() throws Exception {
        Org org = organization("append");
        assertThat(auditCount(org.id(), "organization.created")).isEqualTo(1);

        assertThatThrownBy(() -> jdbc.update("UPDATE audit_log SET action = 'tampered' WHERE org_id = ?", org.id()))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM audit_log WHERE org_id = ?", org.id()))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("append-only");
        assertThat(auditCount(org.id(), "organization.created")).isEqualTo(1);
    }

    /* ---------------- T07: role change and member disable each leave one safe record ---------------- */

    @Test
    void roleChangeWritesOneSafeAuditRecord() throws Exception {
        Org org = organization("t07-role");
        String roleId = createRole(org, "Reviewer", List.of("member.disable")).path("id").asText();
        mockMvc.perform(auth(patch("/v1/organizations/{org}/roles/{role}", org.id(), roleId), org.token())
                        .contentType("application/json").content(roleBody("Reviewer", 0)))
                .andExpect(status().isOk());

        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT actor_id, occurred_at, target_type, target_id, previous::text AS previous, new::text AS next,
                       request_id, metadata::text AS metadata
                FROM audit_log WHERE org_id = ? AND action = 'role.changed'
                """, org.id());
        assertThat(rows).hasSize(1);
        Map<String, Object> row = rows.get(0);
        assertThat(row.get("actor_id")).isEqualTo(org.ownerId());
        assertThat(row.get("occurred_at")).isNotNull();
        assertThat(row.get("target_type")).isEqualTo("ROLE");
        assertThat(row.get("target_id")).isEqualTo(UUID.fromString(roleId));
        assertThat(row.get("request_id")).isNotNull();
        assertThat((String) row.get("previous")).contains("member.disable");
        assertThat((String) row.get("next")).doesNotContain("member.disable");
        assertNoSecrets(row);
        assertThat(eventCount(org.id(), "RoleChanged")).isEqualTo(1);
    }

    @Test
    void memberDisableWritesOneSafeAuditRecordAndCutsAccess() throws Exception {
        Org org = organization("t07-member");
        Person dev = person("dev");
        UUID membership = UUID.randomUUID();
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, 'DEVELOPER')",
                membership, org.id(), dev.id());
        String devToken = switchTo(dev.token(), org.id());

        mockMvc.perform(auth(patch("/v1/organizations/{org}/members/{m}/status", org.id(), membership), org.token())
                        .contentType("application/json")
                        .content("{\"status\":\"DISABLED\",\"reason\":\"Left the team\",\"expected_version\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DISABLED"))
                .andExpect(jsonPath("$.version").value(1));

        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT actor_id, occurred_at, target_type, target_id, reason, previous::text AS previous,
                       new::text AS next, metadata::text AS metadata
                FROM audit_log WHERE org_id = ? AND action = 'member.disabled'
                """, org.id());
        assertThat(rows).hasSize(1);
        Map<String, Object> row = rows.get(0);
        assertThat(row.get("actor_id")).isEqualTo(org.ownerId());
        assertThat(row.get("occurred_at")).isNotNull();
        assertThat(row.get("target_type")).isEqualTo("MEMBERSHIP");
        assertThat(row.get("target_id")).isEqualTo(membership);
        assertThat(row.get("reason")).isEqualTo("Left the team");
        assertNoSecrets(row);
        assertThat(eventCount(org.id(), "MemberDisabled")).isEqualTo(1);

        // The disabled member's org-bound token no longer reaches the organization.
        mockMvc.perform(auth(get("/v1/me/permissions"), devToken)).andExpect(result ->
                assertThat(result.getResponse().getStatus()).isIn(401, 403, 404));

        // A second disable with the old version is a conflict and writes nothing.
        mockMvc.perform(auth(patch("/v1/organizations/{org}/members/{m}/status", org.id(), membership), org.token())
                        .contentType("application/json")
                        .content("{\"status\":\"ACTIVE\",\"expected_version\":0}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_VERSION"));
        assertThat(auditCount(org.id(), "member.enabled")).isZero();
    }

    @Test
    void memberDisableRefusesSelfOwnerAndForeignMembers() throws Exception {
        Org org = organization("t07-guard");
        Org other = organization("t07-other");
        UUID ownMembership = jdbc.queryForObject("SELECT id FROM memberships WHERE org_id = ? AND user_id = ?",
                UUID.class, org.id(), org.ownerId());
        UUID foreignMembership = jdbc.queryForObject("SELECT id FROM memberships WHERE org_id = ?", UUID.class, other.id());

        mockMvc.perform(auth(patch("/v1/organizations/{org}/members/{m}/status", org.id(), ownMembership), org.token())
                        .contentType("application/json").content("{\"status\":\"DISABLED\",\"expected_version\":0}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SELF_DISABLE_DENIED"));
        mockMvc.perform(auth(patch("/v1/organizations/{org}/members/{m}/status", org.id(), foreignMembership), org.token())
                        .contentType("application/json").content("{\"status\":\"DISABLED\",\"expected_version\":0}"))
                .andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM audit_log WHERE action LIKE 'member.%'", Integer.class))
                .isZero();
    }

    @Test
    void organizationCreationWritesAuditAndEventTogether() throws Exception {
        Org org = organization("t07-org");
        assertThat(auditCount(org.id(), "organization.created")).isEqualTo(1);
        assertThat(eventCount(org.id(), "OrganizationCreated")).isEqualTo(1);
        String payload = jdbc.queryForObject(
                "SELECT payload::text FROM outbox_event WHERE org_id = ? AND event_type = 'OrganizationCreated'",
                String.class, org.id());
        assertThat(payload).contains("\"event_id\"").contains("\"org_id\"").doesNotContainIgnoringCase("password");
    }

    /* ------------------------------------------------------------------ */

    record Person(UUID id, String email, String token) {}

    record Org(UUID id, UUID ownerId, String token) {}

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

    private JsonNode createRole(Org org, String name, List<String> keys) throws Exception {
        String keyJson = keys == null ? "[]" : objectMapper.writeValueAsString(keys);
        return json(mockMvc.perform(auth(post("/v1/organizations/{org}/roles", org.id()), org.token())
                        .contentType("application/json")
                        .content("{\"name\":\"" + name + "\",\"permission_keys\":" + keyJson + ",\"expected_version\":0}"))
                .andExpect(status().isCreated()).andReturn());
    }

    private MockHttpServletRequestBuilder roleCreate(Org org, String name, String idempotencyKey) {
        return auth(post("/v1/organizations/{org}/roles", org.id()), org.token())
                .header("Idempotency-Key", idempotencyKey)
                .contentType("application/json")
                .content("{\"name\":\"" + name + "\",\"permission_keys\":[],\"expected_version\":0}");
    }

    private static String roleBody(String name, long expectedVersion) {
        return "{\"name\":\"" + name + "\",\"permission_keys\":[],\"expected_version\":" + expectedVersion + "}";
    }

    private int auditCount(UUID orgId, String action) {
        return jdbc.queryForObject("SELECT count(*) FROM audit_log WHERE org_id = ? AND action = ?",
                Integer.class, orgId, action);
    }

    private int eventCount(UUID orgId, String type) {
        return jdbc.queryForObject("SELECT count(*) FROM outbox_event WHERE org_id = ? AND event_type = ?",
                Integer.class, orgId, type);
    }

    private static void assertNoSecrets(Map<String, Object> row) {
        for (Map.Entry<String, Object> column : row.entrySet()) {
            if (column.getValue() instanceof String text) {
                assertThat(text).as(column.getKey()).doesNotMatch(SECRET_WORDS);
            }
        }
    }

    private static MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder builder, String token) {
        return builder.header("Authorization", "Bearer " + token);
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }
}
