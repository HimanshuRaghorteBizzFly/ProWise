package com.prowise.superadmin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;

/**
 * Real data only: a new organization is seen with its real counts (1 member, 0 projects) and no invented
 * defaults; user A never reads organization B; the Super Admin dashboard has no fabricated trends or history.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T01")
@Tag("T06")
class PlatformRealDataIntegrationTest {

    private static final String PASSWORD = "CorrectHorseBatteryStaple!";

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private PasswordEncoder passwordEncoder;

    @BeforeEach
    @AfterEach
    void clean() {
        TestDatabase.clean(jdbc);
    }

    private record Company(UUID orgId, String email, String token) {}

    private Company register(String name) throws Exception {
        String email = "founder-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        String slug = "co-" + UUID.randomUUID().toString().substring(0, 10);
        JsonNode body = objectMapper.readTree(mockMvc.perform(post("/v1/auth/signup").contentType("application/json")
                        .content("""
                                {"email":"%s","password":"%s","name":"Founder",
                                 "organization":{"name":"%s","slug":"%s","timezone":"Europe/London","calendar":{}}}
                                """.formatted(email, PASSWORD, name, slug)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        return new Company(UUID.fromString(body.path("organization_id").asText()), email, body.path("access_token").asText());
    }

    private String superAdminToken() throws Exception {
        String email = "platform-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        jdbc.update("INSERT INTO users (id, email, password_hash, name, role, status, must_change_password) "
                + "VALUES (?, ?, ?, 'Platform Admin', 'SUPER_ADMIN', 'ACTIVE', false)",
                UUID.randomUUID(), email, passwordEncoder.encode(PASSWORD));
        return objectMapper.readTree(mockMvc.perform(post("/v1/auth/login").contentType("application/json")
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("access_token").asText();
    }

    @Test
    @DisplayName("User A in organization A never reads organization B's members, projects or name")
    void tenantDataStaysInsideItsOrganization() throws Exception {
        Company a = register("Company A");
        Company b = register("Company B");

        String membersA = mockMvc.perform(get("/v1/organizations/{org}/members", a.orgId()).header("Authorization", "Bearer " + a.token()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(objectMapper.readTree(membersA)).hasSize(1);
        assertThat(membersA).contains(a.email()).doesNotContain(b.email());

        mockMvc.perform(get("/v1/organizations/{org}/members", b.orgId()).header("Authorization", "Bearer " + a.token()))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/v1/organizations/{org}/projects", b.orgId()).header("Authorization", "Bearer " + a.token()))
                .andExpect(status().isNotFound());
        String me = mockMvc.perform(get("/v1/me").header("Authorization", "Bearer " + a.token()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(me).contains("Company A").doesNotContain("Company B");
        // A new organization has real zeros: no sample projects.
        JsonNode projects = objectMapper.readTree(mockMvc.perform(get("/v1/organizations/{org}/projects", a.orgId())
                        .header("Authorization", "Bearer " + a.token()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(projects.path("items")).isEmpty();
    }

    @Test
    @DisplayName("Super Admin sees stored organizations with real counts and owner, and no invented values")
    void superAdminSeesStoredPlatformData() throws Exception {
        Company a = register("Fresh Co");
        String token = superAdminToken();

        JsonNode organizations = objectMapper.readTree(mockMvc.perform(get("/v1/admin/organizations")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode fresh = null;
        for (JsonNode org : organizations) if (org.path("id").asText().equals(a.orgId().toString())) fresh = org;
        assertThat(fresh).isNotNull();
        assertThat(fresh.path("name").asText()).isEqualTo("Fresh Co");
        assertThat(fresh.path("seats_used").asInt()).isEqualTo(1);
        assertThat(fresh.path("projects_count").asInt()).isZero();
        assertThat(fresh.path("owner_email").asText()).isEqualTo(a.email());
        assertThat(fresh.path("industry").isNull()).isTrue(); // never "Enterprise Software"
        assertThat(fresh.path("domain").isNull()).isTrue(); // never "{slug}.prowise.io"
        assertThat(fresh.toString()).doesNotContain("Enterprise Software", "United States");

        JsonNode dashboard = objectMapper.readTree(mockMvc.perform(get("/v1/admin/dashboard").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(dashboard.path("revenue_history")).isEmpty();
        for (JsonNode card : dashboard.path("kpi_cards")) assertThat(card.path("change").isNull()).isTrue();

        // A normal Owner never reaches platform data.
        mockMvc.perform(get("/v1/admin/organizations").header("Authorization", "Bearer " + a.token()))
                .andExpect(status().isForbidden());
    }
}
