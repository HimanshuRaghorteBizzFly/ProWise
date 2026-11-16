package com.prowise.identity;

import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;

import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;

public record AuthPrincipal(UUID userId, UUID sessionId, String email) {

    public static AuthPrincipal require(HttpServletRequest request) {
        Object principal = request.getAttribute(AuthFilter.PRINCIPAL_ATTRIBUTE);
        if (principal instanceof AuthPrincipal authenticated) {
            return authenticated;
        }
        throw new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                ErrorCodes.UNAUTHORIZED, "Authentication is required.");
    }
}
