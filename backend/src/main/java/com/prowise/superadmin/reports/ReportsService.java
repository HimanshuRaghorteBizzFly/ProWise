package com.prowise.superadmin.reports;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;

/**
 * Platform reports for the Super Admin, computed with SQL over real tables only (organizations, users,
 * subscriptions, plans, invoices, payments, admin_audit_logs, user_login_history, operator_login_history).
 * Platform-level read (not tenant-scoped): the endpoint is restricted to PLATFORM_SUPER_ADMIN.
 */
@Service
@Transactional(readOnly = true)
public class ReportsService {

    /** Longest range one request may ask for, so a typo cannot scan decades of rows. */
    static final int MAX_RANGE_DAYS = 3 * 366;

    private final JdbcTemplate jdbc;

    public ReportsService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public ReportsDTOs.ReportsOverview overview(LocalDate fromParam, LocalDate toParam) {
        LocalDate to = toParam != null ? toParam : LocalDate.now(ZoneOffset.UTC);
        LocalDate from = fromParam != null ? fromParam : to.minusMonths(12).plusDays(1);
        if (from.isAfter(to)) {
            throw invalid("from", "must be on or before to");
        }
        if (from.plusDays(MAX_RANGE_DAYS).isBefore(to)) {
            throw invalid("to", "range may span at most " + MAX_RANGE_DAYS + " days");
        }
        OffsetDateTime start = from.atStartOfDay().atOffset(ZoneOffset.UTC);
        OffsetDateTime end = to.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC);

