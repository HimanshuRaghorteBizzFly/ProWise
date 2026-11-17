package com.prowise.common.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Tag("NFR-08")
class HealthEndpointTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthReturnsRequestIdInBodyAndHeader() throws Exception {
        var result = mockMvc.perform(get("/v1/health"))
                .andExpect(status().isOk())
                .andExpect(header().exists(RequestIdFilter.REQUEST_ID_HEADER))
                .andExpect(jsonPath("$.status").value("ok"))
                .andReturn();

        String headerId = result.getResponse().getHeader(RequestIdFilter.REQUEST_ID_HEADER);
        assertThat(result.getResponse().getContentAsString()).contains("\"request_id\":\"" + headerId + "\"");
    }

    @Test
    void suppliedRequestIdIsEchoedInHeaderAndBody() throws Exception {
        mockMvc.perform(get("/v1/health").header(RequestIdFilter.REQUEST_ID_HEADER, "test-123"))
                .andExpect(status().isOk())
                .andExpect(header().string(RequestIdFilter.REQUEST_ID_HEADER, "test-123"))
                .andExpect(jsonPath("$.request_id").value("test-123"));
    }

    @Test
    void unsafeSuppliedRequestIdIsReplacedNotEchoed() throws Exception {
        String unsafe = "<script>alert(1)</script>";
        var result = mockMvc.perform(get("/v1/health").header(RequestIdFilter.REQUEST_ID_HEADER, unsafe))
                .andExpect(status().isOk())
                .andReturn();

        String headerId = result.getResponse().getHeader(RequestIdFilter.REQUEST_ID_HEADER);
        assertThat(headerId).isNotEqualTo(unsafe).matches("[0-9a-f-]{36}");
    }

    @Test
    void overlongSuppliedRequestIdIsReplaced() throws Exception {
        String overlong = "a".repeat(101);
        var result = mockMvc.perform(get("/v1/health").header(RequestIdFilter.REQUEST_ID_HEADER, overlong))
                .andReturn();

        assertThat(result.getResponse().getHeader(RequestIdFilter.REQUEST_ID_HEADER)).isNotEqualTo(overlong);
    }

    @Test
    void concurrentRequestsReceiveDistinctRequestIds() {
        Set<String> requestIds = ConcurrentHashMap.newKeySet();

        IntStream.range(0, 20).parallel().forEach(index -> {
            try {
                requestIds.add(mockMvc.perform(get("/v1/health"))
                        .andReturn()
                        .getResponse()
                        .getHeader(RequestIdFilter.REQUEST_ID_HEADER));
            } catch (Exception exception) {
                throw new AssertionError("health request failed", exception);
            }
        });

        assertThat(requestIds).hasSize(20);
    }

    @Test
    void corsPreflightFromWebOriginIsAllowedAndExposesRequestId() throws Exception {
        mockMvc.perform(options("/v1/health")
                        .header("Origin", "http://localhost:3000")
                        .header("Access-Control-Request-Method", "GET")
                        .header("Access-Control-Request-Headers", "Idempotency-Key,X-Request-Id"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3000"));

        mockMvc.perform(get("/v1/health").header("Origin", "http://localhost:3000"))
                .andExpect(header().string("Access-Control-Expose-Headers",
                        org.hamcrest.Matchers.containsString(RequestIdFilter.REQUEST_ID_HEADER)));
    }

    @Test
    void corsRejectsUnknownOrigin() throws Exception {
        mockMvc.perform(options("/v1/health")
                        .header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }
}
