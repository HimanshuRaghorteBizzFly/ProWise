package com.prowise.superadmin.reports;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * GET /v1/admin/reports/overview. Every number is computed with SQL over stored rows; buckets without rows are
 * omitted (never estimated). JSON is snake_case (global Jackson naming strategy).
 */
public final class ReportsDTOs {

    private ReportsDTOs() {}

    public record ReportsOverview(
            Range range,
            Organizations organizations,
            Users users,
            Subscriptions subscriptions,
            Invoices invoices,
            Payments payments,
            Audit audit,
            Logins logins
    ) {}

    /** Inclusive UTC calendar dates. */
    public record Range(LocalDate from, LocalDate to) {}

    /** month = "YYYY-MM" (UTC). */
    public record MonthCount(String month, long count) {}

    /** Totals are the current state; created_by_month is limited to the range. trial = organizations with a TRIAL/TRIALING subscription. */
    public record Organizations(long total, long active, long trial, long suspended, List<MonthCount> createdByMonth) {}

    /** Totals are the current state; created_by_month is limited to the range. pending = PENDING_ACTIVATION. */
    public record Users(long total, long active, long pending, long disabled, List<MonthCount> createdByMonth) {}

    public record StatusCount(String status, long count) {}

    public record PlanCount(String planId, String planName, long count) {}

    /** Current state. by_plan and mrr cover ACTIVE subscriptions; annual amounts count as amount / 12; arr = mrr * 12. */
    public record Subscriptions(List<StatusCount> byStatus, List<PlanCount> byPlan, BigDecimal mrr, BigDecimal arr) {}

    public record InvoiceStatusTotal(String status, long count, BigDecimal total) {}

    /**
     * Invoices issued in the range. billed_total excludes VOID; paid_total = PAID; outstanding_total = OPEN + OVERDUE.
     */
    public record Invoices(List<InvoiceStatusTotal> byStatus, BigDecimal billedTotal, BigDecimal paidTotal, BigDecimal outstandingTotal) {}

    /**
     * Payments created in the range. succeeded_total = gross amount of captured payments (SUCCEEDED, PARTIALLY_REFUNDED,
     * REFUNDED); refunded_total = sum of refunded_amount; failed_count = FAILED payments.
     */
    public record Payments(BigDecimal succeededTotal, BigDecimal refundedTotal, long failedCount) {}

    public record CategoryCount(String category, long count) {}

    public record DayCount(LocalDate date, long count) {}

    /** Super Admin audit rows (admin_audit_logs) in the range. */
    public record Audit(List<CategoryCount> byCategory, List<DayCount> byDay) {}

    public record LoginDay(LocalDate date, long succeeded, long failed) {}

    /** User and operator sign-in attempts (user_login_history + operator_login_history) in the range, per UTC day. */
    public record Logins(List<LoginDay> byDay) {}
}
