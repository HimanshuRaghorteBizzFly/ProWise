package com.prowise.superadmin.users;

import java.time.Instant;
import java.util.UUID;

public class UserDTOs {

    public record CreateUserRequest(
            String name,
            String email,
            String role,
            String department,
            UUID organizationId,
            String phone,
            Boolean sendEmail,
            String customPassword
    ) {}

    public record UpdateUserRequest(
            String name,
            String role,
            String department,
            UUID organizationId,
            String phone
    ) {}

    public record UpdateStatusRequest(
            String status
    ) {}

    public record UserResponse(
            UUID id,
            String email,
            String name,
            String role,
            String department,
            UUID organizationId,
            String organizationName,
            String phone,
            String status,
            Boolean mustChangePassword,
            Instant lastLoginAt,
            Instant createdAt,
            String tempPassword,
            String emailDeliveryStatus,
            String emailDeliveryMessage
    ) {}

    public record ResetPasswordResponse(
            UUID userId,
            String email,
            String tempPassword,
            String emailDeliveryStatus,
            String emailDeliveryMessage
    ) {}

    public record LoginHistoryResponse(
            UUID id,
            UUID userId,
            String email,
            String ipAddress,
            String userAgent,
            String status,
            String failureReason,
            Instant createdAt
    ) {}
}
