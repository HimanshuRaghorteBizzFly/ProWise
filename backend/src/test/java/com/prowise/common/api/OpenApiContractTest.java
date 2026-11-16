package com.prowise.common.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Typed contract skeleton. Also writes target/openapi.json so the frontend can generate
 * its types without a running server: npm run api:types -- ../backend/target/openapi.json
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Tag("NFR-11")
class OpenApiContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void apiDocsExposeErrorShapePaginationAndConcurrencyNames() throws Exception {
        String json = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode doc = new ObjectMapper().readTree(json);
        JsonNode schemas = doc.path("components").path("schemas");

        JsonNode error = schemas.path("ErrorResponse");
        assertThat(error.path("properties").has("code")).isTrue();
        assertThat(error.path("properties").has("message")).isTrue();
        assertThat(error.path("properties").has("request_id")).isTrue();
        assertThat(error.path("properties").has("field_errors")).isTrue();
        assertThat(error.path("required").toString()).contains("code", "message", "request_id", "field_errors");

        JsonNode page = schemas.path("CursorPage").path("properties");
        assertThat(page.has("items")).isTrue();
        assertThat(page.has("next_cursor")).isTrue();
        assertThat(page.has("has_more")).isTrue();

        assertThat(schemas.path("VersionedMutation").path("properties").has(ApiHeaders.EXPECTED_VERSION)).isTrue();

        JsonNode idempotency = doc.path("components").path("parameters").path("IdempotencyKey");
        assertThat(idempotency.path("name").asText()).isEqualTo(ApiHeaders.IDEMPOTENCY_KEY);
        assertThat(idempotency.path("in").asText()).isEqualTo("header");

        JsonNode health = doc.path("paths").path("/v1/health").path("get");
        assertThat(health.path("responses").path("200").isMissingNode()).isFalse();
        assertThat(schemas.path("HealthResponse").path("properties").has("request_id")).isTrue();
        assertThat(health.path("responses").path("default").path("content").path("application/json")
                .path("schema").path("$ref").asText()).isEqualTo("#/components/schemas/ErrorResponse");

        Path out = Path.of("target", "openapi.json");
        Files.createDirectories(out.getParent());
        Files.writeString(out, new ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(doc));
    }

    @Test
    void legacyDocsPathIsGone() throws Exception {
        mockMvc.perform(get("/v1/openapi")).andExpect(status().isNotFound());
    }
}
