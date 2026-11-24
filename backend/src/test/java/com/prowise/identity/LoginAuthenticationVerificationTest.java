package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Connection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;

import db.migration.V22__task_1_1_disable_published_seed_credentials;

/**
 * Approved decision D4 (Phase 2): the logins seeded with published passwords cannot authenticate, through either
 * login endpoint, and legitimate accounts keep working with the correct role routing.
 *
 * <p>Each test re-creates the seeded rows exactly as migrations V7, V9, V10 and V11 (published hashes) and the old
 * development initializer (fresh salts of the same published passwords) left them, then applies the V22 logic.
 */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Tag("NFR-06")
class LoginAuthenticationVerificationTest {

    /** Hashes published in migrations V10 and V11. */
    private static final String V10_SUPER_ADMIN_HASH = "$2a$10$ABz3pFpyw3NC.JhRjL7fZeF7a1Ua2.N/9U4LaMvYXkmyxmchBuxHy";
    private static final String V11_OPERATOR_HASH = "$2a$10$Pookry5OLzVHFp7uq7C04ed9EUr/WES2UzKll5CSx3s5.BWS2iH4i";
    private static final String V11_DEVELOPER_HASH = "$2a$10$dM.NruQ8EOkAyrfyF/2xa.vOwE5EUD62ahGoiWId4Af6FlbzVu.Mi";
    /** Hash published in migrations V7 and V9 for platform_operators. */
    private static final String V7_OPERATOR_HASH = "$2a$10$4b0rjVL9OrfiXT2yXc11c.x5Q.wK12FsTd/UzkoOtp2GKu7ujVdQK";

    @Autowired private MockMvc mockMvc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private DataSource dataSource;

    /**
     * The dev seeder is a dev-profile bean (it must never run in test or production contexts), so this
     * test creates the same accounts explicitly before verifying that each of them can sign in.
     */
    @BeforeEach
    void recreateSeededAccountsAndApplyV22() throws Exception {
        TestDatabase.clean(jdbc);
        for (Map.Entry<String, String> seed : PublishedSeedCredentials.USER_ACCOUNTS.entrySet()) {
            String hash = switch (seed.getValue()) {
                case PublishedSeedCredentials.SUPER_ADMIN -> V10_SUPER_ADMIN_HASH;
                case PublishedSeedCredentials.OPERATOR -> V11_OPERATOR_HASH;
                case PublishedSeedCredentials.DEVELOPER -> V11_DEVELOPER_HASH;
                default -> passwordEncoder.encode(seed.getValue()); // the initializer re-hashed these
            };
            String role = seed.getKey().startsWith("superadmin") ? "SUPER_ADMIN"
                    : seed.getKey().contains("operator") ? "PLATFORM_OPERATOR" : "DEVELOPER";
            insertUser(seed.getKey(), hash, role);
        }
        upsertOperator("op-main-1", "main.operator@prowise.io", "MAIN_PLATFORM_OPERATOR", null);
        upsertOperator("op-2", "operator@prowise.io", "DEPARTMENT_OPERATOR", "site-reliability");
        // An open session that V22 must revoke.
        jdbc.update("INSERT INTO sessions (id, user_id, refresh_token_hash, family_id, expires_at) "
                        + "SELECT gen_random_uuid(), id, 'seed-session', gen_random_uuid(), now() + interval '1 day' "
                        + "FROM users WHERE lower(email) = 'superadmin@prowise.com'");
        runV22();
    }

