package com.prowise.common.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import jakarta.servlet.Filter;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.core.Ordered;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Every error, whether raised in a controller, by Spring MVC itself or by a servlet filter,
 * must use { code, message, request_id, field_errors }. Runs on a real Tomcat so the
 * container error dispatch (/error) is exercised too.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Tag("NFR-11")
class ErrorShapeTest {

    @Autowired
    private TestRestTemplate rest;

    @Test
    void unknownPathReturns404ErrorShapeWithoutMetadata() {
        ResponseEntity<Map> response = rest.getForEntity("/v1/does-not-exist", Map.class);

        assertErrorShape(response, HttpStatus.NOT_FOUND, "NOT_FOUND");
        assertThat(response.getBody().get("message").toString()).doesNotContain("does-not-exist");
    }

    @Test
    void suppliedRequestIdAppearsInErrorBody() {
        HttpHeaders headers = new HttpHeaders();
        headers.set(RequestIdFilter.REQUEST_ID_HEADER, "test-123");
        ResponseEntity<Map> response = rest.exchange(
                "/v1/does-not-exist", HttpMethod.GET, new HttpEntity<>(headers), Map.class);

        assertThat(response.getBody()).containsEntry("request_id", "test-123");
        assertThat(response.getHeaders().getFirst(RequestIdFilter.REQUEST_ID_HEADER)).isEqualTo("test-123");
    }

    @Test
    void wrongMethodReturns405ErrorShape() {
        ResponseEntity<Map> response = rest.exchange("/v1/health", HttpMethod.DELETE, null, Map.class);

        assertErrorShape(response, HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED");
    }

    @Test
    void beanValidationFailureListsFieldErrors() {
        ResponseEntity<Map> response = postJson("{\"name\":\"\",\"expectedVersion\":-1}");

        assertErrorShape(response, HttpStatus.BAD_REQUEST, "VALIDATION_FAILED");
        List<Map<String, String>> fieldErrors = (List<Map<String, String>>) response.getBody().get("field_errors");
        assertThat(fieldErrors).extracting(error -> error.get("field"))
                .containsExactlyInAnyOrder("name", "expectedVersion");
    }

    @Test
    void malformedJsonReturns400ErrorShape() {
        ResponseEntity<Map> response = postJson("{not json");

        assertErrorShape(response, HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST");
    }

    @Test
    void unsupportedMediaTypeReturns415ErrorShape() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_PLAIN);
        ResponseEntity<Map> response = rest.exchange(
                "/v1/__test__/echo", HttpMethod.POST, new HttpEntity<>("x", headers), Map.class);

        assertErrorShape(response, HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE");
    }

    @Test
    void domainApiExceptionKeepsItsCodeAndStatus() {
        ResponseEntity<Map> response = rest.getForEntity("/v1/__test__/stale", Map.class);

        assertErrorShape(response, HttpStatus.CONFLICT, "STALE_VERSION");
    }

    @Test
    void unexpectedExceptionReturns500WithoutLeakingDetails() {
        ResponseEntity<Map> response = rest.getForEntity("/v1/__test__/boom", Map.class);

        assertErrorShape(response, HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR");
        assertThat(response.getBody().toString()).doesNotContain("internal detail", "IllegalStateException");
    }

    @Test
    void filterLevelFailureStillReturnsErrorShapeViaErrorController() {
        HttpHeaders headers = new HttpHeaders();
        headers.set(RequestIdFilter.REQUEST_ID_HEADER, "filter-req-1");
        ResponseEntity<Map> response = rest.exchange(
                "/v1/__test__/filter-failure", HttpMethod.GET, new HttpEntity<>(headers), Map.class);

        assertErrorShape(response, HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR");
        assertThat(response.getBody()).containsEntry("request_id", "filter-req-1");
        assertThat(response.getBody().toString()).doesNotContain("filter detail");
    }

    private ResponseEntity<Map> postJson(String body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.exchange("/v1/__test__/echo", HttpMethod.POST, new HttpEntity<>(body, headers), Map.class);
    }

    private static void assertErrorShape(ResponseEntity<Map> response, HttpStatus status, String code) {
        assertThat(response.getStatusCode()).isEqualTo(status);
        assertThat(response.getHeaders().getContentType()).isNotNull();
        assertThat(response.getHeaders().getContentType().isCompatibleWith(MediaType.APPLICATION_JSON)).isTrue();
        Map<String, Object> body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.keySet()).containsExactlyInAnyOrder("code", "message", "request_id", "field_errors");
        assertThat(body.get("code")).isEqualTo(code);
        assertThat(body.get("message")).asString().isNotBlank();
        assertThat(body.get("request_id")).asString().isNotBlank()
                .isEqualTo(response.getHeaders().getFirst(RequestIdFilter.REQUEST_ID_HEADER));
        assertThat(body.get("field_errors")).isInstanceOf(List.class);
    }

    record EchoRequest(
            @NotBlank String name,
            @com.fasterxml.jackson.annotation.JsonProperty(ApiHeaders.EXPECTED_VERSION) @Min(0) long expectedVersion) {
    }

    @RestController
    static class ErrorProbeController {

        @PostMapping("/v1/__test__/echo")
        EchoRequest echo(@Valid @RequestBody EchoRequest request) {
            return request;
        }

        @GetMapping("/v1/__test__/stale")
        void stale() {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_VERSION", "The record was changed by someone else.");
        }

        @GetMapping("/v1/__test__/boom")
        void boom() {
            throw new IllegalStateException("internal detail");
        }
    }

    @TestConfiguration
    static class ProbeConfiguration {

        @Bean
        ErrorProbeController errorProbeController() {
            return new ErrorProbeController();
        }

        @Bean
        FilterRegistrationBean<Filter> failingFilter() {
            Filter filter = (request, response, chain) -> {
                if (((HttpServletRequest) request).getRequestURI().equals("/v1/__test__/filter-failure")) {
                    throw new ServletException("filter detail");
                }
                chain.doFilter(request, response);
            };
            FilterRegistrationBean<Filter> registration = new FilterRegistrationBean<>(filter);
            registration.setOrder(Ordered.LOWEST_PRECEDENCE);
            return registration;
        }
    }
}
