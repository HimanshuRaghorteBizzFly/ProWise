package com.prowise.operator.auth;

import java.time.Instant;
import java.util.List;

public class OperatorAuthDTOs {

    public record LoginRequest(
            String email,
            String password,
            Boolean rememberMe
    ) {}

    public record RefreshRequest(
            String refreshToken
    ) {}

    public record ForgotPasswordRequest(
            String email
    ) {}

    public record ChangePasswordRequest(
            String currentPassword,
            String newPassword
    ) {}

    public record ResetPasswordRequest(
            String token,
            String newPassword
    ) {}

    public record AcceptInvitationRequest(
            String token,
            String newPassword,
            String name
    ) {}

    public record OperatorInfo(
            String id,
            String name,
            String email,
            String roleId,
            String accessLevel,
            String departmentId,
            String departmentName,
            String status,
            boolean mfaEnabled,
            boolean onCall,
            String shiftName,
            Instant lastLoginAt,
            Instant createdAt
    ) {}

    public record OperatorAuthResponse(
            String accessToken,
            @com.fasterxml.jackson.annotation.JsonIgnore String refreshToken,
            String tokenType,
            long expiresIn,
            OperatorInfo operator,
            List<String> authorizedModules,
            List<String> effectivePermissions
    ) {}

    public record MessageResponse(
            String message
    ) {}
}
