package com.prowise.operator.console;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.testsupport.ConsoleSessions;

/**
 * API error log: every 5xx and every 4xx except 401/404 is recorded with metadata only (no body, query string,
 * header or token), the response is unchanged, and a failing log write never breaks the request.
 */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Import(ApiErrorLoggingIntegrationTest.FailingController.class)
@Tag("NFR-06")
class ApiErrorLoggingIntegrationTest {

    /** Test-only endpoint that fails with an unexpected exception. */
    @TestConfiguration
    @RestController
    static class FailingController {
        @GetMapping("/v1/test-only/explode/{id}")
        public String explode(@PathVariable String id) {
            throw new IllegalStateException("boom with secret-value-123");
        }
    }

    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder encoder;
    @Autowired private ObjectMapper mapper;

    private String admin;

    @BeforeEach
    void setUp() throws Exception {
        TestDatabase.clean(jdbc);
        ConsoleSessions.cleanup(jdbc);
        admin = ConsoleSessions.superAdmin(mvc, jdbc, encoder, mapper);
        jdbc.update("DELETE FROM api_error_logs");
    }

    @AfterEach
    void tearDown() {
        ConsoleSessions.cleanup(jdbc);
    }

    @Test
    void recordsA500WithTheRouteTemplateAndNoQueryOrBody() throws Exception {
        mvc.perform(get("/v1/test-only/explode/abc-123?token=supersecret&q=1").header("X-Request-Id", "req-500-test"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.request_id").value("req-500-test"));

        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM api_error_logs");
        assertThat(rows).hasSize(1);
        Map<String, Object> row = rows.get(0);
        assertThat(row).containsEntry("status", 500).containsEntry("method", "GET")
                .containsEntry("path_template", "/v1/test-only/explode/{id}")
                .containsEntry("error_code", "INTERNAL_ERROR").containsEntry("request_id", "req-500-test")
                .containsEntry("actor_type", "ANONYMOUS");
        assertThat(row.values().toString()).doesNotContain("supersecret", "abc-123", "secret-value-123", "token");
    }

    @Test
    void recordsA400And403ButNot401Or404() throws Exception {
        // 400: invalid body on an authenticated operator route.
        mvc.perform(post("/v1/operator/email-drafts").header("Authorization", "Bearer " + admin)
                        .contentType("application/json").content("{\"name\":\"\",\"password\":\"hunter2\"}"))
                .andExpect(status().isBadRequest());
        // 401 (anonymous) and 404 (unknown route) are not recorded.
        mvc.perform(get("/v1/operator/api-errors")).andExpect(status().isUnauthorized());
        mvc.perform(get("/v1/does-not-exist").header("Authorization", "Bearer " + admin)).andExpect(status().isNotFound());
        // 403: operator without the permission.
        String finance = ConsoleSessions.operator(mvc, jdbc, encoder, mapper, ConsoleSessions.operatorId("fin"),
                "DEPARTMENT_OPERATOR", "finance-tax");
        mvc.perform(get("/v1/operator/api-errors").param("status_class", "4xx").header("Authorization", "Bearer " + finance))
                .andExpect(status().isForbidden());

        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM api_error_logs ORDER BY occurred_at");
        assertThat(rows).extracting(r -> r.get("status")).containsExactly(400, 403);
        assertThat(rows.get(0)).containsEntry("path_template", "/v1/operator/email-drafts")
                .containsEntry("error_code", "VALIDATION_FAILED").containsEntry("actor_type", "USER");
        assertThat(rows.get(1)).containsEntry("path_template", "/v1/operator/api-errors")
                .containsEntry("error_code", "FORBIDDEN").containsEntry("actor_type", "OPERATOR");
        assertThat(rows.toString()).doesNotContain("hunter2", "status_class", "Bearer");

        // The list and summary read them back with filters.
        mvc.perform(get("/v1/operator/api-errors").param("status_class", "4xx").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total").value(2));
        mvc.perform(get("/v1/operator/api-errors").param("code", "forbidden").header("Authorization", "Bearer " + admin))
                .andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.items[0].status").value(403));
        mvc.perform(get("/v1/operator/api-errors").param("path", "email-drafts").header("Authorization", "Bearer " + admin))
                .andExpect(jsonPath("$.total").value(1));
        mvc.perform(get("/v1/operator/api-errors").param("status_class", "5xx").header("Authorization", "Bearer " + admin))
                .andExpect(jsonPath("$.total").value(0));
        mvc.perform(get("/v1/operator/api-errors").param("status_class", "3xx").header("Authorization", "Bearer " + admin))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/v1/operator/api-errors/summary").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.client_errors").value(3)) // the 3xx request above was itself a recorded 400
                .andExpect(jsonPath("$.server_errors").value(0))
                .andExpect(jsonPath("$.by_status[0].status").value(400))
                .andExpect(jsonPath("$.by_status[0].count").value(2));
    }

    @Test
    void aFailingLogWriteNeverChangesOrBreaksTheResponse() throws Exception {
        MvcResult normal = mvc.perform(get("/v1/test-only/explode/1").header("X-Request-Id", "same-id"))
                .andExpect(status().isInternalServerError()).andReturn();
        jdbc.execute("ALTER TABLE api_error_logs RENAME TO api_error_logs_offline");
        try {
            MvcResult broken = mvc.perform(get("/v1/test-only/explode/1").header("X-Request-Id", "same-id"))
                    .andExpect(status().isInternalServerError()).andReturn();
            assertThat(broken.getResponse().getContentAsString()).isEqualTo(normal.getResponse().getContentAsString());
            mvc.perform(post("/v1/operator/email-drafts").header("Authorization", "Bearer " + admin)
                            .contentType("application/json").content("{}"))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        } finally {
            jdbc.execute("ALTER TABLE api_error_logs_offline RENAME TO api_error_logs");
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM api_error_logs", Integer.class)).isEqualTo(1);
    }

    @Test
    void pathWithoutARouteHasIdSegmentsMasked() {
        org.springframework.mock.web.MockHttpServletRequest request =
                new org.springframework.mock.web.MockHttpServletRequest("GET", "/v1/orgs/3f1c2a4e-1111-2222-3333-444455556666/invitations/abcDEF123token");
        assertThat(com.prowise.common.api.ApiErrorRecordingFilter.pathTemplate(request))
                .isEqualTo("/v1/orgs/{id}/invitations/{id}");
    }
}
