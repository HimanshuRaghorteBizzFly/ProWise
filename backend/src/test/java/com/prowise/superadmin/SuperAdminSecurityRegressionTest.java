package com.prowise.superadmin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.identity.PublishedSeedCredentials;
import com.prowise.identity.RequestThrottle;
import com.prowise.identity.SuperAdminBootstrapService;

/**
 * Regressions for the Super Admin security review (2026-11-24):
 * no sign-in exception for any address, no anonymous access to Super Admin endpoints, secrets never returned
 * to the browser or writable from it, published passwords refused by the bootstrap, and the audit log list
 * (and the dashboard that embeds it) answering without a search term.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("NFR-06")
class SuperAdminSecurityRegressionTest {

    private static final String PASSWORD = "Regression-Pass-01!";
    /** The seeded address the removed exception special-cased. */
    private static final String SEEDED_ADDRESS = "superadmin@prowise.com";

    @Autowired private org.springframework.test.web.servlet.MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private RequestThrottle throttle;
    @Autowired private SuperAdminBootstrapService bootstrapService;

    private int ipCounter;

    @BeforeEach
    void setUp() {
        jdbc.update("DELETE FROM user_login_history");
        jdbc.update("DELETE FROM user_roles");
        TestDatabase.clean(jdbc);
        jdbc.update("DELETE FROM users WHERE lower(email) = lower(?)", SEEDED_ADDRESS);
        throttle.clear();
    }

    // ---------------------------------------------------------------- 1. no sign-in exception for any address

    @Test
    void thePublishedPasswordDoesNotOpenAnAccountWhoseRealPasswordIsDifferent() throws Exception {
        UUID id = superAdmin(SEEDED_ADDRESS, "ACTIVE", false);
        String hashBefore = hash(id);

        login(SEEDED_ADDRESS, PublishedSeedCredentials.SUPER_ADMIN).andExpect(status().isUnauthorized());

        assertThat(hash(id)).as("a failed sign-in never rewrites the stored password").isEqualTo(hashBefore);
        assertThat(jdbc.queryForObject("SELECT failed_login_count FROM users WHERE id = ?", Integer.class, id)).isEqualTo(1);
    }

    @Test
    void aDisabledSuperAdminStaysDisabledEvenWithTheRightPassword() throws Exception {
        UUID id = superAdmin(SEEDED_ADDRESS, "DISABLED", false);

        login(SEEDED_ADDRESS, PASSWORD).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_DISABLED"));

        assertThat(accountStatus(id)).isEqualTo("DISABLED");
    }

    @Test
    void aPendingSuperAdminIsNotActivatedBySigningIn() throws Exception {
        UUID id = superAdmin(SEEDED_ADDRESS, "PENDING_ACTIVATION", false);

        login(SEEDED_ADDRESS, PASSWORD).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_PENDING_ACTIVATION"));

        assertThat(accountStatus(id)).isEqualTo("PENDING_ACTIVATION");
    }

    @Test
    void aLockedSuperAdminStaysLocked() throws Exception {
        UUID id = superAdmin(SEEDED_ADDRESS, "ACTIVE", false);
        jdbc.update("UPDATE users SET failed_login_count = 5, locked_until = now() + interval '15 minutes' WHERE id = ?", id);

        login(SEEDED_ADDRESS, PASSWORD).andExpect(status().isLocked())
                .andExpect(jsonPath("$.code").value("ACCOUNT_LOCKED"));

        assertThat(jdbc.queryForObject("SELECT locked_until > now() FROM users WHERE id = ?", Boolean.class, id)).isTrue();
    }

    @Test
    void signingInNeverClearsTheForcedPasswordChange() throws Exception {
        UUID id = superAdmin(SEEDED_ADDRESS, "ACTIVE", true);

        login(SEEDED_ADDRESS, "Wrong-Password-99!").andExpect(status().isUnauthorized());
        login(SEEDED_ADDRESS, PASSWORD).andExpect(status().isOk())
                .andExpect(jsonPath("$.must_change_password").value(true));

        assertThat(jdbc.queryForObject("SELECT must_change_password FROM users WHERE id = ?", Boolean.class, id)).isTrue();
    }

    @Test
    void anExistingSessionThatMustChangeItsPasswordDoesNotBlockSigningInAgain() throws Exception {
        superAdmin(SEEDED_ADDRESS, "ACTIVE", true);
        jakarta.servlet.http.Cookie access = login(SEEDED_ADDRESS, PASSWORD).andExpect(status().isOk())
                .andReturn().getResponse().getCookie("prowise_access_token");
        assertThat(access).isNotNull();

        // The browser still sends that session's cookie while the person signs in again.
        loginWithCookie(SEEDED_ADDRESS, PASSWORD, access).andExpect(status().isOk())
                .andExpect(jsonPath("$.must_change_password").value(true));
        // The other routes stay closed until the password is changed.
        mockMvc.perform(get("/v1/admin/plans").cookie(access)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));
    }

    @Test
    void aStaleOrInvalidAccessCookieDoesNotBlockSignInOrRefresh() throws Exception {
        superAdmin(SEEDED_ADDRESS, "ACTIVE", false);
        jakarta.servlet.http.Cookie stale = new jakarta.servlet.http.Cookie("prowise_access_token", "not-a-valid-token");

        loginWithCookie(SEEDED_ADDRESS, PASSWORD, stale).andExpect(status().isOk());
        loginWithCookie(SEEDED_ADDRESS, "Wrong-Password-99!", stale).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        // Refresh is answered by its own refresh-cookie check (no refresh cookie here), not by the stale access cookie.
        mockMvc.perform(post("/v1/auth/refresh").cookie(stale)).andExpect(status().isUnauthorized());
        // A protected route still refuses the stale cookie.
        mockMvc.perform(get("/v1/admin/plans").cookie(stale)).andExpect(status().isUnauthorized());
    }

    @Test
    void aLeftoverOperatorCookieDoesNotOverrideTheSuperAdminSession() throws Exception {
        superAdmin("both." + UUID.randomUUID().toString().substring(0, 8) + "@prowise.test", "ACTIVE", false);
        jakarta.servlet.http.Cookie user = login(lastEmail, PASSWORD).andExpect(status().isOk())
                .andReturn().getResponse().getCookie("prowise_access_token");
        assertThat(user).isNotNull();
        // The same browser also holds an operator session cookie (the person also signed in as an operator).
        jakarta.servlet.http.Cookie operator = new jakarta.servlet.http.Cookie("prowise_operator_access_token", "operator-session-token");

        // Whatever order the browser sends them in, Super Admin pages use the user session.
        mockMvc.perform(get("/v1/admin/dashboard").cookie(operator, user)).andExpect(status().isOk());
        mockMvc.perform(get("/v1/admin/dashboard").cookie(user, operator)).andExpect(status().isOk());
    }

    // ---------------------------------------------------------------- 2. Super Admin endpoints are not anonymous

    @Test
    void platformKeysAndSmtpSettingsRequireASignedInSuperAdmin() throws Exception {
        mockMvc.perform(get("/v1/admin/platform-keys")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/admin/platform-keys")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/v1/admin/smtp/settings")).andExpect(status().isUnauthorized());
        mockMvc.perform(put("/v1/admin/smtp/settings").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/v1/admin/smtp/test-email").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    // ---------------------------------------------------------------- 3. secrets never leave the server

    @Test
    void platformKeysReportOnlyWhetherASecretIsConfiguredNeverItsValue() throws Exception {
        superAdmin("keys." + UUID.randomUUID().toString().substring(0, 8) + "@prowise.test", "ACTIVE", false);
        String token = tokenFor(lastEmail);

        String body = mockMvc.perform(get("/v1/admin/platform-keys").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode keys = objectMapper.readTree(body).path("keys");

        assertThat(keys.isArray() && keys.size() > 0).isTrue();
        assertThat(objectMapper.readTree(body).has("env_path")).as("no server file paths").isFalse();
        boolean sawJwtKey = false;
        for (JsonNode item : keys) {
            assertThat(item.has("configured")).isTrue();
            if (item.path("secret").asBoolean()) {
                assertThat(item.path("value").isNull()).as("secret %s has no value", item.path("key").asText()).isTrue();
            }
            if ("JWT_SIGNING_KEY".equals(item.path("key").asText())) {
                sawJwtKey = true;
                assertThat(item.path("secret").asBoolean()).isTrue();
                assertThat(item.path("configured").asBoolean()).isTrue();
            }
        }
        assertThat(sawJwtKey).isTrue();
    }

    @Test
    void platformKeysCannotBeWrittenOrGeneratedFromTheBrowser() throws Exception {
        superAdmin("keys." + UUID.randomUUID().toString().substring(0, 8) + "@prowise.test", "ACTIVE", false);
        String token = tokenFor(lastEmail);

        mockMvc.perform(put("/v1/admin/platform-keys").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"keys\":{\"JWT_SIGNING_KEY\":\"x\"}}"))
                .andExpect(status().isMethodNotAllowed());
        for (String route : new String[]{"/v1/admin/platform-keys/generate-jwt-key", "/v1/admin/platform-keys/generate-encryption-key"}) {
            int code = mockMvc.perform(post(route).header("Authorization", "Bearer " + token))
                    .andReturn().getResponse().getStatus();
            assertThat(code).as(route).isBetween(400, 499);
        }
    }

    // ---------------------------------------------------------------- 4. published passwords refused at bootstrap

    @Test
    void theBootstrapRefusesAPasswordPublishedInTheRepository() {
        String address = "bootstrap." + UUID.randomUUID().toString().substring(0, 8) + "@prowise.test";

        SuperAdminBootstrapService.Result result = bootstrapService.bootstrap(address, PublishedSeedCredentials.SUPER_ADMIN);

        assertThat(result.outcome()).isEqualTo(SuperAdminBootstrapService.Outcome.PUBLISHED_INITIAL_PASSWORD);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE lower(email) = lower(?)", Integer.class, address)).isZero();
    }

    // ---------------------------------------------------------------- 5. audit log list and dashboard

    @Test
    void auditLogsAndTheDashboardAnswerWithAndWithoutASearchTerm() throws Exception {
        superAdmin("audit." + UUID.randomUUID().toString().substring(0, 8) + "@prowise.test", "ACTIVE", false);
        String token = tokenFor(lastEmail);

        mockMvc.perform(get("/v1/admin/audit-logs").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
        mockMvc.perform(get("/v1/admin/audit-logs").param("search", "login").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isArray());
        mockMvc.perform(get("/v1/admin/audit-logs").param("category", "SECURITY").param("severity", "HIGH")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mockMvc.perform(get("/v1/admin/audit-logs").param("fromDate", "2020-01-01T00:00:00Z")
                        .param("toDate", "2100-01-01T00:00:00Z").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mockMvc.perform(get("/v1/admin/dashboard").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.recent_activity").isArray());
    }

    // ---------------------------------------------------------------- helpers

    private String lastEmail;

    private UUID superAdmin(String address, String accountStatus, boolean mustChange) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
                VALUES (?, ?, ?, 'Regression Admin', 'SUPER_ADMIN', ?, ?)
                """, id, address, passwordEncoder.encode(PASSWORD), accountStatus, mustChange);
        jdbc.update("INSERT INTO user_roles (user_id, role_name) VALUES (?, 'SUPER_ADMIN')", id);
        lastEmail = address;
        return id;
    }

    private ResultActions login(String address, String password) throws Exception {
        String ip = "198.51.100." + (++ipCounter % 250 + 1);
        return mockMvc.perform(post("/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .with(request -> { request.setRemoteAddr(ip); return request; })
                .content(objectMapper.writeValueAsString(Map.of("email", address, "password", password))));
    }

    private ResultActions loginWithCookie(String address, String password, jakarta.servlet.http.Cookie cookie) throws Exception {
        String ip = "198.51.100." + (++ipCounter % 250 + 1);
        return mockMvc.perform(post("/v1/auth/login").contentType(MediaType.APPLICATION_JSON).cookie(cookie)
                .with(request -> { request.setRemoteAddr(ip); return request; })
                .content(objectMapper.writeValueAsString(Map.of("email", address, "password", password))));
    }

    private String tokenFor(String address) throws Exception {
        String body = login(address, PASSWORD).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("access_token").asText();
    }

    private String hash(UUID id) {
        return jdbc.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, id);
    }

    private String accountStatus(UUID id) {
        return jdbc.queryForObject("SELECT status FROM users WHERE id = ?", String.class, id);
    }
}
