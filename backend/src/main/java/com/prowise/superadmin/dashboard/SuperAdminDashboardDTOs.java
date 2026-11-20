package com.prowise.superadmin.dashboard;

import java.math.BigDecimal;
import java.util.List;
import com.prowise.superadmin.audit.AuditDTOs;

public final class SuperAdminDashboardDTOs {

    private SuperAdminDashboardDTOs() {}

    public record MetricCard(
            String id,
            String title,
            String value,
            String change,
            String trend, // "up", "down", "neutral"
            String period
    ) {}

    public record RevenueChartPoint(
            String month,
            BigDecimal mrr,
            BigDecimal arr,
            BigDecimal netNew
    ) {}

    public record PlanDistributionPoint(
            String planName,
            long count,
            BigDecimal percentage
    ) {}

    public record SuperAdminDashboardResponse(
            long totalOrganizations,
            long activeOrganizations,
            long trialOrganizations,
            long suspendedOrganizations,
            BigDecimal totalMrr,
            BigDecimal totalArr,
            long activeSubscriptions,
            long totalSeatsAllocated,
            long activeOperators,
            List<MetricCard> kpiCards,
            List<RevenueChartPoint> revenueHistory,
            List<PlanDistributionPoint> planDistribution,
            List<AuditDTOs.AuditLogResponse> recentActivity
    ) {}
}
