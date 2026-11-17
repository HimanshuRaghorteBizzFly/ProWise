package com.prowise.common.api;

import java.util.List;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import io.swagger.v3.oas.annotations.media.Schema;

/** The only error body the API ever returns: { code, message, request_id, field_errors }. */
@Schema(name = "ErrorResponse")
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record ApiError(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "NOT_FOUND") String code,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "The requested resource was not found.")
        String message,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "test-123") String requestId,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<FieldError> fieldErrors) {

    public ApiError {
        fieldErrors = fieldErrors == null ? List.of() : List.copyOf(fieldErrors);
    }

    @Schema(name = "FieldError")
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record FieldError(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String field,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message) {
    }
}
