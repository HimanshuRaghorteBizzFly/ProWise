package com.prowise.identity;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;

/**
 * Fixed one-minute windows per key (an email, an IP address, ...) for the unauthenticated auth endpoints.
 * Memory is bounded: expired windows are dropped once the table grows, and a full table is cleared rather than
 * grown. State is per instance; with several replicas each enforces its own limit (a shared store is not used
 * because the platform runs on PostgreSQL only). Keys never contain passwords or tokens.
 */
@Component
public class RequestThrottle {

    static final long WINDOW_MILLIS = 60_000L;
    private static final int PRUNE_AT = 10_000;
    private static final int HARD_CAP = 50_000;

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final int perIpPerMinute;

    public RequestThrottle(@Value("${prowise.auth.ip-rate-limit-per-minute:30}") int perIpPerMinute) {
        this.perIpPerMinute = Math.max(1, perIpPerMinute);
    }

    /** Counts one attempt for {@code key}; throws 429 RATE_LIMITED past {@code limit} in the current minute. */
    public void check(String key, int limit) {
        long now = System.currentTimeMillis();
        if (windows.size() >= PRUNE_AT) prune(now);
        Window window = windows.compute(key, (ignored, current) ->
                current == null || now - current.startedAt() >= WINDOW_MILLIS ? new Window(now, 1)
                        : new Window(current.startedAt(), current.count() + 1));
        if (window.count() > limit) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, ErrorCodes.RATE_LIMITED, "Too many attempts. Try again later.");
        }
    }

    /** Per-address limit shared by sign-in and password-reset requests; an unknown address is not limited here. */
    public void checkIp(String scope, String ip) {
        if (ip == null || ip.isBlank()) return;
        check(scope + "-ip:" + ip, perIpPerMinute);
    }

    /** Test support: forget every window. */
    public void clear() {
        windows.clear();
    }

    private void prune(long now) {
        windows.entrySet().removeIf(entry -> now - entry.getValue().startedAt() >= WINDOW_MILLIS);
        if (windows.size() >= HARD_CAP) windows.clear();
    }

    private record Window(long startedAt, int count) {}
}
