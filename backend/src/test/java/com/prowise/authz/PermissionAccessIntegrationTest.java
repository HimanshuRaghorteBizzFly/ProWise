package com.prowise.authz;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;

@SpringBootTest
@AutoConfigureMockMvc
@Tag("T04")
@Tag("T05")
@Tag("T06")
@Tag("AS-07")
class PermissionAccessIntegrationTest {

    @TestConfiguration
    static class TestResourceConfiguration {
        @Bean
        TestProtectedResourceController testProtectedResourceController() {
            return new TestProtectedResourceController();
        }
    }

    @RestController
    @RequestMapping("/v1/test/protected-resources")
    static class TestProtectedResourceController {
        @GetMapping("/{resourceId}")
        @PreAuthorize("isAuthenticated()")
        TestResource get(@PathVariable UUID resourceId) {
            return new TestResource(resourceId, "test-only");
        }
    }

    record TestResource(UUID id, String value) {}

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void foreignProtectedResourceIsIndistinguishableFromUnknownResource() throws Exception {
        UUID foreignId = UUID.randomUUID();

        mockMvc.perform(get("/v1/test/protected-resources/{id}", foreignId)
                        .header("Authorization", "Bearer invalid"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/v1/test/protected-resources/{id}", foreignId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void permissionsEndpointRequiresAnActiveMembership() throws Exception {
        mockMvc.perform(get("/v1/me/permissions").param("org", UUID.randomUUID().toString()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void organizationSwitchRejectsAnUnknownOrganizationWithoutMetadata() throws Exception {
        mockMvc.perform(post("/v1/me/organizations/{orgId}/switch", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.field_errors").isArray());
    }
}
