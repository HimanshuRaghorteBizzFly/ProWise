package com.prowise.superadmin.subscriptions;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.superadmin.audit.AuditService;
import com.prowise.superadmin.plans.PlanEntity;
import com.prowise.superadmin.plans.PlanRepository;

/** Tenant subscriptions. Every change is version-checked and audited in the same transaction (rules 4 and 5). */
@Service
@Transactional
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepository;
    private final PlanRepository planRepository;
    private final AuditService auditService;

    public SubscriptionService(SubscriptionRepository subscriptionRepository, PlanRepository planRepository, AuditService auditService) {
        this.subscriptionRepository = subscriptionRepository;
        this.planRepository = planRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<SubscriptionDTOs.SubscriptionResponse> listSubscriptions(String planId, String status) {
        String safePlan = (planId != null && !planId.equals("ALL")) ? planId : null;
        String safeStatus = (status != null && !status.equals("ALL")) ? status : null;

        List<SubscriptionEntity> list = subscriptionRepository.searchSubscriptions(safePlan, safeStatus);
        return list.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public SubscriptionDTOs.SubscriptionResponse getSubscription(String id) {
        return toResponse(find(id));
    }

    public SubscriptionDTOs.SubscriptionResponse assignSubscription(SubscriptionDTOs.AssignSubscriptionRequest request, String actorEmail) {
        if (request.orgId() == null || request.planId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "Organization ID and Plan ID are required");
        }

        PlanEntity plan = planRepository.findById(request.planId()).orElseThrow(ApiException::notFound);

        String id = "sub-" + UUID.randomUUID().toString().substring(0, 8);
        SubscriptionEntity entity = new SubscriptionEntity(id, request.orgId(), request.planId());

        String cycle = request.billingCycle() != null ? request.billingCycle().toUpperCase() : "MONTHLY";
        entity.setBillingCycle(cycle);
        entity.setStatus("ACTIVE");
        entity.setSeats(request.seats() != null ? request.seats() : plan.getMaxSeats());

        BigDecimal amount = "ANNUAL".equalsIgnoreCase(cycle) ? plan.getAnnualPrice() : plan.getMonthlyPrice();
        entity.setAmount(amount);
        entity.setCurrency(plan.getCurrency());
        entity.setAutoRenew(request.autoRenew() == null || request.autoRenew());
        entity.setPaymentMethodLabel(request.paymentMethodLabel() != null ? request.paymentMethodLabel() : "Corporate Credit Card");

        Instant now = Instant.now();
        entity.setCurrentPeriodStart(now);
        entity.setCurrentPeriodEnd("ANNUAL".equalsIgnoreCase(cycle) ? now.plusSeconds(365L * 24 * 3600) : now.plusSeconds(30L * 24 * 3600));

        SubscriptionEntity saved = subscriptionRepository.save(entity);
        subscriptionRepository.flush();
        audit("ASSIGN_SUBSCRIPTION", "Assigned plan " + saved.getPlanId() + " to organization " + saved.getOrgId(), actorEmail, saved, "INFO");
        return toResponse(saved);
    }

    public SubscriptionDTOs.SubscriptionResponse updateSubscription(String id, SubscriptionDTOs.UpdateSubscriptionRequest request, String actorEmail) {
        SubscriptionEntity entity = find(id);
        ExpectedVersion.checkRequired(entity.getVersion(), request.expectedVersion());

        if (request.planId() != null) {
            planRepository.findById(request.planId()).orElseThrow(ApiException::notFound);
            entity.setPlanId(request.planId());
        }
        if (request.billingCycle() != null) entity.setBillingCycle(request.billingCycle().toUpperCase());
        if (request.status() != null) entity.setStatus(request.status().toUpperCase());
        if (request.seats() != null) entity.setSeats(request.seats());
        if (request.amount() != null) entity.setAmount(request.amount());
        if (request.currentPeriodStart() != null) entity.setCurrentPeriodStart(request.currentPeriodStart());
        if (request.currentPeriodEnd() != null) entity.setCurrentPeriodEnd(request.currentPeriodEnd());
        if (request.autoRenew() != null) entity.setAutoRenew(request.autoRenew());
        if (request.cancelAtPeriodEnd() != null) entity.setCancelAtPeriodEnd(request.cancelAtPeriodEnd());
        if (request.paymentMethodLabel() != null) entity.setPaymentMethodLabel(request.paymentMethodLabel());

        return saveAndAudit(entity, "UPDATE_SUBSCRIPTION", "Updated subscription " + id, actorEmail, "INFO");
    }

    public SubscriptionDTOs.SubscriptionResponse renewSubscription(String id, Long expectedVersion, String actorEmail) {
        SubscriptionEntity entity = find(id);
        ExpectedVersion.checkRequired(entity.getVersion(), expectedVersion);

        Instant start = entity.getCurrentPeriodEnd();
        Instant end = "ANNUAL".equalsIgnoreCase(entity.getBillingCycle())
                ? start.plusSeconds(365L * 24 * 3600)
                : start.plusSeconds(30L * 24 * 3600);

        entity.setCurrentPeriodStart(start);
        entity.setCurrentPeriodEnd(end);
        entity.setStatus("ACTIVE");
        return saveAndAudit(entity, "RENEW_SUBSCRIPTION", "Renewed subscription " + id + " until " + end, actorEmail, "INFO");
    }

    public SubscriptionDTOs.SubscriptionResponse cancelSubscription(String id, boolean immediate, Long expectedVersion, String actorEmail) {
        SubscriptionEntity entity = find(id);
        ExpectedVersion.checkRequired(entity.getVersion(), expectedVersion);

        if (immediate) {
            entity.setStatus("CANCELLED");
        } else {
            entity.setCancelAtPeriodEnd(true);
        }
        entity.setAutoRenew(false);
        return saveAndAudit(entity, "CANCEL_SUBSCRIPTION",
                (immediate ? "Cancelled subscription " : "Scheduled cancellation at period end for subscription ") + id,
                actorEmail, "WARNING");
    }

    public SubscriptionDTOs.SubscriptionResponse reactivateSubscription(String id, Long expectedVersion, String actorEmail) {
        SubscriptionEntity entity = find(id);
        ExpectedVersion.checkRequired(entity.getVersion(), expectedVersion);

        entity.setStatus("ACTIVE");
        entity.setCancelAtPeriodEnd(false);
        entity.setAutoRenew(true);
        return saveAndAudit(entity, "REACTIVATE_SUBSCRIPTION", "Reactivated subscription " + id, actorEmail, "INFO");
    }

    public void deleteSubscription(String id, Long expectedVersion, String actorEmail) {
        SubscriptionEntity entity = find(id);
        ExpectedVersion.checkRequired(entity.getVersion(), expectedVersion);
        subscriptionRepository.delete(entity);
        subscriptionRepository.flush();
        audit("DELETE_SUBSCRIPTION", "Deleted subscription " + id, actorEmail, entity, "CRITICAL");
    }

    private SubscriptionEntity find(String id) {
        return subscriptionRepository.findById(id).orElseThrow(ApiException::notFound);
    }

    private SubscriptionDTOs.SubscriptionResponse saveAndAudit(
            SubscriptionEntity entity, String action, String summary, String actorEmail, String severity) {
        entity.setUpdatedAt(Instant.now());
        SubscriptionEntity saved = subscriptionRepository.save(entity);
        subscriptionRepository.flush();
        audit(action, summary, actorEmail, saved, severity);
        return toResponse(saved);
    }

    private void audit(String action, String summary, String actorEmail, SubscriptionEntity s, String severity) {
        auditService.logActivity("BILLING", action, summary, "Super Admin", actorEmail, s.getId(), severity);
    }

    private SubscriptionDTOs.SubscriptionResponse toResponse(SubscriptionEntity s) {
        return new SubscriptionDTOs.SubscriptionResponse(
                s.getId(),
                s.getOrgId(),
                s.getPlanId(),
                s.getBillingCycle(),
                s.getStatus(),
                s.getSeats(),
                s.getAmount(),
                s.getCurrency(),
                s.getCurrentPeriodStart(),
                s.getCurrentPeriodEnd(),
                s.isAutoRenew(),
                s.isCancelAtPeriodEnd(),
                s.getPaymentMethodLabel(),
                s.getCreatedAt(),
                s.getUpdatedAt(),
                s.getVersion() == null ? 0L : s.getVersion()
        );
    }
}
