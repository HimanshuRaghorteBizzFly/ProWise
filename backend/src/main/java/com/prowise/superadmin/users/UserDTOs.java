package com.prowise.superadmin.users;

import java.time.Instant;
import java.util.UUID;

/**
 * Platform user provisioning. No request carries a password and no response returns one:
 * account owners choose their own password through a single-use setup link.
 */
public class UserDTOs {

    public record CreateUserRequest(
            String name,
            String email,
            String role,
            String department,
            UUID organizationId,
            String phone,
            Boolean sendEmail
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

    /**
     * {@code emailDeliveryStatus} / {@code emailDeliveryMessage}: on create, the result of the setup email just sent;
     * on read, the latest setup email for an account still pending activation (null otherwise).
     * Values: DELIVERED, FAILED, NOT_SENT, NOT_REQUESTED.
     */
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
            String emailDeliveryStatus,
            String emailDeliveryMessage
    ) {}

    /** Result of sending a setup or reset link. Contains no credential. */
    public record CredentialDeliveryResponse(
            UUID userId,
            String email,
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
