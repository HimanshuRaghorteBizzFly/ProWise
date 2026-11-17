package com.prowise.common.api;

/** Stable machine-readable error codes shared with the web client. */
public final class ErrorCodes {

    public static final String NOT_FOUND = "NOT_FOUND";
    public static final String VALIDATION_FAILED = "VALIDATION_FAILED";
    public static final String MALFORMED_REQUEST = "MALFORMED_REQUEST";
    public static final String METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED";
    public static final String UNSUPPORTED_MEDIA_TYPE = "UNSUPPORTED_MEDIA_TYPE";
    public static final String STALE_VERSION = "STALE_VERSION";
    public static final String IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT";
    public static final String INTERNAL_ERROR = "INTERNAL_ERROR";
    public static final String UNAUTHORIZED = "UNAUTHORIZED";
    public static final String INVALID_TIMEZONE = "INVALID_TIMEZONE";
    public static final String DUPLICATE_SLUG = "DUPLICATE_SLUG";
    public static final String INVALID_CREDENTIALS = "INVALID_CREDENTIALS";
    public static final String RATE_LIMITED = "RATE_LIMITED";

    private ErrorCodes() {
    }
}
