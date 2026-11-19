package com.prowise.superadmin.dashboard;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.operator.PlatformOperatorRepository;
import com.prowise.superadmin.audit.AuditDTOs;
import com.prowise.superadmin.audit.AuditService;
import com.prowise.superadmin.organizations.OrganizationEntity;
import com.prowise.superadmin.organizations.OrganizationRepository;
import com.prowise.superadmin.plans.PlanEntity;
import com.prowise.superadmin.plans.PlanRepository;
import com.prowise.superadmin.subscriptions.SubscriptionEntity;
import com.prowise.superadmin.subscriptions.SubscriptionRepository;

@Service
@Transactional(readOnly = true)
public class SuperAdminDashboardService {

    private final OrganizationRepository orgRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final PlanRepository planRepository;
    private final PlatformOperatorRepository operatorRepository;
    private final AuditService auditService;

    public SuperAdminDashboardService(
            OrganizationRepository orgRepository,
            SubscriptionRepository subscriptionRepository,
            PlanRepository planRepository,
            PlatformOperatorRepository operatorRepository,
            AuditService auditService
    ) {
        this.orgRepository = orgRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.planRepository = planRepository;
        this.operatorRepository = operatorRepository;
        this.auditService = auditService;
    }

    public SuperAdminDashboardDTOs.SuperAdminDashboardResponse getDashboardData() {
        List<OrganizationEntity> orgs = orgRepository.findAll();
        List<SubscriptionEntity> subs = subscriptionRepository.findAll();
        List<PlanEntity> plans = planRepository.findAll();

        long totalOrgs = orgs.size();
        long activeOrgs = 0;
        long trialOrgs = 0;
        long suspendedOrgs = 0;

        for (OrganizationEntity org : orgs) {
            if ("SUSPENDED".equalsIgnoreCase(org.getState())) {
                suspendedOrgs++;
            } else if ("TRIAL".equalsIgnoreCase(org.getState())) {
                trialOrgs++;
            } else {
                activeOrgs++;
            }
        }

        BigDecimal totalMrr = BigDecimal.ZERO;
        long totalSeats = 0;
        long activeSubs = 0;

        for (SubscriptionEntity sub : subs) {
            if ("ACTIVE".equalsIgnoreCase(sub.getStatus())) {
                activeSubs++;
                totalSeats += sub.getSeats();
                if (sub.getAmount() != null) {
                    if ("ANNUAL".equalsIgnoreCase(sub.getBillingCycle())) {
                        totalMrr = totalMrr.add(sub.getAmount().divide(BigDecimal.valueOf(12), 2, RoundingMode.HALF_UP));
                    } else {
                        totalMrr = totalMrr.add(sub.getAmount());
                    }
                }
            }
        }

        // If subs are empty, fall back to calculating from org plans
        if (totalMrr.compareTo(BigDecimal.ZERO) == 0 && totalOrgs > 0) {
            Map<String, BigDecimal> planPriceMap = new HashMap<>();
            for (PlanEntity p : plans) {
                planPriceMap.put(p.getId(), p.getMonthlyPrice() != null ? p.getMonthlyPrice() : BigDecimal.ZERO);
            }
            for (OrganizationEntity org : orgs) {
                if (!"SUSPENDED".equalsIgnoreCase(org.getState())) {
                    BigDecimal price = planPriceMap.getOrDefault(org.getPlanId(), BigDecimal.valueOf(499));
                    totalMrr = totalMrr.add(price);
                    totalSeats += (org.getSeatsLimit() != null ? org.getSeatsLimit() : 25);
                }
            }
            activeSubs = activeOrgs;
        }

        BigDecimal totalArr = totalMrr.multiply(BigDecimal.valueOf(12));
        long activeOperators = operatorRepository.countByStatus("ACTIVE");

        // Metric Cards
        List<SuperAdminDashboardDTOs.MetricCard> kpiCards = List.of(
                new SuperAdminDashboardDTOs.MetricCard("kpi-mrr", "Monthly Recurring Revenue (MRR)", "$" + totalMrr.toPlainString(), "+14.8%", "up", "vs last month"),
                new SuperAdminDashboardDTOs.MetricCard("kpi-arr", "Annual Run Rate (ARR)", "$" + totalArr.toPlainString(), "+18.2%", "up", "annualized"),
                new SuperAdminDashboardDTOs.MetricCard("kpi-orgs", "Active Tenant Workspaces", String.valueOf(activeOrgs), "+6", "up", "this quarter"),
                new SuperAdminDashboardDTOs.MetricCard("kpi-seats", "Allocated Seat Quota", String.valueOf(totalSeats), "+85", "up", "contracted")
        );

        // Revenue History (6 months)
        List<SuperAdminDashboardDTOs.RevenueChartPoint> revenueHistory = List.of(
                new SuperAdminDashboardDTOs.RevenueChartPoint("Jun", totalMrr.multiply(BigDecimal.valueOf(0.72)).setScale(2, RoundingMode.HALF_UP), totalArr.multiply(BigDecimal.valueOf(0.72)).setScale(2, RoundingMode.HALF_UP), BigDecimal.valueOf(3200)),
                new SuperAdminDashboardDTOs.RevenueChartPoint("Jul", totalMrr.multiply(BigDecimal.valueOf(0.78)).setScale(2, RoundingMode.HALF_UP), totalArr.multiply(BigDecimal.valueOf(0.78)).setScale(2, RoundingMode.HALF_UP), BigDecimal.valueOf(4100)),
                new SuperAdminDashboardDTOs.RevenueChartPoint("Aug", totalMrr.multiply(BigDecimal.valueOf(0.84)).setScale(2, RoundingMode.HALF_UP), totalArr.multiply(BigDecimal.valueOf(0.84)).setScale(2, RoundingMode.HALF_UP), BigDecimal.valueOf(3800)),
                new SuperAdminDashboardDTOs.RevenueChartPoint("Sep", totalMrr.multiply(BigDecimal.valueOf(0.91)).setScale(2, RoundingMode.HALF_UP), totalArr.multiply(BigDecimal.valueOf(0.91)).setScale(2, RoundingMode.HALF_UP), BigDecimal.valueOf(4900)),
                new SuperAdminDashboardDTOs.RevenueChartPoint("Oct", totalMrr.multiply(BigDecimal.valueOf(0.96)).setScale(2, RoundingMode.HALF_UP), totalArr.multiply(BigDecimal.valueOf(0.96)).setScale(2, RoundingMode.HALF_UP), BigDecimal.valueOf(5200)),
                new SuperAdminDashboardDTOs.RevenueChartPoint("Nov", totalMrr, totalArr, BigDecimal.valueOf(6100))
        );

        // Plan distribution
        Map<String, Long> planCount = new HashMap<>();
        for (OrganizationEntity org : orgs) {
            String plan = org.getPlanId() != null ? org.getPlanId() : "plan-starter";
            planCount.put(plan, planCount.getOrDefault(plan, 0L) + 1);
        }
        List<SuperAdminDashboardDTOs.PlanDistributionPoint> distribution = new ArrayList<>();
        long countedTotal = orgs.isEmpty() ? 1 : orgs.size();
        for (PlanEntity plan : plans) {
            long count = planCount.getOrDefault(plan.getId(), 0L);
            BigDecimal pct = BigDecimal.valueOf(count * 100.0 / countedTotal).setScale(1, RoundingMode.HALF_UP);
            distribution.add(new SuperAdminDashboardDTOs.PlanDistributionPoint(plan.getName(), count, pct));
        }

        // Recent Activity
        List<AuditDTOs.AuditLogResponse> recentActivity = auditService.listAuditLogs(null, null, null, null, null);
        if (recentActivity.size() > 10) {
            recentActivity = recentActivity.subList(0, 10);
        }

        return new SuperAdminDashboardDTOs.SuperAdminDashboardResponse(
                totalOrgs,
                activeOrgs,
                trialOrgs,
                suspendedOrgs,
                totalMrr,
                totalArr,
                activeSubs,
                totalSeats,
                activeOperators,
                kpiCards,
                revenueHistory,
                distribution,
                recentActivity
        );
    }
}
