package com.prowise.superadmin.users;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;

/**
 * Super Admin user management is for an authenticated Platform Administrator only: no anonymous access,
 * no tenant user, and no organization-bound token. Every change is audited with the real actor.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("AS-07")
class SuperAdminUserAccessIntegrationTest {

    private static final String PASSWORD = "correct-horse-battery";
    private static final List<String> ROUTES = List.of(
            "/api/super-admin/users", "/v1/admin/users", "/api/v1/admin/users");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    @AfterEach
    void clean() {
        jdbc.update("DELETE FROM auth_audit_logs");
        jdbc.update("DELETE FROM user_login_history");
        jdbc.update("DELETE FROM user_roles");
        TestDatabase.clean(jdbc);
    }

    @Test
    void anonymousCallerIsRejectedOnEveryRoute() throws Exception {
        UUID someone = UUID.randomUUID();
        for (String base : ROUTES) {
            mockMvc.perform(get(base)).andExpect(status().isUnauthorized());
            mockMvc.perform(get(base + "/{id}", someone)).andExpect(status().isUnauthorized());
            mockMvc.perform(get(base + "/{id}/login-history", someone)).andExpect(status().isUnauthorized());
            mockMvc.perform(post(base).contentType("application/json").content(createBody("anon")))
                    .andExpect(status().isUnauthorized());
            mockMvc.perform(post(base + "/{id}/reset-password", someone)).andExpect(status().isUnauthorized());
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users", Integer.class)).isZero();
    }

    @Test
    void tenantUserIsForbidden() throws Exception {
        String token = signupToken("tenant");
        mockMvc.perform(auth(get("/api/super-admin/users"), token)).andExpect(status().isForbidden());
        mockMvc.perform(auth(post("/api/super-admin/users"), token).contentType("application/json")
                .content(createBody("by-tenant"))).andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE email LIKE 'by-tenant%'", Integer.class))
                .isZero();
    }

    @Test
    void platformAdministratorCanManageUsersAndEveryChangeIsAudited() throws Exception {
        UUID adminId = superAdmin("admin@example.test");
        String token = login("admin@example.test");

        mockMvc.perform(auth(get("/api/super-admin/users"), token)).andExpect(status().isOk());
        mockMvc.perform(auth(post("/v1/admin/users"), token).contentType("application/json")
                .content(createBody("new-user"))).andExpect(status().isCreated());

        List<UUID> actors = jdbc.queryForList(
                "SELECT actor_id FROM auth_audit_logs WHERE action LIKE '%CREATE%'", UUID.class);
        assertThat(actors).containsExactly(adminId);
    }

    @Test
    void organizationBoundAdministratorTokenHasNoAccess() throws Exception {
        UUID adminId = superAdmin("bound-admin@example.test");
        UUID orgId = UUID.randomUUID();
        jdbc.update("INSERT INTO organizations (id, name, slug, timezone, work_calendar) VALUES (?, 'Bound', ?, 'UTC', '{}'::jsonb)",
                orgId, "bound-" + orgId.toString().substring(0, 8));
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, 'VIEWER')",
                UUID.randomUUID(), orgId, adminId);
        String token = login("bound-admin@example.test");
        String bound = objectMapper.readTree(mockMvc.perform(auth(post("/v1/me/organizations/{org}/switch", orgId), token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("access_token").asText();

        mockMvc.perform(auth(get("/api/super-admin/users"), bound)).andExpect(status().isForbidden());
    }

    /* ------------------------------------------------------------------ */

    private UUID superAdmin(String email) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
                VALUES (?, ?, ?, 'Platform Admin', 'SUPER_ADMIN', 'ACTIVE', false)
                """, id, email, passwordEncoder.encode(PASSWORD));
        return id;
    }

    private String login(String email) throws Exception {
        String body = objectMapper.writeValueAsString(java.util.Map.of("email", email, "password", PASSWORD));
        return objectMapper.readTree(mockMvc.perform(post("/api/auth/login").contentType("application/json").content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("access_token").asText();
    }

    private String signupToken(String name) throws Exception {
        String email = name + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        return objectMapper.readTree(mockMvc.perform(post("/v1/auth/signup").contentType("application/json")
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("access_token").asText();
    }

    private static String createBody(String name) {
        return "{\"name\":\"" + name + "\",\"email\":\"" + name + "-" + UUID.randomUUID().toString().substring(0, 6)
                + "@example.test\",\"role\":\"VIEWER\",\"send_email\":false}";
    }

    private static MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder builder, String token) {
        return builder.header("Authorization", "Bearer " + token);
    }
}