        return new ReportsDTOs.ReportsOverview(
                new ReportsDTOs.Range(from, to),
                organizations(start, end),
                users(start, end),
                subscriptions(),
                invoices(from, to),
                payments(start, end),
                audit(start, end),
                logins(start, end));
    }

    private ReportsDTOs.Organizations organizations(OffsetDateTime start, OffsetDateTime end) {
        return new ReportsDTOs.Organizations(
                count("SELECT count(*) FROM organizations"),
                count("SELECT count(*) FROM organizations WHERE state = 'ACTIVE'"),
                count("SELECT count(DISTINCT org_id) FROM subscriptions WHERE upper(status) IN ('TRIAL', 'TRIALING')"),
                count("SELECT count(*) FROM organizations WHERE state = 'SUSPENDED'"),
                byMonth("organizations", start, end));
    }

    private ReportsDTOs.Users users(OffsetDateTime start, OffsetDateTime end) {
        return new ReportsDTOs.Users(
                count("SELECT count(*) FROM users"),
                count("SELECT count(*) FROM users WHERE status = 'ACTIVE'"),
                count("SELECT count(*) FROM users WHERE status = 'PENDING_ACTIVATION'"),
                count("SELECT count(*) FROM users WHERE status = 'DISABLED'"),
                byMonth("users", start, end));
    }

    private List<ReportsDTOs.MonthCount> byMonth(String table, OffsetDateTime start, OffsetDateTime end) {
        // table is one of two constants above, never client input.
        return jdbc.query("SELECT to_char(date_trunc('month', created_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS month, count(*) AS n "
                        + "FROM " + table + " WHERE created_at >= ? AND created_at < ? GROUP BY 1 ORDER BY 1",
                (rs, i) -> new ReportsDTOs.MonthCount(rs.getString("month"), rs.getLong("n")), start, end);
    }

    private ReportsDTOs.Subscriptions subscriptions() {
        List<ReportsDTOs.StatusCount> byStatus = jdbc.query(
                "SELECT status, count(*) AS n FROM subscriptions GROUP BY status ORDER BY status",
                (rs, i) -> new ReportsDTOs.StatusCount(rs.getString("status"), rs.getLong("n")));
        List<ReportsDTOs.PlanCount> byPlan = jdbc.query("""
                SELECT s.plan_id, p.name AS plan_name, count(*) AS n
                FROM subscriptions s LEFT JOIN plans p ON p.id = s.plan_id
                WHERE s.status = 'ACTIVE'
                GROUP BY s.plan_id, p.name ORDER BY n DESC, s.plan_id
                """, (rs, i) -> new ReportsDTOs.PlanCount(rs.getString("plan_id"), rs.getString("plan_name"), rs.getLong("n")));
        BigDecimal mrr = money(jdbc.queryForObject("""
                SELECT COALESCE(SUM(CASE WHEN billing_cycle = 'ANNUAL' THEN amount / 12 ELSE amount END), 0)
                FROM subscriptions WHERE status = 'ACTIVE'
                """, BigDecimal.class));
        return new ReportsDTOs.Subscriptions(byStatus, byPlan, mrr, money(mrr.multiply(BigDecimal.valueOf(12))));
    }

    private ReportsDTOs.Invoices invoices(LocalDate from, LocalDate to) {
        List<ReportsDTOs.InvoiceStatusTotal> byStatus = jdbc.query("""
                SELECT status, count(*) AS n, COALESCE(SUM(total), 0) AS total
                FROM invoices WHERE issue_date BETWEEN ? AND ? GROUP BY status ORDER BY status
                """, (rs, i) -> new ReportsDTOs.InvoiceStatusTotal(rs.getString("status"), rs.getLong("n"), money(rs.getBigDecimal("total"))),
                from, to);
        BigDecimal billed = BigDecimal.ZERO;
        BigDecimal paid = BigDecimal.ZERO;
        BigDecimal outstanding = BigDecimal.ZERO;
        for (ReportsDTOs.InvoiceStatusTotal row : byStatus) {
            String status = row.status() == null ? "" : row.status().toUpperCase(java.util.Locale.ROOT);
            if (!"VOID".equals(status)) {
                billed = billed.add(row.total());
            }
            if ("PAID".equals(status)) {
                paid = paid.add(row.total());
            }
            if ("OPEN".equals(status) || "OVERDUE".equals(status)) {
                outstanding = outstanding.add(row.total());
            }
        }
        return new ReportsDTOs.Invoices(byStatus, money(billed), money(paid), money(outstanding));
    }

    private ReportsDTOs.Payments payments(OffsetDateTime start, OffsetDateTime end) {
        return jdbc.queryForObject("""
                SELECT COALESCE(SUM(amount) FILTER (WHERE status IN ('SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED')), 0) AS succeeded,
                       COALESCE(SUM(refunded_amount), 0) AS refunded,
                       count(*) FILTER (WHERE status = 'FAILED') AS failed
                FROM payments WHERE created_at >= ? AND created_at < ?
                """, (rs, i) -> new ReportsDTOs.Payments(
                        money(rs.getBigDecimal("succeeded")), money(rs.getBigDecimal("refunded")), rs.getLong("failed")),
                start, end);
    }

    private ReportsDTOs.Audit audit(OffsetDateTime start, OffsetDateTime end) {
        List<ReportsDTOs.CategoryCount> byCategory = jdbc.query("""
                SELECT category, count(*) AS n FROM admin_audit_logs
                WHERE timestamp >= ? AND timestamp < ? GROUP BY category ORDER BY n DESC, category
                """, (rs, i) -> new ReportsDTOs.CategoryCount(rs.getString("category"), rs.getLong("n")), start, end);
        List<ReportsDTOs.DayCount> byDay = jdbc.query("""
                SELECT (timestamp AT TIME ZONE 'UTC')::date AS day, count(*) AS n FROM admin_audit_logs
                WHERE timestamp >= ? AND timestamp < ? GROUP BY 1 ORDER BY 1
                """, (rs, i) -> new ReportsDTOs.DayCount(rs.getObject("day", LocalDate.class), rs.getLong("n")), start, end);
        return new ReportsDTOs.Audit(byCategory, byDay);
    }

    private ReportsDTOs.Logins logins(OffsetDateTime start, OffsetDateTime end) {
        List<ReportsDTOs.LoginDay> byDay = jdbc.query("""
                SELECT day, SUM(ok) AS succeeded, SUM(bad) AS failed FROM (
                    SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
                           CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END AS ok,
                           CASE WHEN status LIKE 'FAILED%' THEN 1 ELSE 0 END AS bad
                    FROM user_login_history WHERE created_at >= ? AND created_at < ?
                    UNION ALL
                    SELECT (occurred_at AT TIME ZONE 'UTC')::date,
                           CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END,
                           CASE WHEN status LIKE 'FAILED%' THEN 1 ELSE 0 END
                    FROM operator_login_history WHERE occurred_at >= ? AND occurred_at < ?
                ) attempts GROUP BY day ORDER BY day
                """, (rs, i) -> new ReportsDTOs.LoginDay(
                        rs.getObject("day", LocalDate.class), rs.getLong("succeeded"), rs.getLong("failed")),
                start, end, start, end);
        return new ReportsDTOs.Logins(byDay);
    }

    private long count(String sql) {
        Long value = jdbc.queryForObject(sql, Long.class);
        return value == null ? 0L : value;
    }

    private static BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private static ApiException invalid(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "The report range is not valid.",
                List.of(new ApiError.FieldError(field, message)));
    }
}
