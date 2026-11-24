package com.prowise.superadmin.billing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public final class BillingDTOs {

    private BillingDTOs() {}

    public record PaymentResponse(
            String id,
            String transactionRef,
            UUID orgId,
            String subscriptionId,
            String invoiceId,
            BigDecimal amount,
            BigDecimal refundedAmount,
            String currency,
            String status,
            String method,
            String methodLast4,
            String gatewayLabel,
            String description,
            String failureReason,
            String refundReason,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
        public static PaymentResponse fromEntity(PaymentEntity p) {
            return new PaymentResponse(
                    p.getId(),
                    p.getTransactionRef(),
                    p.getOrgId(),
                    p.getSubscriptionId(),
                    p.getInvoiceId(),
                    p.getAmount(),
                    p.getRefundedAmount(),
                    p.getCurrency(),
                    p.getStatus(),
                    p.getMethod(),
                    p.getMethodLast4(),
                    p.getGatewayLabel(),
                    p.getDescription(),
                    p.getFailureReason(),
                    p.getRefundReason(),
                    p.getCreatedAt(),
                    p.getUpdatedAt(),
                    p.getVersion() == null ? 0L : p.getVersion()
            );
        }
    }

    public record RecordPaymentRequest(
            @NotNull UUID orgId,
            String subscriptionId,
            String invoiceId,
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            String currency,
            String method,
            String methodLast4,
            String gatewayLabel,
            @NotBlank String description
    ) {}

    public record UpdatePaymentRequest(
            UUID orgId,
            BigDecimal amount,
            String status,
            String method,
            String methodLast4,
            String gatewayLabel,
            String description,
            String failureReason,
            Long expectedVersion
    ) {}

    public record RefundPaymentRequest(
            @NotNull @DecimalMin("0.01") BigDecimal amount,
            @NotBlank String reason,
            Long expectedVersion
    ) {}

    public record PaymentSummaryResponse(
            long totalTransactions,
            BigDecimal totalVolume,
            BigDecimal refundedVolume,
            long successfulCount,
            long failedCount
    ) {}
}
