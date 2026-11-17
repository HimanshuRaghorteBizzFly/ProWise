package com.prowise.common.api;

import java.util.List;

import org.springframework.http.HttpStatus;

/** Thrown by application code to return a specific status and error code in the standard shape. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final List<ApiError.FieldError> fieldErrors;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, List.of());
    }

    public ApiException(HttpStatus status, String code, String message, List<ApiError.FieldError> fieldErrors) {
        super(message);
        this.status = status;
        this.code = code;
        this.fieldErrors = List.copyOf(fieldErrors);
    }

    public static ApiException staleVersion() {
        return new ApiException(HttpStatus.CONFLICT, ErrorCodes.STALE_VERSION,
                "The record was changed by someone else. Reload and try again.");
    }

    /** Foreign or unknown IDs: 404 with no metadata about what was looked up. */
    public static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "The requested resource was not found.");
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public List<ApiError.FieldError> fieldErrors() {
        return fieldErrors;
    }
}
