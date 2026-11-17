package com.prowise.common.api;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/v1/health")
@Tag(name = "Operations")
public class HealthController {

    private final Environment environment;

    public HealthController(Environment environment) {
        this.environment = environment;
    }

    @GetMapping
    @Operation(operationId = "getHealth", summary = "Check API readiness",
            description = "Returns a request ID for operational tracing.")
    @ApiResponse(responseCode = "200", description = "API is running")
    public HealthResponse health(HttpServletRequest request) {
        String[] activeProfiles = environment.getActiveProfiles();
        String profile = activeProfiles.length == 0 ? "default" : String.join(",", activeProfiles);
        return new HealthResponse("ok", RequestIdFilter.currentRequestId(request), profile);
    }
}
