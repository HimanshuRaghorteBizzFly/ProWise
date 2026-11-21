package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
class LoginAuthenticationVerificationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private DevelopmentDataInitializer dataInitializer;

    @BeforeEach
    void ensureAccounts() {
        dataInitializer.run(null);
    }

    @Test
    @DisplayName("1. Super Admin: Authenticate via POST /api/auth/login and verify JWT + Dashboard redirect")
    void testSuperAdminLogin() throws Exception {
        String payload = objectMapper.writeValueAsString(new AuthController.Credentials(
                "superadmin@prowise.com",
                "SuperAdmin2026!"
        ));

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token").isNotEmpty())
                .andExpect(jsonPath("$.refresh_token").isNotEmpty())
                .andExpect(jsonPath("$.must_change_password").value(false))
                .andExpect(jsonPath("$.target_dashboard_url").value("/super-admin/dashboard"))
                .andExpect(jsonPath("$.user.email").value("superadmin@prowise.com"))
                .andExpect(jsonPath("$.user.role").value("SUPER_ADMIN"))
                .andReturn();

        JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
        String accessToken = response.get("access_token").asText();

        // Verify authorized access using the generated JWT Bearer token
        mockMvc.perform(get("/api/super-admin/users")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("2. Platform Operator: Authenticate via POST /api/auth/login and verify JWT + Dashboard redirect")
    void testPlatformOperatorUnifiedLogin() throws Exception {
        String payload = objectMapper.writeValueAsString(new AuthController.Credentials(
                "operator@prowise.io",
                "Operator2026!"
        ));

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token").isNotEmpty())
                .andExpect(jsonPath("$.refresh_token").isNotEmpty())
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
                .andExpect(jsonPath("$.refresh_token").isNotEmpty())
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
}
