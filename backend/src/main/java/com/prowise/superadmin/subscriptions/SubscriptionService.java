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
import com.prowise.superadmin.plans.PlanEntity;
import com.prowise.superadmin.plans.PlanRepository;

@Service
@Transactional
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepository;
    private final PlanRepository planRepository;

    public SubscriptionService(SubscriptionRepository subscriptionRepository, PlanRepository planRepository) {
        this.subscriptionRepository = subscriptionRepository;
        this.planRepository = planRepository;
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
        SubscriptionEntity entity = subscriptionRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Subscription not found: " + id));
        return toResponse(entity);
    }

    public SubscriptionDTOs.SubscriptionResponse assignSubscription(SubscriptionDTOs.AssignSubscriptionRequest request) {
        if (request.orgId() == null || request.planId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "Organization ID and Plan ID are required");
        }

        PlanEntity plan = planRepository.findById(request.planId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Plan not found: " + request.planId()));

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
        return toResponse(saved);
    }

    public SubscriptionDTOs.SubscriptionResponse updateSubscription(String id, SubscriptionDTOs.UpdateSubscriptionRequest request) {
        SubscriptionEntity entity = subscriptionRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Subscription not found: " + id));

        if (request.planId() != null) entity.setPlanId(request.planId());
        if (request.billingCycle() != null) entity.setBillingCycle(request.billingCycle().toUpperCase());
        if (request.status() != null) entity.setStatus(request.status().toUpperCase());
        if (request.seats() != null) entity.setSeats(request.seats());
        if (request.amount() != null) entity.setAmount(request.amount());
        if (request.currentPeriodStart() != null) entity.setCurrentPeriodStart(request.currentPeriodStart());
        if (request.currentPeriodEnd() != null) entity.setCurrentPeriodEnd(request.currentPeriodEnd());
        if (request.autoRenew() != null) entity.setAutoRenew(request.autoRenew());
        if (request.cancelAtPeriodEnd() != null) entity.setCancelAtPeriodEnd(request.cancelAtPeriodEnd());
        if (request.paymentMethodLabel() != null) entity.setPaymentMethodLabel(request.paymentMethodLabel());

        entity.setUpdatedAt(Instant.now());
        SubscriptionEntity updated = subscriptionRepository.save(entity);
        return toResponse(updated);
    }

    public SubscriptionDTOs.SubscriptionResponse renewSubscription(String id) {
        SubscriptionEntity entity = subscriptionRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Subscription not found: " + id));

        Instant start = entity.getCurrentPeriodEnd();
        Instant end = "ANNUAL".equalsIgnoreCase(entity.getBillingCycle())
                ? start.plusSeconds(365L * 24 * 3600)
                : start.plusSeconds(30L * 24 * 3600);

        entity.setCurrentPeriodStart(start);
        entity.setCurrentPeriodEnd(end);
        entity.setStatus("ACTIVE");
        entity.setUpdatedAt(Instant.now());

        return toResponse(subscriptionRepository.save(entity));
    }

    public SubscriptionDTOs.SubscriptionResponse cancelSubscription(String id, boolean immediate) {
        SubscriptionEntity entity = subscriptionRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Subscription not found: " + id));

        if (immediate) {
            entity.setStatus("CANCELLED");
            entity.setAutoRenew(false);
        } else {
            entity.setCancelAtPeriodEnd(true);
            entity.setAutoRenew(false);
        }
        entity.setUpdatedAt(Instant.now());
        return toResponse(subscriptionRepository.save(entity));
    }

    public SubscriptionDTOs.SubscriptionResponse reactivateSubscription(String id) {
        SubscriptionEntity entity = subscriptionRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Subscription not found: " + id));

        entity.setStatus("ACTIVE");
        entity.setCancelAtPeriodEnd(false);
        entity.setAutoRenew(true);
        entity.setUpdatedAt(Instant.now());
        return toResponse(subscriptionRepository.save(entity));
    }

    public void deleteSubscription(String id) {
        SubscriptionEntity entity = subscriptionRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Subscription not found: " + id));
        subscriptionRepository.delete(entity);
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
                s.getUpdatedAt()
        );
    }
}
