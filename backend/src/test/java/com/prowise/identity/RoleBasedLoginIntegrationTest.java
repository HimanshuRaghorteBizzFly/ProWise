package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.testsupport.CapturedMail;
import com.prowise.testsupport.TestAccounts;

/**
 * Common login for all nine roles: role from the membership of the organization signed into, organization selection,
 * account / membership / organization suspension, lockout, invitation activation (account created by the invitation
 * link), password reset, self-service session management, and isolation between organizations and dashboards.
 */
@SpringBootTest(properties = "spring.mail.username=test-smtp-user")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Tag("NFR-06")
@Tag("T01")
@Tag("T05")
class RoleBasedLoginIntegrationTest {

    private static final String PASSWORD = "Correct-Horse-42!";
    private static final Map<String, UUID> TEMPLATE = Map.of(
            "ORGANIZATION_OWNER", UUID.fromString("10000000-0000-0000-0000-000000000001"),
            "ORGANIZATION_ADMIN", UUID.fromString("10000000-0000-0000-0000-000000000002"),
            "PROJECT_MANAGER", UUID.fromString("10000000-0000-0000-0000-000000000003"),
            "TEAM_LEAD", UUID.fromString("10000000-0000-0000-0000-000000000004"),
            "DEVELOPER", UUID.fromString("10000000-0000-0000-0000-000000000005"),
            "QA_REVIEWER", UUID.fromString("10000000-0000-0000-0000-000000000006"),
            "VIEWER", UUID.fromString("10000000-0000-0000-0000-000000000007"));
    private static final Map<String, String> SEGMENT = Map.of(
            "ORGANIZATION_OWNER", "owner", "ORGANIZATION_ADMIN", "admin", "PROJECT_MANAGER", "manager",
            "TEAM_LEAD", "lead", "DEVELOPER", "developer", "QA_REVIEWER", "reviewer", "VIEWER", "viewer");

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private AccountTokenService accountTokens;
    @MockitoBean private JavaMailSender mailSender;
    @Autowired private JwtService jwtService;
    @Autowired private org.springframework.core.env.Environment environment;

