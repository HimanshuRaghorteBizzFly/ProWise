package com.prowise.common.persistence;

import java.util.List;

import org.springframework.http.HttpStatus;

import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;

/**
 * expectedVersion rule for every conflicting edit (task 1.4): the client sends the version it read;
 * if the stored version differs, or a guarded {@code UPDATE ... WHERE version = ?} changes no row,
 * the write is refused with 409 STALE_VERSION in the standard error shape.
 */
public final class ExpectedVersion {

    /** JSON name of the body field every versioned mutation carries. */
    public static final String FIELD = "expected_version";

    private ExpectedVersion() {}

    /** Throws 409 STALE_VERSION when the stored version is not the one the client read. */
    public static void check(long current, long expected) {
        if (current != expected) {
            throw ApiException.staleVersion();
        }
    }

    /**
     * The client's expected version, required on every update/state change: a missing value is 400
     * VALIDATION_FAILED (field {@code expected_version}), never treated as "skip the check".
     */
    public static long required(Long expected) {
        if (expected == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED,
                    "expected_version is required. Send the version you last read.",
                    List.of(new ApiError.FieldError(FIELD, "is required")));
        }
        return expected;
    }

    /**
     * Required expected version checked against a JPA {@code @Version} value (null = never flushed = 0).
     * Returns the expected version so callers can guard a follow-up {@code UPDATE ... WHERE version = ?}.
     */
    public static long checkRequired(Long current, Long expected) {
        long wanted = required(expected);
        check(current == null ? 0L : current, wanted);
        return wanted;
    }

    /** Throws 409 STALE_VERSION when a version-guarded update touched no row (a concurrent write won). */
    public static void requireUpdated(int rows) {
        if (rows == 0) {
            throw ApiException.staleVersion();
        }
    }
}
