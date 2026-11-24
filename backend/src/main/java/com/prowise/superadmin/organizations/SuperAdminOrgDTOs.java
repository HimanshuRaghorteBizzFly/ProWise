package com.prowise.superadmin.organizations;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public final class SuperAdminOrgDTOs {

    private SuperAdminOrgDTOs() {}

    public record OrgDetailResponse(
            UUID id,
            String name,
            String slug,
            String domain,
            String industry,
            String country,
            String timezone,
            String ownerName,
            String ownerEmail,
            String status,
            String planId,
            int seatsUsed,
            int seatsLimit,
            int projectsCount,
            double storageUsedGb,
            BigDecimal mrr,
            Instant createdAt,
            Instant lastActivityAt,
            String suspendedReason,
            String notes
    ) {
        public static OrgDetailResponse fromEntity(OrganizationEntity org, int seatsUsed, int projectsCount, double storageUsedGb, BigDecimal mrr) {
            return new OrgDetailResponse(
                    org.getId(),
                    org.getName(),
                    org.getSlug(),
                    // Stored values only: missing fields stay null instead of invented defaults.
                    org.getDomain(),
                    org.getIndustry(),
                    org.getCountry(),
                    org.getTimezone(),
                    org.getOwnerName(),
                    org.getOwnerEmail(),
                    org.getState(),
                    org.getPlanId(),
                    seatsUsed,
                    org.getSeatsLimit() != null ? org.getSeatsLimit() : 0,
                    projectsCount,
                    storageUsedGb,
                    mrr != null ? mrr : BigDecimal.ZERO,
                    org.getCreatedAt(),
                    org.getUpdatedAt(),
                    org.getSuspendedReason(),
                    org.getNotes()
            );
        }
    }

    public record CreateOrgRequest(
            @NotBlank String name,
            @NotBlank String slug,
            String domain,
            String industry,
            String country,
            String timezone,
            @NotBlank String ownerName,
            @NotBlank @Email String ownerEmail,
            String planId,
            Integer seatsLimit,
            String notes
    ) {}

    public record UpdateOrgRequest(
            String name,
            String domain,
            String industry,
            String country,
            String timezone,
            String ownerName,
            String ownerEmail,
            String planId,
            Integer seatsLimit,
            String notes
    ) {}

    public record SuspendOrgRequest(
            @NotBlank String reason
    ) {}

    public record BulkSuspendRequest(
            @NotNull List<UUID> orgIds,
            @NotBlank String reason
    ) {}

    public record OrgSummaryResponse(
            long totalOrgs,
            long activeOrgs,
            long trialOrgs,
            long suspendedOrgs,
            BigDecimal totalMrr
    ) {}
}