    @BeforeEach
    void setUp() {
        TestDatabase.clean(jdbc);
        jdbc.update("DELETE FROM platform_operators WHERE id LIKE 'it-op-%'");
        when(mailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));
    }

    @AfterEach
    void tearDown() {
        TestDatabase.clean(jdbc);
        jdbc.update("DELETE FROM platform_operators WHERE id LIKE 'it-op-%'");
    }

    /* ================================================================== nine roles */

    @Test
    @DisplayName("All nine roles sign in on the one login endpoint and are sent to their own dashboard")
    void everyRoleReachesItsDashboard() throws Exception {
        UUID org = organization("acme");
        for (String role : SEGMENT.keySet()) {
            String email = role.toLowerCase().replace('_', '.') + "@acme.test";
            member(org, user(email, "VIEWER", "ACTIVE"), role);
            JsonNode body = login(email, PASSWORD).andExpect(status().isOk()).andReturn().body();
            assertThat(body.path("target_dashboard_url").asText()).isEqualTo("/org/" + org + "/" + SEGMENT.get(role) + "/dashboard");
            assertThat(body.path("user").path("role").asText()).isEqualTo(role);
            assertThat(body.path("user").path("organization_id").asText()).isEqualTo(org.toString());
            assertThat(body.path("requires_organization_selection").asBoolean()).isFalse();
            // The token is bound to that organization and carries the same role.
            mockMvc.perform(auth(get("/v1/me"), body.path("access_token").asText()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.role").value(role))
                    .andExpect(jsonPath("$.organization_id").value(org.toString()));
        }

        user("root@platform.test", "SUPER_ADMIN", "ACTIVE");
        JsonNode admin = login("root@platform.test", PASSWORD).andExpect(status().isOk()).andReturn().body();
        assertThat(admin.path("target_dashboard_url").asText()).isEqualTo("/super-admin/dashboard");
        assertThat(admin.path("user").path("organization_id").isNull()).isTrue();

        UUID operatorUser = user("ops@platform.test", "PLATFORM_OPERATOR", "ACTIVE");
        jdbc.update("""
                INSERT INTO platform_operators (id, name, email, role_id, access_level, department_id, status, password_hash,
                    password_setup_completed, user_id)
                VALUES ('it-op-1', 'Ops', 'ops@platform.test', 'role-platform-operator', 'MAIN_PLATFORM_OPERATOR', NULL,
                    'ACTIVE', ?, true, ?)
                """, passwordEncoder.encode(PASSWORD), operatorUser);
        JsonNode operator = login("ops@platform.test", PASSWORD).andExpect(status().isOk()).andReturn().body();
        assertThat(operator.path("target_dashboard_url").asText()).isEqualTo("/platform-operator/dashboard");
    }

    @Test
    @DisplayName("The role comes from the membership, never from the users row (no escalation, no demotion)")
    void roleComesFromMembership() throws Exception {
        UUID org = organization("acme");
        member(org, user("owner-row@acme.test", "ORGANIZATION_OWNER", "ACTIVE"), "VIEWER");
        member(org, user("viewer-row@acme.test", "VIEWER", "ACTIVE"), "DEVELOPER");

        login("owner-row@acme.test", PASSWORD).andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("VIEWER"))
                .andExpect(jsonPath("$.target_dashboard_url").value("/org/" + org + "/viewer/dashboard"));
        login("viewer-row@acme.test", PASSWORD).andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("DEVELOPER"));
    }

    @Test
    @DisplayName("Several memberships: the member chooses the organization; each one gives its own role")
    void organizationSelection() throws Exception {
        UUID acme = organization("acme");
        UUID globex = organization("globex");
        UUID person = user("both@example.test", "VIEWER", "ACTIVE");
        member(acme, person, "DEVELOPER");
        member(globex, person, "ORGANIZATION_OWNER");

        JsonNode body = login("both@example.test", PASSWORD).andExpect(status().isOk()).andReturn().body();
        assertThat(body.path("requires_organization_selection").asBoolean()).isTrue();
        assertThat(body.path("target_dashboard_url").asText()).isEqualTo("/select-org");
        assertThat(body.path("user").path("organization_id").isNull()).isTrue();
        assertThat(body.path("organizations")).hasSize(2);
        String unbound = body.path("access_token").asText();
        // An unbound token reaches no organization's data.
        mockMvc.perform(auth(get("/v1/organizations/{org}/members", acme), unbound)).andExpect(status().isNotFound());

        JsonNode switched = json(mockMvc.perform(auth(post("/v1/me/organizations/{org}/switch", globex), unbound))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ORGANIZATION_OWNER"))
                .andExpect(jsonPath("$.target_dashboard_url").value("/org/" + globex + "/owner/dashboard"))
                .andReturn());
        mockMvc.perform(auth(get("/v1/me"), switched.path("access_token").asText()))
                .andExpect(jsonPath("$.role").value("ORGANIZATION_OWNER"));

        // Asking for an organization up front binds it directly.
        Map<String, Object> direct = new LinkedHashMap<>(Map.of("email", "both@example.test", "password", PASSWORD));
        direct.put("organization_id", acme.toString());
        mockMvc.perform(post("/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(direct)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("DEVELOPER"))
                .andExpect(jsonPath("$.target_dashboard_url").value("/org/" + acme + "/developer/dashboard"));
        // An organization the person does not belong to is refused like an unknown one.
        direct.put("organization_id", organization("initech").toString());
        mockMvc.perform(post("/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(direct)))
                .andExpect(status().isNotFound());
    }

    /* ================================================================== refusals */

    @Test
    @DisplayName("Wrong password and unknown email get the same answer")
    void invalidCredentials() throws Exception {
        member(organization("acme"), user("dev@acme.test", "VIEWER", "ACTIVE"), "DEVELOPER");
        login("dev@acme.test", "wrong-password-123").andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.access_token").doesNotExist());
        login("nobody@acme.test", PASSWORD).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    @DisplayName("Five failed attempts lock the account for 15 minutes, even with the right password; it unlocks after")
    void lockoutAfterRepeatedFailures() throws Exception {
        member(organization("acme"), user("locked@acme.test", "VIEWER", "ACTIVE"), "DEVELOPER");
        for (int i = 0; i < 5; i++) {
            login("locked@acme.test", "wrong-password-" + i).andExpect(status().isUnauthorized());
        }
        login("locked@acme.test", PASSWORD).andExpect(status().isLocked())
                .andExpect(jsonPath("$.code").value("ACCOUNT_LOCKED"));
        assertThat(jdbc.queryForObject("SELECT locked_until > now() FROM users WHERE email = 'locked@acme.test'", Boolean.class)).isTrue();

        jdbc.update("UPDATE users SET locked_until = now() - interval '1 second' WHERE email = 'locked@acme.test'");
        login("locked@acme.test", PASSWORD).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT failed_login_count FROM users WHERE email = 'locked@acme.test'", Integer.class)).isZero();
    }

    @Test
    @DisplayName("A suspended account cannot sign in, and its open sessions stop working at once")
    void suspendedAccount() throws Exception {
        member(organization("acme"), user("gone@acme.test", "VIEWER", "ACTIVE"), "DEVELOPER");
        String token = login("gone@acme.test", PASSWORD).andReturn().body().path("access_token").asText();
        jdbc.update("UPDATE users SET status = 'DISABLED' WHERE email = 'gone@acme.test'");

        mockMvc.perform(auth(get("/v1/me"), token)).andExpect(status().isUnauthorized());
        login("gone@acme.test", PASSWORD).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_DISABLED"));
        // Suspension is reported as such (decision D4), and never with a session.
        login("gone@acme.test", "wrong-password-123").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.access_token").doesNotExist());
    }

    @Test
    @DisplayName("A suspended organization or a disabled membership blocks sign-in and existing sessions")
    void suspendedOrganizationAndMembership() throws Exception {
        UUID org = organization("acme");
        member(org, user("member@acme.test", "VIEWER", "ACTIVE"), "DEVELOPER");
        String token = login("member@acme.test", PASSWORD).andReturn().body().path("access_token").asText();

        jdbc.update("UPDATE organizations SET state = 'SUSPENDED' WHERE id = ?", org);
        mockMvc.perform(auth(get("/v1/me"), token)).andExpect(status().isUnauthorized());
        login("member@acme.test", PASSWORD).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ORGANIZATION_SUSPENDED"));

        jdbc.update("UPDATE organizations SET state = 'ACTIVE' WHERE id = ?", org);
        jdbc.update("UPDATE memberships SET status = 'DISABLED' WHERE org_id = ?", org);
        login("member@acme.test", PASSWORD).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("MEMBERSHIP_DISABLED"));
    }

    @Test
    @DisplayName("An account that has not been activated cannot sign in")
    void pendingAccount() throws Exception {
        user("pending@acme.test", "VIEWER", "PENDING_ACTIVATION");
        login("pending@acme.test", PASSWORD).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_PENDING_ACTIVATION"));
    }

    /* ================================================================== isolation */

    @Test
    @DisplayName("A member reaches neither platform administration nor another organization")
    void isolationAndUnauthorizedDashboards() throws Exception {
        UUID acme = organization("acme");
        UUID globex = organization("globex");
        member(acme, user("dev@acme.test", "VIEWER", "ACTIVE"), "DEVELOPER");
        member(globex, user("owner@globex.test", "VIEWER", "ACTIVE"), "ORGANIZATION_OWNER");
        String dev = login("dev@acme.test", PASSWORD).andReturn().body().path("access_token").asText();

        mockMvc.perform(auth(get("/v1/admin/users"), dev)).andExpect(status().isForbidden());
        mockMvc.perform(auth(get("/v1/organizations/{org}/members", globex), dev)).andExpect(status().isNotFound());
        mockMvc.perform(auth(post("/v1/me/organizations/{org}/switch", globex), dev)).andExpect(status().isNotFound());
        // A developer is not an administrator of its own organization either.
        mockMvc.perform(auth(get("/v1/organizations/{org}/invitations", acme), dev)).andExpect(status().isForbidden());
    }

    /* ================================================================== invitation activation */

    @Test
    @DisplayName("An Owner adds a new person: the emailed single-use link creates the account with their own password")
    void invitationCreatesTheAccount() throws Exception {
        UUID org = organization("acme");
        member(org, user("owner@acme.test", "VIEWER", "ACTIVE"), "ORGANIZATION_OWNER");
        String owner = login("owner@acme.test", PASSWORD).andReturn().body().path("access_token").asText();

        mockMvc.perform(auth(post("/v1/organizations/{org}/invitations", org), owner).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "new.dev@acme.test", "template_role_id", TEMPLATE.get("DEVELOPER")))))
                .andExpect(status().isCreated());
        String html = CapturedMail.sentHtml(mailSender).get(0);
        assertThat(html).contains("acme").doesNotContain(PASSWORD).doesNotContainIgnoringCase("password:");
        String token = CapturedMail.token(html, "invitations/accept#token=");

        mockMvc.perform(post("/v1/invitations/public-preview").contentType(MediaType.APPLICATION_JSON).content(tokenBody(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("new.dev@acme.test"))
                .andExpect(jsonPath("$.role_name").value("DEVELOPER"))
                .andExpect(jsonPath("$.account_exists").value(false));

        // A weak password is refused without using up the link.
        mockMvc.perform(post("/v1/invitations/activate").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("token", token, "password", "short", "name", "New Dev"))))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/v1/invitations/activate").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("token", token, "password", PASSWORD, "name", "New Dev"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role_template").value("DEVELOPER"));
        assertThat(jdbc.queryForObject("SELECT status FROM users WHERE email = 'new.dev@acme.test'", String.class)).isEqualTo("ACTIVE");
        assertThat(jdbc.queryForObject("SELECT status FROM invitations WHERE email = 'new.dev@acme.test'", String.class)).isEqualTo("ACCEPTED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM audit_log WHERE action = 'invitation.accepted'", Integer.class)).isEqualTo(1);

        login("new.dev@acme.test", PASSWORD).andExpect(status().isOk())
                .andExpect(jsonPath("$.target_dashboard_url").value("/org/" + org + "/developer/dashboard"));
        // Single use.
        mockMvc.perform(post("/v1/invitations/activate").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("token", token, "password", PASSWORD))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("INVITATION_INVALID"));
    }

    @Test
    @DisplayName("Activation refuses expired links and addresses that already have an account")
    void invitationActivationRefusals() throws Exception {
        UUID org = organization("acme");
        UUID owner = user("owner@acme.test", "VIEWER", "ACTIVE");
        member(org, owner, "ORGANIZATION_OWNER");
        user("existing@acme.test", "VIEWER", "ACTIVE");

        String expired = invitation(org, owner, "late@acme.test", "now() - interval '1 minute'");
        mockMvc.perform(post("/v1/invitations/activate").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("token", expired, "password", PASSWORD))))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/v1/invitations/public-preview").contentType(MediaType.APPLICATION_JSON).content(tokenBody(expired)))
                .andExpect(status().isNotFound());

        String forExisting = invitation(org, owner, "existing@acme.test", "now() + interval '1 day'");
        mockMvc.perform(post("/v1/invitations/public-preview").contentType(MediaType.APPLICATION_JSON).content(tokenBody(forExisting)))
                .andExpect(jsonPath("$.account_exists").value(true));
        mockMvc.perform(post("/v1/invitations/activate").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("token", forExisting, "password", PASSWORD))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACCOUNT_EXISTS"));
        assertThat(jdbc.queryForObject("SELECT status FROM invitations WHERE email = 'existing@acme.test'", String.class)).isEqualTo("PENDING");
    }

    /* ================================================================== password reset */

    @Test
    @DisplayName("Password reset: emailed single-use link, old sessions end, expired and reused links refused")
    void passwordReset() throws Exception {
        member(organization("acme"), user("forgot@acme.test", "VIEWER", "ACTIVE"), "DEVELOPER");
        String oldToken = login("forgot@acme.test", PASSWORD).andReturn().body().path("access_token").asText();

        mockMvc.perform(post("/v1/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "forgot@acme.test"))))
                .andExpect(status().isAccepted());
        String resetToken = CapturedMail.token(CapturedMail.sentHtml(mailSender).get(0), "reset-password?token=");

        String newPassword = "Brand-New-Secret-77";
        mockMvc.perform(post("/v1/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("token", resetToken, "password", newPassword))))
                .andExpect(status().isNoContent());
        mockMvc.perform(auth(get("/v1/me"), oldToken)).andExpect(status().isUnauthorized());
        login("forgot@acme.test", PASSWORD).andExpect(status().isUnauthorized());
        login("forgot@acme.test", newPassword).andExpect(status().isOk());
        mockMvc.perform(post("/v1/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("token", resetToken, "password", "Another-Secret-88"))))
                .andExpect(status().isUnauthorized());

        UUID id = jdbc.queryForObject("SELECT id FROM users WHERE email = 'forgot@acme.test'", UUID.class);
        String expiring = accountTokens.issue(id, AccountTokenService.Purpose.RESET);
        jdbc.update("UPDATE password_reset_tokens SET expires_at = now() - interval '1 second' WHERE user_id = ? AND used_at IS NULL", id);
        mockMvc.perform(post("/v1/auth/reset-password").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("token", expiring, "password", "Another-Secret-88"))))
                .andExpect(status().isUnauthorized());
    }

    /* ================================================================== sessions */

    @Test
    @DisplayName("A member lists their own sessions and revokes another device; other people's sessions are invisible")
    void sessionManagement() throws Exception {
        UUID org = organization("acme");
        member(org, user("me@acme.test", "VIEWER", "ACTIVE"), "DEVELOPER");
        member(org, user("other@acme.test", "VIEWER", "ACTIVE"), "DEVELOPER");
        JsonNode laptop = login("me@acme.test", PASSWORD).andReturn().body();
        Login phoneLogin = login("me@acme.test", PASSWORD);
        JsonNode phone = phoneLogin.body();
        String otherToken = login("other@acme.test", PASSWORD).andReturn().body().path("access_token").asText();

        JsonNode sessions = json(mockMvc.perform(auth(get("/v1/me/sessions"), laptop.path("access_token").asText()))
                .andExpect(status().isOk()).andReturn());
        assertThat(sessions).hasSize(2);
        String phoneSession = null;
        for (JsonNode s : sessions) {
            if (!s.path("current").asBoolean()) phoneSession = s.path("id").asText();
        }
        assertThat(phoneSession).isNotNull();

        mockMvc.perform(auth(delete("/v1/me/sessions/{id}", phoneSession), otherToken)).andExpect(status().isNotFound());
        mockMvc.perform(auth(delete("/v1/me/sessions/{id}", phoneSession), laptop.path("access_token").asText()))
                .andExpect(status().isNoContent());
        mockMvc.perform(auth(get("/v1/me"), phone.path("access_token").asText())).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refresh_token", phoneLogin.refresh()))))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(auth(get("/v1/me"), laptop.path("access_token").asText())).andExpect(status().isOk());
    }

    @Test
    @DisplayName("Refresh rotates the token and follows a changed membership role")
    void refreshFollowsMembershipRole() throws Exception {
        UUID org = organization("acme");
        UUID person = user("promoted@acme.test", "VIEWER", "ACTIVE");
        member(org, person, "DEVELOPER");
        Login firstLogin = login("promoted@acme.test", PASSWORD);
        JsonNode first = firstLogin.body();
        jdbc.update("UPDATE memberships SET role_template = 'TEAM_LEAD' WHERE user_id = ?", person);

        JsonNode refreshed = json(mockMvc.perform(post("/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refresh_token", firstLogin.refresh()))))
                .andExpect(status().isOk()).andReturn());
        mockMvc.perform(auth(get("/v1/me"), refreshed.path("access_token").asText()))
                .andExpect(jsonPath("$.role").value("TEAM_LEAD"));
        // The used refresh token is dead; replaying it closes the whole family.
        mockMvc.perform(post("/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refresh_token", firstLogin.refresh()))))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(auth(get("/v1/me"), refreshed.path("access_token").asText())).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("An expired, foreign-issuer or forged access token is refused with 401; a valid one works")
    void expiredOrForeignAccessTokenIsRefused() throws Exception {
        member(organization("acme"), user("jwt@acme.test", "VIEWER", "ACTIVE"), "DEVELOPER");
        String valid = login("jwt@acme.test", PASSWORD).andReturn().body().path("access_token").asText();
        AuthPrincipal principal = jwtService.parse(valid);
        String key = environment.getProperty("prowise.auth.jwt-signing-key");

        String expired = new JwtService(key, -1, environment.getProperty("prowise.auth.jwt-issuer", "prowise")).issueAccessToken(principal);
        String foreign = new JwtService(key, 15, "not-prowise").issueAccessToken(principal);
        String forged = new JwtService("a-different-signing-key-that-is-long-enough!!", 15, "prowise").issueAccessToken(principal);
        for (String bad : List.of(expired, foreign, forged)) {
            mockMvc.perform(auth(get("/v1/me"), bad)).andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        }
        mockMvc.perform(auth(get("/v1/me"), valid)).andExpect(status().isOk());
        mockMvc.perform(get("/v1/me")).andExpect(status().isUnauthorized());
    }

    /* ================================================================== helpers */

    private record Login(org.springframework.test.web.servlet.ResultActions actions, ObjectMapper mapper) {
        Login andExpect(org.springframework.test.web.servlet.ResultMatcher matcher) throws Exception {
            actions.andExpect(matcher);
            return this;
        }

        /** The refresh token, from its HttpOnly cookie (it is never in the response body). */
        String refresh() {
            return actions.andReturn().getResponse().getCookie("prowise_refresh_token").getValue();
        }

        Login andReturn() {
            return this;
        }

        JsonNode body() throws Exception {
            return mapper.readTree(actions.andReturn().getResponse().getContentAsString());
        }
    }

    private Login login(String email, String password) throws Exception {
        return new Login(mockMvc.perform(post("/v1/auth/login")
                .with(com.prowise.testsupport.TestAccounts.randomClient())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password)))), objectMapper);
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private String tokenBody(String token) throws Exception {
        return objectMapper.writeValueAsString(Map.of("token", token));
    }

    private static MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder builder, String token) {
        return builder.header("Authorization", "Bearer " + token);
    }

    private UUID organization(String slug) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO organizations (id, name, slug, timezone, work_calendar) VALUES (?, ?, ?, 'UTC', '{}'::jsonb)",
                id, slug, slug + "-" + id.toString().substring(0, 6));
        return id;
    }

    private UUID user(String email, String usersRole, String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
                VALUES (?, ?, ?, ?, ?, ?, false)
                """, id, email, passwordEncoder.encode(PASSWORD), email.split("@")[0], usersRole, status);
        return id;
    }

    private void member(UUID org, UUID user, String role) {
        UUID membership = UUID.randomUUID();
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, ?)", membership, org, user, role);
        jdbc.update("INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by) VALUES (?, ?, ?, ?, 'ORG', ?)",
                UUID.randomUUID(), org, membership, TEMPLATE.get(role), user);
    }

    /** An invitation with a known raw token (only its SHA-256 hash is stored, exactly as the service does). */
    private String invitation(UUID org, UUID invitedBy, String email, String expiresAtSql) throws Exception {
        String token = UUID.randomUUID().toString().replace("-", "") + "Ab";
        String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        jdbc.update("INSERT INTO invitations (id, org_id, email, template_role_id, token_hash, expires_at, invited_by) VALUES (?, ?, ?, ?, ?, "
                + expiresAtSql + ", ?)", UUID.randomUUID(), org, email, TEMPLATE.get("DEVELOPER"), hash, invitedBy);
        return token;
    }

    @SuppressWarnings("unused")
    private static List<String> roles() {
        return List.copyOf(SEGMENT.keySet());
    }
}
