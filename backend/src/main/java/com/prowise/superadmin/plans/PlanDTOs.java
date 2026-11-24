package com.prowise.superadmin.plans;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public class PlanDTOs {

    public record PlanLimitsDTO(
            int maxSeats,
            int maxProjects,
            int maxWorkspaces,
            int storageGb,
            int apiRateLimitPerMin
    ) {}

    public record PlanResponse(
            String id,
            String code,
            String name,
            String tagline,
            BigDecimal monthlyPrice,
            BigDecimal annualPrice,
            String currency,
            String status,
            boolean isPopular,
            String badgeLabel,
            String brandColor,
            String aiTokenQuota,
            int trialDays,
            PlanLimitsDTO limits,
            List<String> features,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {}

    public record CreatePlanRequest(
            String id,
            String code,
            String name,
            String tagline,
            BigDecimal monthlyPrice,
            BigDecimal annualPrice,
            String currency,
            String status,
            Boolean isPopular,
            String badgeLabel,
            String brandColor,
            String aiTokenQuota,
            Integer trialDays,
            PlanLimitsDTO limits,
            List<String> features
    ) {}

    public record UpdatePlanRequest(
            String name,
            String tagline,
            BigDecimal monthlyPrice,
            BigDecimal annualPrice,
            String status,
            Boolean isPopular,
            String badgeLabel,
            String brandColor,
            String aiTokenQuota,
            Integer trialDays,
            PlanLimitsDTO limits,
            List<String> features,
            Long expectedVersion
    ) {}
}
