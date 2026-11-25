package com.prowise.operator.console;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import io.swagger.v3.oas.annotations.media.Schema;

/** Response and request shapes of the operator console endpoints (JSON is snake_case). */
public final class ConsoleDTOs {

    private ConsoleDTOs() {}

    /** Server pagination: page is 0-based; size 1..100 (default 25). */
    @Schema(name = "OperatorPage")
    public record Page<T>(List<T> items, long total, int page, int size) {}

    // ---------------------------------------------------------------- activity logs

    @Schema(name = "OperatorActivityLogItem")
    public record ActivityLogItem(
            String id,
            @Schema(description = "ACTIVITY (operator_activity_logs) or AUDIT (operator_audit_logs)") String source,
            String operatorId,
            String operatorName,
            String departmentId,
            String action,
            String resourceType,
            String resourceId,
            String moduleKey,
            String details,
            String ipAddress,
            Instant occurredAt
    ) {}

    // ---------------------------------------------------------------- organizations

    @Schema(name = "OperatorOrganizationItem")
    public record OrganizationItem(
            String id,
            String name,
            String slug,
            String state,
            Instant createdAt,
            long memberCount,
            long projectCount,
            String ownerEmail,
            String subscriptionId,
            String subscriptionStatus,
            String planId,
            String planName
    ) {}

    @Schema(name = "OperatorOrganizationSubscription")
    public record OrganizationSubscription(
            String id, String planId, String planName, String status, String billingCycle, int seats,
            Instant currentPeriodEnd, Instant createdAt) {}

    @Schema(name = "OperatorOrganizationDetail")
    public record OrganizationDetail(
            String id,
            String name,
            String slug,
            String state,
            String timezone,
            String suspendedReason,
            Instant createdAt,
            Instant updatedAt,
            String ownerEmail,
            long memberCount,
            long disabledMemberCount,
            long projectCount,
            Map<String, Long> projectsByLifecycle,
            List<OrganizationSubscription> subscriptions,
            long failedPaymentCount,
            long openInvoiceCount
    ) {}

    // ---------------------------------------------------------------- billing (read-only, dormant)

    @Schema(name = "OperatorSubscriptionItem")
    public record SubscriptionItem(
            String id,
            String orgId,
            String orgName,
            String orgSlug,
            String planId,
            String planCode,
            String planName,
            String billingCycle,
            String status,
            int seats,
            long seatsUsed,
            BigDecimal amount,
            String currency,
            Instant currentPeriodStart,
            Instant currentPeriodEnd,
            boolean autoRenew,
            boolean cancelAtPeriodEnd,
            Instant createdAt
    ) {}

    @Schema(name = "OperatorPaymentFailureItem")
    public record PaymentFailureItem(
            String id,
            String transactionRef,
            String orgId,
            String orgName,
            String subscriptionId,
            String invoiceId,
            String invoiceNumber,
            String invoiceStatus,
            BigDecimal amount,
            String currency,
            String method,
            String methodLast4,
            String gatewayLabel,
            String description,
            String failureReason,
            Instant failedAt,
            Instant updatedAt
    ) {}

    @Schema(name = "OperatorInvoiceDeliveryItem")
    public record InvoiceDeliveryItem(
            String invoiceId,
            String invoiceNumber,
            String orgId,
            String orgName,
            String invoiceStatus,
            BigDecimal total,
            LocalDate issueDate,
            LocalDate dueDate,
            @Schema(description = "Latest email_delivery_logs status for this invoice, or NOT_SENT when none exists")
            String deliveryStatus,
            String recipientEmail,
            long deliveryAttempts,
            Instant lastAttemptAt,
            Instant lastSentAt,
            String lastErrorCode
    ) {}

    // ---------------------------------------------------------------- API errors

    @Schema(name = "OperatorApiErrorItem")
    public record ApiErrorItem(
            String id,
            Instant occurredAt,
            String requestId,
            String method,
            String path,
            int status,
            String errorCode,
            String actorType,
            String actorId,
            String orgId
    ) {}

    public record StatusCount(int status, long count) {}

    public record PathCount(String method, String path, long count, long serverErrors) {}

    public record CodeCount(String errorCode, long count) {}

    @Schema(name = "OperatorApiErrorSummary")
    public record ApiErrorSummary(
            Instant from,
            Instant to,
            long total,
            long clientErrors,
            long serverErrors,
            List<StatusCount> byStatus,
            @Schema(description = "Top 20 paths by count") List<PathCount> byPath,
            List<CodeCount> byCode
    ) {}
}
