package com.prowise.superadmin.subscriptions;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class SubscriptionDTOs {

    public record SubscriptionResponse(
            String id,
            UUID orgId,
            String planId,
            String billingCycle,
            String status,
            int seats,
            BigDecimal amount,
            String currency,
            Instant currentPeriodStart,
            Instant currentPeriodEnd,
            boolean autoRenew,
            boolean cancelAtPeriodEnd,
            String paymentMethodLabel,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {}

    public record AssignSubscriptionRequest(
            UUID orgId,
            String planId,
            String billingCycle,
            Integer seats,
            Boolean autoRenew,
            String paymentMethodLabel
    ) {}

    public record CancelSubscriptionRequest(
            Long expectedVersion,
            Boolean immediate
    ) {}

    public record UpdateSubscriptionRequest(
            String planId,
            String billingCycle,
            String status,
            Integer seats,
            BigDecimal amount,
            Instant currentPeriodStart,
            Instant currentPeriodEnd,
            Boolean autoRenew,
            Boolean cancelAtPeriodEnd,
            String paymentMethodLabel,
            Long expectedVersion
    ) {}
}
