package com.prowise.identity;

import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;

public record AuthPrincipal(
        UUID userId,
        UUID sessionId,
        String email,
        UUID organizationId,
        String operatorId,
        String role,
        String departmentId,
        String accessLevel
) {

    public AuthPrincipal(UUID userId, UUID sessionId, String email) {
        this(userId, sessionId, email, null, null, null, null, null);
    }

    public AuthPrincipal(UUID userId, UUID sessionId, String email, UUID organizationId) {
        this(userId, sessionId, email, organizationId, null, null, null, null);
    }

    public static AuthPrincipal forOperator(String operatorId, UUID sessionId, String email, String role, String departmentId) {
        return forOperator(operatorId, sessionId, email, role, departmentId, "DEPARTMENT_OPERATOR");
    }

    public static AuthPrincipal forOperator(String operatorId, UUID sessionId, String email, String role, String departmentId, String accessLevel) {
        UUID syntheticUserId = UUID.nameUUIDFromBytes(("operator:" + operatorId).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return new AuthPrincipal(syntheticUserId, sessionId, email, null, operatorId, role, departmentId, accessLevel);
    }

    public boolean isOperator() {
        return operatorId != null && !operatorId.isBlank();
    }

    public boolean isMainPlatformOperator() {
        return "MAIN_PLATFORM_OPERATOR".equalsIgnoreCase(accessLevel);
    }

    public static AuthPrincipal current(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        Object principal = request.getAttribute(AuthFilter.PRINCIPAL_ATTRIBUTE);
        if (principal instanceof AuthPrincipal authenticated) {
            return authenticated;
        }
        return null;
    }

    public static AuthPrincipal require(HttpServletRequest request) {
        Object principal = request.getAttribute(AuthFilter.PRINCIPAL_ATTRIBUTE);
        if (principal instanceof AuthPrincipal authenticated) {
            return authenticated;
        }
        throw new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED,
                ErrorCodes.UNAUTHORIZED, "Authentication is required.");
    }
}
