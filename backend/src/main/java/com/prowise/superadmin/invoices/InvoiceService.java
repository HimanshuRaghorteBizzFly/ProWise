package com.prowise.superadmin.invoices;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
import com.prowise.superadmin.audit.AuditService;

@Service
@Transactional
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final AuditService auditService;

    public InvoiceService(InvoiceRepository invoiceRepository, AuditService auditService) {
        this.invoiceRepository = invoiceRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<InvoiceDTOs.InvoiceResponse> listInvoices(UUID orgId, String status, String search) {
        String safeStatus = (status != null && !status.equalsIgnoreCase("ALL")) ? status.toUpperCase() : null;
        List<InvoiceEntity> list = invoiceRepository.findFiltered(orgId, safeStatus);
        if (search != null && !search.trim().isEmpty()) {
            String lower = search.trim().toLowerCase();
            list = list.stream().filter(i ->
                    i.getInvoiceNumber().toLowerCase().contains(lower) ||
                    (i.getNotes() != null && i.getNotes().toLowerCase().contains(lower))
            ).toList();
        }
        return list.stream().map(InvoiceDTOs.InvoiceResponse::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public InvoiceDTOs.InvoiceResponse getInvoice(String id) {
        InvoiceEntity entity = invoiceRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "INVOICE_NOT_FOUND", "Invoice not found: " + id));
        return InvoiceDTOs.InvoiceResponse.fromEntity(entity);
    }

    public InvoiceDTOs.InvoiceResponse generateInvoice(InvoiceDTOs.CreateInvoiceRequest req, String actorEmail) {
        String invoiceId = "inv-" + UUID.randomUUID().toString().substring(0, 8);
        String invNumber = "INV-" + (System.currentTimeMillis() % 1000000);

        InvoiceEntity invoice = new InvoiceEntity();
        invoice.setId(invoiceId);
        invoice.setInvoiceNumber(invNumber);
        invoice.setOrgId(req.orgId());
        invoice.setSubscriptionId(req.subscriptionId());
        invoice.setIssueDate(req.issueDate() != null ? req.issueDate() : LocalDate.now());
        invoice.setDueDate(req.dueDate() != null ? req.dueDate() : LocalDate.now().plusDays(14));
        invoice.setStatus("OPEN");
        invoice.setNotes(req.notes());
        invoice.setCreatedAt(Instant.now());
        invoice.setUpdatedAt(Instant.now());

        BigDecimal subtotal = BigDecimal.ZERO;
        for (InvoiceDTOs.LineItemDTO itemDTO : req.lineItems()) {
            int qty = itemDTO.quantity() != null ? itemDTO.quantity() : 1;
            BigDecimal price = itemDTO.unitPrice() != null ? itemDTO.unitPrice() : BigDecimal.ZERO;
            BigDecimal itemTotal = price.multiply(BigDecimal.valueOf(qty));
            subtotal = subtotal.add(itemTotal);

            InvoiceLineItemEntity lineItem = new InvoiceLineItemEntity(
                    itemDTO.description(),
                    qty,
                    price,
                    itemTotal
            );
            invoice.addLineItem(lineItem);
        }

        BigDecimal taxRate = req.taxRate() != null ? req.taxRate() : BigDecimal.ZERO;
        BigDecimal taxAmount = subtotal.multiply(taxRate).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal total = subtotal.add(taxAmount);

        invoice.setSubtotal(subtotal);
        invoice.setTaxRate(taxRate);
        invoice.setTaxAmount(taxAmount);
        invoice.setTotal(total);

        InvoiceEntity saved = invoiceRepository.save(invoice);

        auditService.logActivity(
                "INVOICE",
                "GENERATE_INVOICE",
                "Generated invoice #" + invNumber + " totaling $" + total,
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                invNumber,
                "INFO"
        );

        return InvoiceDTOs.InvoiceResponse.fromEntity(saved);
    }

    public InvoiceDTOs.InvoiceResponse updateInvoice(String id, InvoiceDTOs.UpdateInvoiceRequest req, String actorEmail) {
        InvoiceEntity invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "INVOICE_NOT_FOUND", "Invoice not found: " + id));

        if (req.issueDate() != null) invoice.setIssueDate(req.issueDate());
        if (req.dueDate() != null) invoice.setDueDate(req.dueDate());
        if (req.status() != null) invoice.setStatus(req.status().toUpperCase());
        if (req.notes() != null) invoice.setNotes(req.notes());

        if (req.lineItems() != null && !req.lineItems().isEmpty()) {
            invoice.getLineItems().clear();
            BigDecimal subtotal = BigDecimal.ZERO;
            for (InvoiceDTOs.LineItemDTO itemDTO : req.lineItems()) {
                int qty = itemDTO.quantity() != null ? itemDTO.quantity() : 1;
                BigDecimal price = itemDTO.unitPrice() != null ? itemDTO.unitPrice() : BigDecimal.ZERO;
                BigDecimal itemTotal = price.multiply(BigDecimal.valueOf(qty));
                subtotal = subtotal.add(itemTotal);

                InvoiceLineItemEntity lineItem = new InvoiceLineItemEntity(
                        itemDTO.description(),
                        qty,
                        price,
                        itemTotal
                );
                invoice.addLineItem(lineItem);
            }
            BigDecimal taxRate = req.taxRate() != null ? req.taxRate() : invoice.getTaxRate();
            BigDecimal taxAmount = subtotal.multiply(taxRate).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            BigDecimal total = subtotal.add(taxAmount);

            invoice.setSubtotal(subtotal);
            invoice.setTaxRate(taxRate);
            invoice.setTaxAmount(taxAmount);
            invoice.setTotal(total);
        } else if (req.taxRate() != null) {
            invoice.setTaxRate(req.taxRate());
            BigDecimal taxAmount = invoice.getSubtotal().multiply(req.taxRate()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            invoice.setTaxAmount(taxAmount);
            invoice.setTotal(invoice.getSubtotal().add(taxAmount));
        }

        invoice.setUpdatedAt(Instant.now());
        InvoiceEntity updated = invoiceRepository.save(invoice);

        auditService.logActivity(
                "INVOICE",
                "UPDATE_INVOICE",
                "Updated invoice #" + updated.getInvoiceNumber(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                updated.getInvoiceNumber(),
                "INFO"
        );

        return InvoiceDTOs.InvoiceResponse.fromEntity(updated);
    }

    public InvoiceDTOs.InvoiceResponse markInvoicePaid(String id, String paymentId, String actorEmail) {
        InvoiceEntity invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "INVOICE_NOT_FOUND", "Invoice not found: " + id));

        invoice.setStatus("PAID");
        invoice.setPaidAt(Instant.now());
        if (paymentId != null) {
            invoice.setPaymentId(paymentId);
        }
        invoice.setUpdatedAt(Instant.now());

        InvoiceEntity updated = invoiceRepository.save(invoice);

        auditService.logActivity(
                "INVOICE",
                "MARK_PAID",
                "Marked invoice #" + updated.getInvoiceNumber() + " as PAID",
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                updated.getInvoiceNumber(),
                "INFO"
        );

        return InvoiceDTOs.InvoiceResponse.fromEntity(updated);
    }

    public InvoiceDTOs.InvoiceResponse voidInvoice(String id, String actorEmail) {
        InvoiceEntity invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "INVOICE_NOT_FOUND", "Invoice not found: " + id));

        invoice.setStatus("VOID");
        invoice.setUpdatedAt(Instant.now());

        InvoiceEntity updated = invoiceRepository.save(invoice);

        auditService.logActivity(
                "INVOICE",
                "VOID_INVOICE",
                "Voided invoice #" + updated.getInvoiceNumber(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                updated.getInvoiceNumber(),
                "WARNING"
        );

        return InvoiceDTOs.InvoiceResponse.fromEntity(updated);
    }

    public void deleteInvoice(String id, String actorEmail) {
        InvoiceEntity invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "INVOICE_NOT_FOUND", "Invoice not found: " + id));

        invoiceRepository.delete(invoice);

        auditService.logActivity(
                "INVOICE",
                "DELETE_INVOICE",
                "Deleted invoice #" + invoice.getInvoiceNumber(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                invoice.getInvoiceNumber(),
                "WARNING"
        );
    }

    public void sendInvoiceReminder(String id, InvoiceDTOs.SendReminderRequest req, String actorEmail) {
        InvoiceEntity invoice = invoiceRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "INVOICE_NOT_FOUND", "Invoice not found: " + id));

        auditService.logActivity(
                "COMMUNICATION",
                "SEND_INVOICE_REMINDER",
                "Dispatched payment reminder for invoice #" + invoice.getInvoiceNumber() +
                        (req != null && req.recipientEmail() != null ? " to " + req.recipientEmail() : ""),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                invoice.getInvoiceNumber(),
                "INFO"
        );
    }

    @Transactional(readOnly = true)
    public InvoiceDTOs.InvoiceSummaryResponse getSummary() {
        List<InvoiceEntity> all = invoiceRepository.findAll();
        long totalCount = all.size();
        BigDecimal totalBilled = BigDecimal.ZERO;
        BigDecimal totalPaid = BigDecimal.ZERO;
        BigDecimal totalOutstanding = BigDecimal.ZERO;
        long overdueCount = 0;
        LocalDate today = LocalDate.now();

        for (InvoiceEntity inv : all) {
            totalBilled = totalBilled.add(inv.getTotal());
            if ("PAID".equalsIgnoreCase(inv.getStatus())) {
                totalPaid = totalPaid.add(inv.getTotal());
            } else if ("OPEN".equalsIgnoreCase(inv.getStatus()) || "OVERDUE".equalsIgnoreCase(inv.getStatus())) {
                totalOutstanding = totalOutstanding.add(inv.getTotal());
                if (inv.getDueDate() != null && inv.getDueDate().isBefore(today)) {
                    overdueCount++;
                }
            }
        }

        return new InvoiceDTOs.InvoiceSummaryResponse(totalCount, totalBilled, totalPaid, totalOutstanding, overdueCount);
    }
}
