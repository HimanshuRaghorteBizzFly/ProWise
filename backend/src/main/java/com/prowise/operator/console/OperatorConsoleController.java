package com.prowise.operator.console;

import java.time.Instant;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.identity.AuthPrincipal;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Read-only operator console pages: activity logs, organization status, subscription status, payment
 * failures, invoice delivery and API errors. Lists are paginated as {@code {items, total, page, size}}
 * with a 0-based page and size 1..100 (default 25).
 */
@RestController
@Tag(name = "Platform Operator Console", description = "Read-only operator views over real platform data")
public class OperatorConsoleController {

    private static final String OPERATOR = "hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')";

    private final OperatorConsoleService service;

    public OperatorConsoleController(OperatorConsoleService service) {
        this.service = service;
    }

    @GetMapping("/v1/operator/activity-logs")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Operator activity and audit log (permission audit.activity_logs:view)")
    public ConsoleDTOs.Page<ConsoleDTOs.ActivityLogItem> activityLogs(
            @Parameter(description = "Operator id") @RequestParam(required = false) String operator,
            @Parameter(description = "Exact action name (case-insensitive)") @RequestParam(required = false) String action,
            @Parameter(description = "ACTIVITY or AUDIT") @RequestParam(required = false) String source,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            HttpServletRequest request) {
        return service.activityLogs(AuthPrincipal.require(request), operator, action, source, from, to, search, page, size);
    }

    @GetMapping("/v1/operator/organizations")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Organizations with member, project and subscription status (operations.org_status:view; read-only)")
    public ConsoleDTOs.Page<ConsoleDTOs.OrganizationItem> organizations(
            @RequestParam(required = false) String search,
            @Parameter(description = "ACTIVE, SUSPENDED or ARCHIVED") @RequestParam(required = false) String state,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            HttpServletRequest request) {
        return service.organizations(AuthPrincipal.require(request), search, state, page, size);
    }

    @GetMapping("/v1/operator/organizations/{id}")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Organization status detail (operations.org_status:view; unknown id = 404)")
    public ConsoleDTOs.OrganizationDetail organization(@PathVariable String id, HttpServletRequest request) {
        return service.organization(AuthPrincipal.require(request), id);
    }

    @GetMapping("/v1/operator/subscriptions")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Subscriptions with organization and plan (billing.subscriptions:view; billing dormant, read-only)")
    public ConsoleDTOs.Page<ConsoleDTOs.SubscriptionItem> subscriptions(
            @RequestParam(required = false) String status,
            @Parameter(description = "Plan id or plan code") @RequestParam(required = false) String plan,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            HttpServletRequest request) {
        return service.subscriptions(AuthPrincipal.require(request), status, plan, search, page, size);
    }

    @GetMapping("/v1/operator/payments/failures")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "FAILED payments with organization and invoice (billing.payment_failures:view; no retry: no payment provider)")
    public ConsoleDTOs.Page<ConsoleDTOs.PaymentFailureItem> paymentFailures(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            HttpServletRequest request) {
        return service.paymentFailures(AuthPrincipal.require(request), search, from, to, page, size);
    }

    @GetMapping("/v1/operator/invoices/delivery")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Invoices with their latest email delivery status, NOT_SENT when none (billing.invoices:view; nothing is sent)")
    public ConsoleDTOs.Page<ConsoleDTOs.InvoiceDeliveryItem> invoiceDelivery(
            @Parameter(description = "Delivery status, e.g. NOT_SENT, SMTP_ACCEPTED, FAILED") @RequestParam(name = "delivery_status", required = false) String deliveryStatus,
            @Parameter(description = "Invoice status") @RequestParam(name = "invoice_status", required = false) String invoiceStatus,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            HttpServletRequest request) {
        return service.invoiceDelivery(AuthPrincipal.require(request), deliveryStatus, invoiceStatus, search, page, size);
    }

    @GetMapping("/v1/operator/api-errors")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Recorded API errors: 5xx and 4xx except 401/404 (integrations.api_errors:view)")
    public ConsoleDTOs.Page<ConsoleDTOs.ApiErrorItem> apiErrors(
            @Parameter(description = "4xx or 5xx") @RequestParam(name = "status_class", required = false) String statusClass,
            @RequestParam(required = false) Integer status,
            @Parameter(description = "Path template substring") @RequestParam(required = false) String path,
            @Parameter(description = "Error code, e.g. VALIDATION_FAILED") @RequestParam(required = false) String code,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            HttpServletRequest request) {
        return service.apiErrors(AuthPrincipal.require(request), statusClass, status, path, code, from, to, page, size);
    }

    @GetMapping("/v1/operator/api-errors/summary")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "API error counts by status, path and code for a range (default: last 24 hours)")
    public ConsoleDTOs.ApiErrorSummary apiErrorSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            HttpServletRequest request) {
        return service.apiErrorSummary(AuthPrincipal.require(request), from, to);
    }
}
