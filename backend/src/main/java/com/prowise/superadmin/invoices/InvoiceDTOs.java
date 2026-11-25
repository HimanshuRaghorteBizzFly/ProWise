package com.prowise.superadmin.invoices;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public final class InvoiceDTOs {

    private InvoiceDTOs() {}

    public record LineItemDTO(
            UUID id,
            @NotBlank String description,
            @NotNull Integer quantity,
            @NotNull @DecimalMin("0.00") BigDecimal unitPrice,
            BigDecimal total
    ) {
        public static LineItemDTO fromEntity(InvoiceLineItemEntity entity) {
            return new LineItemDTO(
                    entity.getId(),
                    entity.getDescription(),
                    entity.getQuantity(),
                    entity.getUnitPrice(),
                    entity.getTotal()
            );
        }
    }

    public record InvoiceResponse(
            String id,
            String invoiceNumber,
            UUID orgId,
            String subscriptionId,
            String paymentId,
            LocalDate issueDate,
            LocalDate dueDate,
            String status,
            BigDecimal subtotal,
            BigDecimal taxRate,
            BigDecimal taxAmount,
            BigDecimal total,
            List<LineItemDTO> lineItems,
            String notes,
            Instant paidAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
        public static InvoiceResponse fromEntity(InvoiceEntity entity) {
            List<LineItemDTO> lines = entity.getLineItems() != null ?
                    entity.getLineItems().stream().map(LineItemDTO::fromEntity).toList() : List.of();
            return new InvoiceResponse(
                    entity.getId(),
                    entity.getInvoiceNumber(),
                    entity.getOrgId(),
                    entity.getSubscriptionId(),
                    entity.getPaymentId(),
                    entity.getIssueDate(),
                    entity.getDueDate(),
                    entity.getStatus(),
                    entity.getSubtotal(),
                    entity.getTaxRate(),
                    entity.getTaxAmount(),
                    entity.getTotal(),
                    lines,
                    entity.getNotes(),
                    entity.getPaidAt(),
                    entity.getCreatedAt(),
                    entity.getUpdatedAt(),
                    entity.getVersion() == null ? 0L : entity.getVersion()
            );
        }
    }

    public record CreateInvoiceRequest(
            @NotNull UUID orgId,
            String subscriptionId,
            LocalDate issueDate,
            LocalDate dueDate,
            BigDecimal taxRate,
            String notes,
            @NotEmpty List<LineItemDTO> lineItems
    ) {}

    public record UpdateInvoiceRequest(
            LocalDate issueDate,
            LocalDate dueDate,
            String status,
            BigDecimal taxRate,
            String notes,
            List<LineItemDTO> lineItems,
            Long expectedVersion
    ) {}

    /** Mark paid: expected_version required; payment_id optional (the ?paymentId= query parameter is still accepted). */
    public record MarkPaidRequest(
            Long expectedVersion,
            String paymentId
    ) {}

    public record InvoiceSummaryResponse(
            long totalInvoices,
            BigDecimal totalBilled,
            BigDecimal totalPaid,
            BigDecimal totalOutstanding,
            long overdueCount
    ) {}

    public record SendReminderRequest(
            String recipientEmail,
            String messageNote
    ) {}
}
