package com.prowise.common.api;

/** Names of the cross-cutting request contract. Mutations will use these from task 1.4 onward. */
public final class ApiHeaders {

    public static final String AUTHORIZATION = "Authorization";
    /** Header on retriable mutations; same key + same body replays the earlier result. */
    public static final String IDEMPOTENCY_KEY = "Idempotency-Key";
    /** Request body field carrying the entity's JPA @Version; a mismatch returns 409 STALE_VERSION. */
    public static final String EXPECTED_VERSION = "expectedVersion";
    /** Correlation header, echoed when supplied and safe, generated otherwise. */
    public static final String REQUEST_ID = "X-Request-Id";

    private ApiHeaders() {
    }
}
