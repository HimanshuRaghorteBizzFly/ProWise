package com.prowise.common.api;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import io.swagger.v3.oas.annotations.media.Schema;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record HealthResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = "ok") String status,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String requestId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String profile) {
}
