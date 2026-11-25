package com.prowise.superadmin.billing;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.superadmin.common.AdminRequests;
import com.prowise.superadmin.audit.AuditService;

@Service
@Transactional
public class BillingService {

    private final PaymentRepository paymentRepository;
    private final AuditService auditService;

    public BillingService(PaymentRepository paymentRepository, AuditService auditService) {
        this.paymentRepository = paymentRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<BillingDTOs.PaymentResponse> listPayments(UUID orgId, String status, String search) {
        String safeStatus = (status != null && !status.equalsIgnoreCase("ALL")) ? status.toUpperCase() : null;
        List<PaymentEntity> list = paymentRepository.findFiltered(orgId, safeStatus);
        if (search != null && !search.trim().isEmpty()) {
            String lower = search.trim().toLowerCase();
            list = list.stream().filter(p ->
                    p.getTransactionRef().toLowerCase().contains(lower) ||
                    p.getDescription().toLowerCase().contains(lower) ||
                    (p.getGatewayLabel() != null && p.getGatewayLabel().toLowerCase().contains(lower)) ||
                    (p.getMethodLast4() != null && p.getMethodLast4().contains(lower))
            ).toList();
        }
        return list.stream().map(BillingDTOs.PaymentResponse::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public BillingDTOs.PaymentResponse getPayment(String id) {
        PaymentEntity entity = paymentRepository.findById(id)
                .orElseThrow(ApiException::notFound);
        return BillingDTOs.PaymentResponse.fromEntity(entity);
    }

    public BillingDTOs.PaymentResponse recordPayment(BillingDTOs.RecordPaymentRequest req, String actorEmail) {
        String paymentId = "pay-" + UUID.randomUUID().toString().substring(0, 8);
        String txnRef = "TXN-" + System.currentTimeMillis() % 1000000;

        PaymentEntity entity = new PaymentEntity();
        entity.setId(paymentId);
        entity.setTransactionRef(txnRef);
        entity.setOrgId(req.orgId());
        entity.setSubscriptionId(req.subscriptionId());
        entity.setInvoiceId(req.invoiceId());
        entity.setAmount(req.amount());
        entity.setRefundedAmount(BigDecimal.ZERO);
        entity.setCurrency(req.currency() != null ? req.currency() : "USD");
        entity.setStatus("SUCCEEDED");
        entity.setMethod(req.method() != null ? req.method().toUpperCase() : "CARD");
        entity.setMethodLast4(req.methodLast4() != null ? req.methodLast4() : "4242");
        entity.setGatewayLabel(req.gatewayLabel() != null ? req.gatewayLabel() : "Stripe Gateway");
        entity.setDescription(req.description());
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());

        PaymentEntity saved = paymentRepository.save(entity);
        paymentRepository.flush();

        auditService.logActivity(
                "PAYMENT",
                "RECORD_PAYMENT",
                "Recorded payment " + txnRef + " of $" + req.amount(),
                "Super Admin",
                actorEmail,
                txnRef,
                "INFO"
        );

        return BillingDTOs.PaymentResponse.fromEntity(saved);
    }

    public BillingDTOs.PaymentResponse updatePayment(String id, BillingDTOs.UpdatePaymentRequest req, String actorEmail) {
        PaymentEntity entity = paymentRepository.findById(id)
                .orElseThrow(ApiException::notFound);
        ExpectedVersion.checkRequired(entity.getVersion(), req.expectedVersion());

        if (req.orgId() != null) entity.setOrgId(req.orgId());
        if (req.amount() != null) entity.setAmount(req.amount());
        if (req.status() != null) entity.setStatus(req.status().toUpperCase());
        if (req.method() != null) entity.setMethod(req.method().toUpperCase());
        if (req.methodLast4() != null) entity.setMethodLast4(req.methodLast4());
        if (req.gatewayLabel() != null) entity.setGatewayLabel(req.gatewayLabel());
        if (req.description() != null) entity.setDescription(req.description());
        if (req.failureReason() != null) entity.setFailureReason(req.failureReason());
        entity.setUpdatedAt(Instant.now());

        PaymentEntity updated = paymentRepository.save(entity);
        paymentRepository.flush();

        auditService.logActivity(
                "PAYMENT",
                "UPDATE_PAYMENT",
                "Updated payment transaction " + updated.getTransactionRef(),
                "Super Admin",
                actorEmail,
                updated.getTransactionRef(),
                "INFO"
        );

        return BillingDTOs.PaymentResponse.fromEntity(updated);
    }

    public BillingDTOs.PaymentResponse retryPayment(String id, Long expectedVersion, String actorEmail) {
        PaymentEntity entity = paymentRepository.findById(id)
                .orElseThrow(ApiException::notFound);
        ExpectedVersion.checkRequired(entity.getVersion(), expectedVersion);

        entity.setStatus("SUCCEEDED");
        entity.setFailureReason(null);
        entity.setUpdatedAt(Instant.now());
        PaymentEntity updated = paymentRepository.save(entity);
        paymentRepository.flush();

        auditService.logActivity(
                "PAYMENT",
                "RETRY_PAYMENT",
                "Retried and settled payment transaction " + updated.getTransactionRef(),
                "Super Admin",
                actorEmail,
                updated.getTransactionRef(),
                "INFO"
        );

        return BillingDTOs.PaymentResponse.fromEntity(updated);
    }

    public BillingDTOs.PaymentResponse refundPayment(String id, BillingDTOs.RefundPaymentRequest req, String actorEmail) {
        PaymentEntity entity = paymentRepository.findById(id)
                .orElseThrow(ApiException::notFound);
        ExpectedVersion.checkRequired(entity.getVersion(), req.expectedVersion());

        BigDecimal currentRefunded = entity.getRefundedAmount() != null ? entity.getRefundedAmount() : BigDecimal.ZERO;
        BigDecimal newRefunded = currentRefunded.add(req.amount());

        if (newRefunded.compareTo(entity.getAmount()) > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "REFUND_EXCEEDS_AMOUNT", "Total refund cannot exceed original charge amount.");
        }

        entity.setRefundedAmount(newRefunded);
        entity.setRefundReason(req.reason());
        if (newRefunded.compareTo(entity.getAmount()) >= 0) {
            entity.setStatus("REFUNDED");
        } else {
            entity.setStatus("PARTIALLY_REFUNDED");
        }
        entity.setUpdatedAt(Instant.now());

        PaymentEntity updated = paymentRepository.save(entity);
        paymentRepository.flush();

        auditService.logActivity(
                "PAYMENT",
                "REFUND_PAYMENT",
                "Refunded $" + req.amount() + " for " + updated.getTransactionRef() + " (" + req.reason() + ")",
                "Super Admin",
                actorEmail,
                updated.getTransactionRef(),
                "WARNING"
        );

        return BillingDTOs.PaymentResponse.fromEntity(updated);
    }

    public void deletePayment(String id, Long expectedVersion, String actorEmail) {
        PaymentEntity entity = paymentRepository.findById(id)
                .orElseThrow(ApiException::notFound);
        ExpectedVersion.checkRequired(entity.getVersion(), expectedVersion);

        paymentRepository.delete(entity);
        paymentRepository.flush();

        auditService.logActivity(
                "PAYMENT",
                "DELETE_PAYMENT",
                "Deleted payment record " + entity.getTransactionRef(),
                "Super Admin",
                actorEmail,
                entity.getTransactionRef(),
                "WARNING"
        );
    }

    /** All-or-nothing: an unknown id is 404 and an outdated version 409 STALE_VERSION; nothing is deleted then. */
    public void bulkDelete(List<AdminRequests.VersionedId> items, String actorEmail) {
        List<PaymentEntity> entities = new java.util.ArrayList<>();
        for (AdminRequests.VersionedId item : items) {
            PaymentEntity entity = paymentRepository.findById(item.id()).orElseThrow(ApiException::notFound);
            ExpectedVersion.checkRequired(entity.getVersion(), item.expectedVersion());
            entities.add(entity);
        }
        paymentRepository.deleteAll(entities);
        paymentRepository.flush();

        auditService.logActivity(
                "PAYMENT",
                "BULK_DELETE_PAYMENTS",
                "Bulk deleted " + entities.size() + " payment records",
                "Super Admin",
                actorEmail,
                entities.size() + " records",
                "WARNING"
        );
    }

    @Transactional(readOnly = true)
    public BillingDTOs.PaymentSummaryResponse getSummary() {
        List<PaymentEntity> all = paymentRepository.findAll();
        long total = all.size();
        BigDecimal volume = BigDecimal.ZERO;
        BigDecimal refunded = BigDecimal.ZERO;
        long succeeded = 0;
        long failed = 0;

        for (PaymentEntity p : all) {
            if ("SUCCEEDED".equalsIgnoreCase(p.getStatus())) {
                succeeded++;
                volume = volume.add(p.getAmount());
            } else if ("FAILED".equalsIgnoreCase(p.getStatus())) {
                failed++;
            }
            if (p.getRefundedAmount() != null) {
                refunded = refunded.add(p.getRefundedAmount());
            }
        }

        return new BillingDTOs.PaymentSummaryResponse(total, volume, refunded, succeeded, failed);
    }
}
