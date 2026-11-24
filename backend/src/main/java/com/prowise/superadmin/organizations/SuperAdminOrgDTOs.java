package com.prowise.superadmin.organizations;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
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
            Integer seatsLimit,
            int projectsCount,
            double storageUsedGb,
            BigDecimal mrr,
            Instant createdAt,
            Instant lastActivityAt,
            String suspendedReason,
            String notes,
            long version
    ) {
        /** Unknown values stay null (shown as "not set"); nothing is filled in with invented defaults. */
        public static OrgDetailResponse fromEntity(OrganizationEntity org, int seatsUsed, int projectsCount, double storageUsedGb, BigDecimal mrr) {
            return new OrgDetailResponse(
                    org.getId(),
                    org.getName(),
                    org.getSlug(),
<<<<<<< HEAD
                    // Stored values only: missing fields stay null instead of invented defaults.
=======
>>>>>>> 29db595 (Initial ProWise project upload)
                    org.getDomain(),
                    org.getIndustry(),
                    org.getCountry(),
                    org.getTimezone(),
                    org.getOwnerName(),
                    org.getOwnerEmail(),
                    org.getState(),
                    org.getPlanId(),
                    seatsUsed,
<<<<<<< HEAD
                    org.getSeatsLimit() != null ? org.getSeatsLimit() : 0,
                    projectsCount,
                    storageUsedGb,
                    mrr != null ? mrr : BigDecimal.ZERO,
=======
                    org.getSeatsLimit(),
                    projectsCount,
                    storageUsedGb,
                    mrr,
>>>>>>> 29db595 (Initial ProWise project upload)
                    org.getCreatedAt(),
                    org.getUpdatedAt(),
                    org.getSuspendedReason(),
                    org.getNotes(),
                    org.getVersion() == null ? 0L : org.getVersion()
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
            String notes,
            Long expectedVersion
    ) {}

    public record SuspendOrgRequest(
            @NotBlank String reason,
            Long expectedVersion
    ) {}

    /** One organization of a bulk suspension with the version the client read. */
    public record BulkSuspendItem(
            @NotNull UUID id,
            Long expectedVersion
    ) {}

    /**
     * Bulk suspension carries a version per organization; one stale or unknown item refuses the whole batch
     * (409 STALE_VERSION or 404), so nothing is suspended from an outdated list.
     */
    public record BulkSuspendRequest(
            @NotEmpty List<@Valid BulkSuspendItem> items,
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
