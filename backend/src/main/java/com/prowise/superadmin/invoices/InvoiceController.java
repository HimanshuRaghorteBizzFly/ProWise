package com.prowise.superadmin.invoices;

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
@RequestMapping({"/v1/admin/invoices", "/api/v1/admin/invoices"})
@Tag(name = "Super Admin Invoices", description = "Invoicing lifecycle. Mutations need expected_version (409 STALE_VERSION when stale) and accept Idempotency-Key.")
public class InvoiceController {

    private final InvoiceService invoiceService;

    public InvoiceController(InvoiceService invoiceService) {
        this.invoiceService = invoiceService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('invoices.manage')")
    @Operation(summary = "List invoices with optional filters")
    public ResponseEntity<List<InvoiceDTOs.InvoiceResponse>> listInvoices(
            @RequestParam(required = false) UUID orgId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search
    ) {
        return ResponseEntity.ok(invoiceService.listInvoices(orgId, status, search));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('invoices.manage')")
    @Operation(summary = "Get single invoice details with line items")
    public ResponseEntity<InvoiceDTOs.InvoiceResponse> getInvoice(@PathVariable String id) {
        return ResponseEntity.ok(invoiceService.getInvoice(id));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('invoices.manage')")
    @Operation(summary = "Get invoicing summary KPIs")
    public ResponseEntity<InvoiceDTOs.InvoiceSummaryResponse> getSummary() {
        return ResponseEntity.ok(invoiceService.getSummary());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('invoices.manage')")
    @Operation(summary = "Generate a new invoice with itemized line items")
    public ResponseEntity<InvoiceDTOs.InvoiceResponse> generateInvoice(
            HttpServletRequest request,
            @Valid @RequestBody InvoiceDTOs.CreateInvoiceRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(invoiceService.generateInvoice(body, actor));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('invoices.manage')")
    @Operation(summary = "Update an existing invoice (expected_version required)")
    public ResponseEntity<InvoiceDTOs.InvoiceResponse> updateInvoice(
            HttpServletRequest request,
            @PathVariable String id,
            @Valid @RequestBody InvoiceDTOs.UpdateInvoiceRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.ok(invoiceService.updateInvoice(id, body, actor));
    }

    @PostMapping("/{id}/mark-paid")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('invoices.manage')")
    @Operation(summary = "Mark invoice as paid (body: expected_version, optional payment_id)")
    public ResponseEntity<InvoiceDTOs.InvoiceResponse> markInvoicePaid(
            HttpServletRequest request,
            @PathVariable String id,
            @RequestParam(required = false) String paymentId,
            @RequestBody(required = false) InvoiceDTOs.MarkPaidRequest body
    ) {
        String actor = AdminRequests.actor(request);
        String payment = body != null && body.paymentId() != null ? body.paymentId() : paymentId;
        return ResponseEntity.ok(invoiceService.markInvoicePaid(id, payment, body != null ? body.expectedVersion() : null, actor));
    }

    @PostMapping("/{id}/void")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('invoices.manage')")
    @Operation(summary = "Void an invoice (body: expected_version)")
    public ResponseEntity<InvoiceDTOs.InvoiceResponse> voidInvoice(
            HttpServletRequest request,
            @PathVariable String id,
            @RequestBody(required = false) AdminRequests.VersionRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.ok(invoiceService.voidInvoice(id, com.prowise.superadmin.common.AdminRequests.expected(body), actor));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('invoices.manage')")
    @Operation(summary = "Delete an invoice (?expectedVersion= required)")
    public ResponseEntity<Void> deleteInvoice(
            HttpServletRequest request,
            @PathVariable String id,
            @RequestParam(required = false) Long expectedVersion
    ) {
        String actor = AdminRequests.actor(request);
        invoiceService.deleteInvoice(id, expectedVersion, actor);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/send-reminder")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('invoices.manage')")
    @Operation(summary = "Dispatch payment reminder for an invoice")
    public ResponseEntity<Void> sendReminder(
            HttpServletRequest request,
            @PathVariable String id,
            @RequestBody(required = false) InvoiceDTOs.SendReminderRequest body
    ) {
        String actor = AdminRequests.actor(request);
        invoiceService.sendInvoiceReminder(id, body, actor);
        return ResponseEntity.ok().build();
    }
}