    @Test
    @DisplayName("Every seeded user login with its published password is refused on /v1/auth/login")
    void seededUserCredentialsCannotAuthenticate() throws Exception {
        for (Map.Entry<String, String> seed : PublishedSeedCredentials.USER_ACCOUNTS.entrySet()) {
            mockMvc.perform(post("/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                            .content(credentials(seed.getKey(), seed.getValue())))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("ACCOUNT_DISABLED"))
                    .andExpect(jsonPath("$.access_token").doesNotExist());
        }
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM users WHERE status = 'DISABLED' AND lower(email) = ANY (?)", Integer.class,
                (Object) PublishedSeedCredentials.USER_ACCOUNTS.keySet().toArray(String[]::new)))
                .isEqualTo(PublishedSeedCredentials.USER_ACCOUNTS.size());
    }

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token").isNotEmpty())
                .andExpect(jsonPath("$.refresh_token").doesNotExist()) // only in the httpOnly cookie
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie().httpOnly("prowise_refresh_token", true))
                .andExpect(jsonPath("$.must_change_password").value(false))
                .andExpect(jsonPath("$.target_dashboard_url").value("/super-admin/dashboard"))
                .andExpect(jsonPath("$.user.email").value("superadmin@prowise.com"))
                .andExpect(jsonPath("$.user.role").value("SUPER_ADMIN"))
                .andReturn();

    @Test
    @DisplayName("V22 revokes sessions, writes audit rows, keeps hashes and is idempotent")
    void v18RevokesSessionsAuditsAndIsIdempotent() throws Exception {
        assertThat(jdbc.queryForObject("SELECT count(*) FROM sessions WHERE revoked_at IS NULL", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM auth_audit_logs WHERE action = 'SEED_CREDENTIAL_DISABLED' "
                + "AND created_at > now() - interval '1 minute'", Integer.class))
                .isGreaterThanOrEqualTo(PublishedSeedCredentials.USER_ACCOUNTS.size());
        assertThat(jdbc.queryForObject("SELECT password_hash FROM users WHERE lower(email) = 'superadmin@prowise.com'", String.class))
                .isEqualTo(V10_SUPER_ADMIN_HASH); // disabled, never reset
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users", Integer.class))
                .isEqualTo(PublishedSeedCredentials.USER_ACCOUNTS.size()); // nothing deleted

        V22__task_1_1_disable_published_seed_credentials.Result second = runV22();
        assertThat(second.disabledUsers()).isEmpty();
        assertThat(second.suspendedOperators()).isEmpty();
    }

    @Test
    @DisplayName("A seeded address whose owner chose another password is a legitimate account and stays usable")
    void seededAddressWithChangedPasswordIsLeftAlone() throws Exception {
        TestDatabase.clean(jdbc);
        String ownPassword = "Her-Own-Chosen-Pass-1";
        insertUser("dr.sarah.lin@acmehealth.com", passwordEncoder.encode(ownPassword), "DEVELOPER");

        V22__task_1_1_disable_published_seed_credentials.Result result = runV22();

        assertThat(result.disabledUsers()).isEmpty();
        mockMvc.perform(post("/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(credentials("dr.sarah.lin@acmehealth.com", ownPassword)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Provisioned accounts sign in and are routed by role; wrong passwords get 401")
    void provisionedAccountsAreRoutedByRole() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        insertUser("admin-" + suffix + "@test.prowise", passwordEncoder.encode("Admin-Test-Password-1"), "SUPER_ADMIN");
        UUID orgId = UUID.randomUUID();
        jdbc.update("INSERT INTO organizations (id, name, slug, timezone, state, work_calendar) "
                + "VALUES (?, 'Routing Org', ?, 'UTC', 'ACTIVE', '{}'::jsonb)", orgId, "routing-" + suffix);
        UUID devId = insertUser("dev-" + suffix + "@test.prowise", passwordEncoder.encode("Developer-Test-Pass-1"), "DEVELOPER");
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template, status) VALUES (gen_random_uuid(), ?, ?, 'DEVELOPER', 'ACTIVE')",
                orgId, devId);

        mockMvc.perform(post("/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(credentials("admin-" + suffix + "@test.prowise", "Admin-Test-Password-1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token").isNotEmpty())
                .andExpect(jsonPath("$.refresh_token").doesNotExist()) // only in the httpOnly cookie
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie().httpOnly("prowise_refresh_token", true))
                .andExpect(jsonPath("$.must_change_password").value(false))
                .andExpect(jsonPath("$.target_dashboard_url").value("/platform-operator/dashboard"))
                .andExpect(jsonPath("$.user.email").value("operator@prowise.io"))
                .andExpect(jsonPath("$.user.role").value("PLATFORM_OPERATOR"))
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        String accessToken = response.get("access_token").asText();

        // Verify authorized access to operational telemetry using the generated JWT Bearer token
        mockMvc.perform(get("/api/v1/operator/dashboard/stats")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("3. Platform Operator: Authenticate via dedicated POST /api/v1/auth/operator/login")
    void testPlatformOperatorDedicatedLogin() throws Exception {
        String payload = """
                {
                    "email": "operator@prowise.io",
                    "password": "Operator2026!",
                    "remember_me": true
                }
                """;

        mockMvc.perform(post("/api/v1/auth/operator/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token").isNotEmpty())
                .andExpect(jsonPath("$.operator.email").value("operator@prowise.io"))
                .andExpect(jsonPath("$.operator.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("4. Developer: Authenticate via POST /api/auth/login and verify JWT + Organization workspace redirect")
    void testDeveloperLogin() throws Exception {
        String payload = objectMapper.writeValueAsString(new AuthController.Credentials(
                "alex.rivera@acmehealth.com",
                "Developer2026!"
        ));

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token").isNotEmpty())
                .andExpect(jsonPath("$.refresh_token").doesNotExist()) // only in the httpOnly cookie
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie().httpOnly("prowise_refresh_token", true))
                .andExpect(jsonPath("$.must_change_password").value(false))
                .andExpect(jsonPath("$.target_dashboard_url").value("/org/0a000000-0000-4000-8000-00000000000a/developer/dashboard"))
                .andExpect(jsonPath("$.user.email").value("alex.rivera@acmehealth.com"))
                .andExpect(jsonPath("$.user.role").value("DEVELOPER"))
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        String accessToken = response.get("access_token").asText();

        // Verify authorized access to developer projects endpoint
        mockMvc.perform(get("/api/v1/developer/projects")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("5. Password mismatch rejects with 401 UNAUTHORIZED")
    void testInvalidCredentialsRejected() throws Exception {
        String payload = objectMapper.writeValueAsString(new AuthController.Credentials(
                "superadmin@prowise.com",
                "WrongPassword123!"
        ));

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("A users-table PLATFORM_OPERATOR without an active operator row gets no operator authority")
    void usersTableOperatorWithoutOperatorRowGetsNoOperatorAuthority() throws Exception {
        String email = "orphan-op-" + UUID.randomUUID().toString().substring(0, 8) + "@test.prowise";
        insertUser(email, passwordEncoder.encode("Orphan-Operator-Pass-1"), "PLATFORM_OPERATOR");

        String token = accessToken(mockMvc.perform(post("/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(credentials(email, "Orphan-Operator-Pass-1")))
                .andExpect(status().isOk()).andReturn());

        assertThat(token).isNotBlank();
        mockMvc.perform(get("/v1/operator/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/v1/operators").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("A users-table operator acts with its own department access level, never MAIN")
    void usersTableDepartmentOperatorIsNotMain() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String email = "dept-op-" + suffix + "@test.prowise";
        insertUser(email, passwordEncoder.encode("Department-Op-Pass-1"), "PLATFORM_OPERATOR");
        jdbc.update("""
                INSERT INTO platform_operators (id, name, email, role_id, access_level, department_id, status,
                    password_hash, password_setup_completed)
                VALUES (?, 'Dept Op', ?, 'role-platform-operator', 'DEPARTMENT_OPERATOR', 'finance-tax', 'ACTIVE', ?, true)
                """, "op-t-" + suffix, email, passwordEncoder.encode("Department-Op-Pass-1"));
        try {
            String token = accessToken(mockMvc.perform(post("/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                            .content(credentials(email, "Department-Op-Pass-1")))
                    .andExpect(status().isOk()).andReturn());
            String payload = new String(java.util.Base64.getUrlDecoder().decode(token.split("\\.")[1]),
                    java.nio.charset.StandardCharsets.UTF_8);
            assertThat(payload).contains("\"accessLevel\":\"DEPARTMENT_OPERATOR\"").doesNotContain("MAIN_PLATFORM_OPERATOR");
        } finally {
            jdbc.update("DELETE FROM platform_operators WHERE id = ?", "op-t-" + suffix);
        }
    }

    private V22__task_1_1_disable_published_seed_credentials.Result runV22() throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            return V22__task_1_1_disable_published_seed_credentials.disablePublishedSeedCredentials(connection);
        }
    }

    private UUID insertUser(String email, String hash, String role) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, password_hash, name, role, status, must_change_password) "
                + "VALUES (?, ?, ?, ?, ?, 'ACTIVE', false)", id, email, hash, email.split("@")[0], role);
        return id;
    }

    private void upsertOperator(String id, String email, String accessLevel, String department) {
        jdbc.update("""
                INSERT INTO platform_operators (id, name, email, role_id, access_level, department_id, status,
                    password_hash, password_setup_completed)
                VALUES (?, 'Seeded Operator', ?, 'role-platform-operator', ?, ?, 'ACTIVE', ?, true)
                ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', password_hash = EXCLUDED.password_hash,
                    password_setup_completed = true
                """, id, email, accessLevel, department, V7_OPERATOR_HASH);
    }

    private String credentials(String email, String password) throws Exception {
        return objectMapper.writeValueAsString(Map.of("email", email, "password", password));
    }

    private String accessToken(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("access_token").asText();
    }
}
