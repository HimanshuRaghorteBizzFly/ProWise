package com.prowise.superadmin.billing;

import java.util.List;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.superadmin.common.AdminRequests;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping({"/v1/admin/payments", "/api/v1/admin/payments"})
@Tag(name = "Super Admin Payments", description = "Payment records. Mutations need expected_version (409 STALE_VERSION when stale) and accept Idempotency-Key.")
public class BillingController {

    private final BillingService billingService;

    public BillingController(BillingService billingService) {
        this.billingService = billingService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('payments.view')")
    @Operation(summary = "List payment transactions with optional filters")
    public ResponseEntity<List<BillingDTOs.PaymentResponse>> listPayments(
            @RequestParam(required = false) UUID orgId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search
    ) {
        return ResponseEntity.ok(billingService.listPayments(orgId, status, search));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('payments.view')")
    @Operation(summary = "Get single payment details")
    public ResponseEntity<BillingDTOs.PaymentResponse> getPayment(@PathVariable String id) {
        return ResponseEntity.ok(billingService.getPayment(id));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('payments.view')")
    @Operation(summary = "Get payment transaction KPI summary")
    public ResponseEntity<BillingDTOs.PaymentSummaryResponse> getSummary() {
        return ResponseEntity.ok(billingService.getSummary());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('payments.manage')")
    @Operation(summary = "Record a simulated or offline payment")
    public ResponseEntity<BillingDTOs.PaymentResponse> recordPayment(
            HttpServletRequest request,
            @Valid @RequestBody BillingDTOs.RecordPaymentRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(billingService.recordPayment(body, actor));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('payments.manage')")
    @Operation(summary = "Update payment transaction details (expected_version required)")
    public ResponseEntity<BillingDTOs.PaymentResponse> updatePayment(
            HttpServletRequest request,
            @PathVariable String id,
            @Valid @RequestBody BillingDTOs.UpdatePaymentRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.ok(billingService.updatePayment(id, body, actor));
    }

    @PostMapping("/{id}/retry")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('payments.manage')")
    @Operation(summary = "Retry a failed payment transaction (body: expected_version)")
    public ResponseEntity<BillingDTOs.PaymentResponse> retryPayment(
            HttpServletRequest request,
            @PathVariable String id,
            @RequestBody(required = false) AdminRequests.VersionRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.ok(billingService.retryPayment(id, com.prowise.superadmin.common.AdminRequests.expected(body), actor));
    }

    @PostMapping("/{id}/refund")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('payments.refund')")
    @Operation(summary = "Issue a partial or full refund for a payment (body: amount, reason, expected_version)")
    public ResponseEntity<BillingDTOs.PaymentResponse> refundPayment(
            HttpServletRequest request,
            @PathVariable String id,
            @Valid @RequestBody BillingDTOs.RefundPaymentRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.ok(billingService.refundPayment(id, body, actor));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('payments.manage')")
    @Operation(summary = "Delete a payment record (?expectedVersion= required)")
    public ResponseEntity<Void> deletePayment(
            HttpServletRequest request,
            @PathVariable String id,
            @RequestParam(required = false) Long expectedVersion
    ) {
        String actor = AdminRequests.actor(request);
        billingService.deletePayment(id, expectedVersion, actor);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/bulk-delete")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('payments.manage')")
    @Operation(summary = "Bulk delete payment records (items: [{id, expected_version}]; all-or-nothing)")
    public ResponseEntity<Void> bulkDelete(
            HttpServletRequest request,
            @Valid @RequestBody AdminRequests.BulkVersionedRequest body
    ) {
        String actor = AdminRequests.actor(request);
        billingService.bulkDelete(body.items(), actor);
        return ResponseEntity.noContent().build();
    }
}
