package com.prowise.superadmin.licenses;

import java.time.Instant;
import java.util.UUID;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public final class LicenseDTOs {

    private LicenseDTOs() {}

    public record LicenseResponse(
            String id,
            String licenseKey,
            UUID orgId,
            String planId,
            String status,
            int maxSeats,
            Instant issuedAt,
            Instant expiresAt,
            Instant revokedAt,
            String revokedReason,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
        public static LicenseResponse fromEntity(LicenseEntity e) {
            return new LicenseResponse(
                    e.getId(),
                    e.getLicenseKey(),
                    e.getOrgId(),
                    e.getPlanId(),
                    e.getStatus(),
                    e.getMaxSeats(),
                    e.getIssuedAt(),
                    e.getExpiresAt(),
                    e.getRevokedAt(),
                    e.getRevokedReason(),
                    e.getCreatedAt(),
                    e.getUpdatedAt(),
                    e.getVersion() == null ? 0L : e.getVersion()
            );
        }
    }

    public record GenerateLicenseRequest(
            UUID orgId,
            String planId,
            @NotNull @Min(1) Integer maxSeats,
            Integer validityDays
    ) {}

    public record ValidateLicenseRequest(
            @NotBlank String licenseKey
    ) {}

    public record ValidateLicenseResponse(
            boolean valid,
            String message,
            LicenseResponse license
    ) {}

    public record RevokeLicenseRequest(
            @NotBlank String reason,
            Long expectedVersion
    ) {}
}
