package com.prowise.common.api;

import jakarta.servlet.http.HttpServletRequest;

/**
 * The one way to read a caller's IP address. X-Forwarded-For is never parsed by application code: behind a reverse
 * proxy, Tomcat's RemoteIpValve ({@code server.forward-headers-strategy=native}) replaces the remote address only
 * when the request came from a trusted internal proxy, so a client cannot choose the address recorded for it or
 * dodge per-address limits.
 */
public final class ClientAddress {

    private ClientAddress() {}

    public static String of(HttpServletRequest request) {
        if (request == null || request.getRemoteAddr() == null || request.getRemoteAddr().isBlank()) {
            return "127.0.0.1";
        }
        return request.getRemoteAddr();
    }
}
