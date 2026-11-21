package com.prowise.common.persistence;

import com.prowise.common.api.ApiException;

/**
 * expectedVersion rule for every conflicting edit (task 1.4): the client sends the version it read;
 * if the stored version differs, or a guarded {@code UPDATE ... WHERE version = ?} changes no row,
 * the write is refused with 409 STALE_VERSION in the standard error shape.
 */
public final class ExpectedVersion {

    private ExpectedVersion() {}

    /** Throws 409 STALE_VERSION when the stored version is not the one the client read. */
    public static void check(long current, long expected) {
        if (current != expected) {
            throw ApiException.staleVersion();
        }
    }

    /** Throws 409 STALE_VERSION when a version-guarded update touched no row (a concurrent write won). */
    public static void requireUpdated(int rows) {
        if (rows == 0) {
            throw ApiException.staleVersion();
        }
    }
}
