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
                    org.getDomain() != null ? org.getDomain() : (org.getSlug() + ".prowise.io"),
                    org.getIndustry() != null ? org.getIndustry() : "Enterprise Software",
                    org.getCountry() != null ? org.getCountry() : "United States",
                    org.getTimezone() != null ? org.getTimezone() : "UTC",
                    org.getOwnerName() != null ? org.getOwnerName() : "Organization Admin",
                    org.getOwnerEmail() != null ? org.getOwnerEmail() : "admin@" + (org.getSlug() != null ? org.getSlug() : "org") + ".com",
                    org.getState(),
                    org.getPlanId() != null ? org.getPlanId() : "plan-starter",
                    seatsUsed,
                    org.getSeatsLimit() != null ? org.getSeatsLimit() : 25,
                    projectsCount,
                    storageUsedGb,
                    mrr != null ? mrr : BigDecimal.valueOf(499),
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
