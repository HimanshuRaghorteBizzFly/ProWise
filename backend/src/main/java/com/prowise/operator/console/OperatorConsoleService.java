package com.prowise.operator.console;

import static com.prowise.operator.console.ConsoleSql.instant;
import static com.prowise.operator.console.ConsoleSql.like;
import static com.prowise.operator.console.ConsoleSql.present;
import static com.prowise.operator.console.ConsoleSql.text;
import static com.prowise.operator.console.ConsoleSql.upper;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;
import com.prowise.identity.AuthPrincipal;
import com.prowise.operator.console.ConsoleSql.Paging;
import com.prowise.operator.console.ConsoleSql.Where;

/**
 * Read-only operator console views over real platform tables. Platform operators and the Super Admin read
 * across organizations by design (platform roles, never organization-bound); every endpoint checks the
 * caller's operator permission first. Billing is dormant: nothing here retries, sends or changes anything.
 */
@Service
@Transactional(readOnly = true)
public class OperatorConsoleService {

    static final String PERM_ACTIVITY = "audit.activity_logs";
    static final String PERM_ORGS = "operations.org_status";
    static final String PERM_SUBSCRIPTIONS = "billing.subscriptions";
    static final String PERM_PAYMENTS = "billing.payment_failures";
    static final String PERM_INVOICES = "billing.invoices";
    static final String PERM_API_ERRORS = "integrations.api_errors";

    private final NamedParameterJdbcTemplate jdbc;
    private final OperatorPermissionGuard guard;

    public OperatorConsoleService(NamedParameterJdbcTemplate jdbc, OperatorPermissionGuard guard) {
        this.jdbc = jdbc;
        this.guard = guard;
    }

    // ---------------------------------------------------------------- 1. activity logs

    public ConsoleDTOs.Page<ConsoleDTOs.ActivityLogItem> activityLogs(AuthPrincipal principal, String operator,
            String action, String source, Instant from, Instant to, String search, Integer page, Integer size) {
        guard.require(principal, PERM_ACTIVITY, "view");
        Paging paging = ConsoleSql.paging(page, size);
        ConsoleSql.checkRange(from, to);
        String base = """
                SELECT * FROM (
                    SELECT a.id::text AS id, 'ACTIVITY' AS source, a.operator_id, o.name AS operator_name,
                           a.department_id, a.action, a.resource_type, a.resource_id, NULL::varchar AS module_key,
                           a.details, a.ip_address, a.created_at AS occurred_at
                      FROM operator_activity_logs a LEFT JOIN platform_operators o ON o.id = a.operator_id
                    UNION ALL
                    SELECT l.id::text, 'AUDIT', l.operator_id, l.actor_name, NULL::varchar, l.action, NULL::varchar,
                           NULL::varchar, l.module_key, l.details, NULL::varchar, l.occurred_at
                      FROM operator_audit_logs l
                ) x""";
        Where where = new Where();
        if (present(operator)) where.add("x.operator_id = :operator", "operator", operator.trim());
        if (present(action)) where.add("upper(x.action) = :action", "action", upper(action));
        if (present(source)) where.add("x.source = :source", "source", upper(source));
        if (from != null) where.add("x.occurred_at >= :from", "from", java.sql.Timestamp.from(from));
        if (to != null) where.add("x.occurred_at <= :to", "to", java.sql.Timestamp.from(to));
        if (present(search)) {
            where.add("(x.action ILIKE :q OR x.details ILIKE :q OR x.resource_type ILIKE :q OR x.resource_id ILIKE :q"
                    + " OR x.operator_name ILIKE :q OR x.module_key ILIKE :q)", "q", like(search));
        }
        long total = count("SELECT count(*) FROM (" + base + where.sql() + ") c", where.params);
        List<ConsoleDTOs.ActivityLogItem> items = jdbc.query(base + where.sql()
                        + " ORDER BY x.occurred_at DESC, x.id LIMIT :limit OFFSET :offset",
                limit(where.params, paging),
                (rs, i) -> new ConsoleDTOs.ActivityLogItem(rs.getString("id"), rs.getString("source"),
                        rs.getString("operator_id"), rs.getString("operator_name"), rs.getString("department_id"),
                        rs.getString("action"), rs.getString("resource_type"), rs.getString("resource_id"),
                        rs.getString("module_key"), rs.getString("details"), rs.getString("ip_address"),
                        instant(rs, "occurred_at")));
        return new ConsoleDTOs.Page<>(items, total, paging.page(), paging.size());
    }

    // ---------------------------------------------------------------- 2. organizations

    private static final String ORG_SELECT = """
            SELECT o.id, o.name, o.slug, o.state, o.created_at,
                   (SELECT count(*) FROM memberships m WHERE m.org_id = o.id AND m.status = 'ACTIVE') AS member_count,
                   (SELECT count(*) FROM projects p WHERE p.org_id = o.id) AS project_count,
                   COALESCE((SELECT u.email FROM memberships m JOIN users u ON u.id = m.user_id
                              WHERE m.org_id = o.id AND m.role_template = 'ORGANIZATION_OWNER' AND m.status = 'ACTIVE'
                              LIMIT 1), o.owner_email) AS owner_email,
                   s.id AS subscription_id, s.status AS subscription_status, s.plan_id, pl.name AS plan_name
              FROM organizations o
              LEFT JOIN LATERAL (
                   SELECT s.id, s.status, s.plan_id FROM subscriptions s WHERE s.org_id = o.id
                    ORDER BY (s.status <> 'CANCELLED') DESC, s.created_at DESC LIMIT 1) s ON true
              LEFT JOIN plans pl ON pl.id = s.plan_id""";

    public ConsoleDTOs.Page<ConsoleDTOs.OrganizationItem> organizations(AuthPrincipal principal, String search,
            String state, Integer page, Integer size) {
        guard.require(principal, PERM_ORGS, "view");
        Paging paging = ConsoleSql.paging(page, size);
        Where where = new Where();
        if (present(state)) where.add("o.state = :state", "state", upper(state));
        if (present(search)) {
            where.add("(o.name ILIKE :q OR o.slug ILIKE :q OR o.owner_email ILIKE :q)", "q", like(search));
        }
        long total = count("SELECT count(*) FROM organizations o" + where.sql(), where.params);
        List<ConsoleDTOs.OrganizationItem> items = jdbc.query(ORG_SELECT + where.sql()
                + " ORDER BY o.created_at DESC, o.id LIMIT :limit OFFSET :offset", limit(where.params, paging),
                (rs, i) -> new ConsoleDTOs.OrganizationItem(text(rs, "id"), rs.getString("name"), rs.getString("slug"),
                        rs.getString("state"), instant(rs, "created_at"), rs.getLong("member_count"),
                        rs.getLong("project_count"), rs.getString("owner_email"), rs.getString("subscription_id"),
                        rs.getString("subscription_status"), rs.getString("plan_id"), rs.getString("plan_name")));
        return new ConsoleDTOs.Page<>(items, total, paging.page(), paging.size());
    }

    public ConsoleDTOs.OrganizationDetail organization(AuthPrincipal principal, String id) {
        guard.require(principal, PERM_ORGS, "view");
        UUID orgId = parseUuid(id);
        MapSqlParameterSource p = new MapSqlParameterSource("id", orgId);
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT o.id, o.name, o.slug, o.state, o.timezone, o.suspended_reason, o.created_at, o.updated_at,
                       COALESCE((SELECT u.email FROM memberships m JOIN users u ON u.id = m.user_id
                                  WHERE m.org_id = o.id AND m.role_template = 'ORGANIZATION_OWNER' AND m.status = 'ACTIVE'
                                  LIMIT 1), o.owner_email) AS owner_email,
                       (SELECT count(*) FROM memberships m WHERE m.org_id = o.id AND m.status = 'ACTIVE') AS member_count,
                       (SELECT count(*) FROM memberships m WHERE m.org_id = o.id AND m.status <> 'ACTIVE') AS disabled_count,
                       (SELECT count(*) FROM payments py WHERE py.org_id = o.id AND py.status = 'FAILED') AS failed_payments,
                       (SELECT count(*) FROM invoices iv WHERE iv.org_id = o.id AND iv.status IN ('OPEN', 'OVERDUE')) AS open_invoices
                  FROM organizations o WHERE o.id = :id
                """, p);
        if (rows.isEmpty()) {
            throw ApiException.notFound();
        }
        Map<String, Object> row = rows.get(0);
        Map<String, Long> byLifecycle = new LinkedHashMap<>();
        jdbc.query("SELECT lifecycle, count(*) AS n FROM projects WHERE org_id = :id GROUP BY lifecycle ORDER BY lifecycle", p,
                rs -> { byLifecycle.put(rs.getString("lifecycle"), rs.getLong("n")); });
        long projectCount = byLifecycle.values().stream().mapToLong(Long::longValue).sum();
        List<ConsoleDTOs.OrganizationSubscription> subscriptions = jdbc.query("""
                SELECT s.id, s.plan_id, pl.name AS plan_name, s.status, s.billing_cycle, s.seats, s.current_period_end,
                       s.created_at
                  FROM subscriptions s LEFT JOIN plans pl ON pl.id = s.plan_id
                 WHERE s.org_id = :id ORDER BY s.created_at DESC
                """, p, (rs, i) -> new ConsoleDTOs.OrganizationSubscription(rs.getString("id"), rs.getString("plan_id"),
                rs.getString("plan_name"), rs.getString("status"), rs.getString("billing_cycle"), rs.getInt("seats"),
                instant(rs, "current_period_end"), instant(rs, "created_at")));
        return new ConsoleDTOs.OrganizationDetail(
                row.get("id").toString(), (String) row.get("name"), (String) row.get("slug"), (String) row.get("state"),
                (String) row.get("timezone"), (String) row.get("suspended_reason"),
                toInstant(row.get("created_at")), toInstant(row.get("updated_at")), (String) row.get("owner_email"),
                ((Number) row.get("member_count")).longValue(), ((Number) row.get("disabled_count")).longValue(),
                projectCount, byLifecycle, subscriptions,
                ((Number) row.get("failed_payments")).longValue(), ((Number) row.get("open_invoices")).longValue());
    }

    // ---------------------------------------------------------------- 3. subscriptions

    public ConsoleDTOs.Page<ConsoleDTOs.SubscriptionItem> subscriptions(AuthPrincipal principal, String status,
            String plan, String search, Integer page, Integer size) {
        guard.require(principal, PERM_SUBSCRIPTIONS, "view");
        Paging paging = ConsoleSql.paging(page, size);
        String from = " FROM subscriptions s JOIN organizations o ON o.id = s.org_id LEFT JOIN plans pl ON pl.id = s.plan_id";
        Where where = new Where();
        if (present(status)) where.add("s.status = :status", "status", upper(status));
        if (present(plan)) where.add("(s.plan_id = :plan OR upper(pl.code) = upper(:plan))", "plan", plan.trim());
        if (present(search)) {
            where.add("(o.name ILIKE :q OR o.slug ILIKE :q OR s.id ILIKE :q OR pl.name ILIKE :q)", "q", like(search));
        }
        long total = count("SELECT count(*)" + from + where.sql(), where.params);
        List<ConsoleDTOs.SubscriptionItem> items = jdbc.query("""
                SELECT s.id, s.org_id, o.name AS org_name, o.slug AS org_slug, s.plan_id, pl.code AS plan_code,
                       pl.name AS plan_name, s.billing_cycle, s.status, s.seats,
                       (SELECT count(*) FROM memberships m WHERE m.org_id = s.org_id AND m.status = 'ACTIVE') AS seats_used,
                       s.amount, s.currency, s.current_period_start, s.current_period_end, s.auto_renew,
                       s.cancel_at_period_end, s.created_at""" + from + where.sql()
                        + " ORDER BY s.created_at DESC, s.id LIMIT :limit OFFSET :offset", limit(where.params, paging),
                (rs, i) -> new ConsoleDTOs.SubscriptionItem(rs.getString("id"), text(rs, "org_id"),
                        rs.getString("org_name"), rs.getString("org_slug"), rs.getString("plan_id"),
                        rs.getString("plan_code"), rs.getString("plan_name"), rs.getString("billing_cycle"),
                        rs.getString("status"), rs.getInt("seats"), rs.getLong("seats_used"), rs.getBigDecimal("amount"),
                        rs.getString("currency"), instant(rs, "current_period_start"), instant(rs, "current_period_end"),
                        rs.getBoolean("auto_renew"), rs.getBoolean("cancel_at_period_end"), instant(rs, "created_at")));
        return new ConsoleDTOs.Page<>(items, total, paging.page(), paging.size());
    }

    // ---------------------------------------------------------------- 4. payment failures

    public ConsoleDTOs.Page<ConsoleDTOs.PaymentFailureItem> paymentFailures(AuthPrincipal principal, String search,
            Instant fromTime, Instant toTime, Integer page, Integer size) {
        guard.require(principal, PERM_PAYMENTS, "view");
        Paging paging = ConsoleSql.paging(page, size);
        ConsoleSql.checkRange(fromTime, toTime);
        String from = " " + """
                 FROM payments p
                 JOIN organizations o ON o.id = p.org_id
                 LEFT JOIN LATERAL (
                      SELECT iv.id, iv.invoice_number, iv.status FROM invoices iv
                       WHERE iv.id = p.invoice_id OR iv.payment_id = p.id
                       ORDER BY (iv.id = p.invoice_id) DESC LIMIT 1) inv ON true""";
        Where where = new Where().add("p.status = 'FAILED'");
        if (fromTime != null) where.add("p.created_at >= :from", "from", java.sql.Timestamp.from(fromTime));
        if (toTime != null) where.add("p.created_at <= :to", "to", java.sql.Timestamp.from(toTime));
        if (present(search)) {
            where.add("(o.name ILIKE :q OR p.transaction_ref ILIKE :q OR inv.invoice_number ILIKE :q OR p.failure_reason ILIKE :q)",
                    "q", like(search));
        }
        long total = count("SELECT count(*)" + from + where.sql(), where.params);
        List<ConsoleDTOs.PaymentFailureItem> items = jdbc.query("""
                SELECT p.id, p.transaction_ref, p.org_id, o.name AS org_name, p.subscription_id, inv.id AS invoice_id,
                       inv.invoice_number, inv.status AS invoice_status, p.amount, p.currency, p.method, p.method_last4,
                       p.gateway_label, p.description, p.failure_reason, p.created_at, p.updated_at""" + from + where.sql()
                        + " ORDER BY p.created_at DESC, p.id LIMIT :limit OFFSET :offset", limit(where.params, paging),
                (rs, i) -> new ConsoleDTOs.PaymentFailureItem(rs.getString("id"), rs.getString("transaction_ref"),
                        text(rs, "org_id"), rs.getString("org_name"), rs.getString("subscription_id"),
                        rs.getString("invoice_id"), rs.getString("invoice_number"), rs.getString("invoice_status"),
                        rs.getBigDecimal("amount"), rs.getString("currency"), rs.getString("method"),
                        rs.getString("method_last4"), rs.getString("gateway_label"), rs.getString("description"),
                        rs.getString("failure_reason"), instant(rs, "created_at"), instant(rs, "updated_at")));
        return new ConsoleDTOs.Page<>(items, total, paging.page(), paging.size());
    }

    // ---------------------------------------------------------------- 5. invoice delivery

    public ConsoleDTOs.Page<ConsoleDTOs.InvoiceDeliveryItem> invoiceDelivery(AuthPrincipal principal,
            String deliveryStatus, String invoiceStatus, String search, Integer page, Integer size) {
        guard.require(principal, PERM_INVOICES, "view");
        Paging paging = ConsoleSql.paging(page, size);
        String from = " " + """
                 FROM invoices i
                 JOIN organizations o ON o.id = i.org_id
                 LEFT JOIN LATERAL (
                      SELECT l.status, l.recipient, l.created_at, l.sent_at, l.error_code FROM email_delivery_logs l
                       WHERE l.invoice_id = i.id ORDER BY l.created_at DESC LIMIT 1) last ON true""";
        Where where = new Where();
        if (present(deliveryStatus)) {
            where.add("COALESCE(last.status, 'NOT_SENT') = :delivery", "delivery", upper(deliveryStatus));
        }
        if (present(invoiceStatus)) where.add("i.status = :istatus", "istatus", upper(invoiceStatus));
        if (present(search)) {
            where.add("(i.invoice_number ILIKE :q OR o.name ILIKE :q OR last.recipient ILIKE :q)", "q", like(search));
        }
        long total = count("SELECT count(*)" + from + where.sql(), where.params);
        List<ConsoleDTOs.InvoiceDeliveryItem> items = jdbc.query("""
                SELECT i.id, i.invoice_number, i.org_id, o.name AS org_name, i.status, i.total, i.issue_date, i.due_date,
                       COALESCE(last.status, 'NOT_SENT') AS delivery_status, last.recipient, last.created_at AS last_attempt_at,
                       last.sent_at, last.error_code,
                       (SELECT count(*) FROM email_delivery_logs l WHERE l.invoice_id = i.id) AS attempts""" + from
                        + where.sql() + " ORDER BY i.created_at DESC, i.id LIMIT :limit OFFSET :offset",
                limit(where.params, paging),
                (rs, i) -> new ConsoleDTOs.InvoiceDeliveryItem(rs.getString("id"), rs.getString("invoice_number"),
                        text(rs, "org_id"), rs.getString("org_name"), rs.getString("status"), rs.getBigDecimal("total"),
                        ConsoleSql.date(rs, "issue_date"), ConsoleSql.date(rs, "due_date"),
                        rs.getString("delivery_status"), rs.getString("recipient"), rs.getLong("attempts"),
                        instant(rs, "last_attempt_at"), instant(rs, "sent_at"), rs.getString("error_code")));
        return new ConsoleDTOs.Page<>(items, total, paging.page(), paging.size());
    }

    // ---------------------------------------------------------------- 6. API errors

    private Where apiErrorWhere(String statusClass, Integer status, String path, String code, Instant from, Instant to) {
        Where where = new Where();
        if (present(statusClass)) {
            String cls = upper(statusClass);
            if ("4XX".equals(cls)) where.add("e.status BETWEEN 400 AND 499");
            else if ("5XX".equals(cls)) where.add("e.status BETWEEN 500 AND 599");
            else throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "The request has invalid fields.",
                        List.of(new ApiError.FieldError("status_class", "must be 4xx or 5xx")));
        }
        if (status != null) where.add("e.status = :status", "status", status);
        if (present(path)) where.add("e.path_template ILIKE :path", "path", like(path));
        if (present(code)) where.add("e.error_code = :code", "code", upper(code));
        if (from != null) where.add("e.occurred_at >= :from", "from", java.sql.Timestamp.from(from));
        if (to != null) where.add("e.occurred_at <= :to", "to", java.sql.Timestamp.from(to));
        return where;
    }

    public ConsoleDTOs.Page<ConsoleDTOs.ApiErrorItem> apiErrors(AuthPrincipal principal, String statusClass,
            Integer status, String path, String code, Instant from, Instant to, Integer page, Integer size) {
        guard.require(principal, PERM_API_ERRORS, "view");
        Paging paging = ConsoleSql.paging(page, size);
        ConsoleSql.checkRange(from, to);
        Where where = apiErrorWhere(statusClass, status, path, code, from, to);
        long total = count("SELECT count(*) FROM api_error_logs e" + where.sql(), where.params);
        List<ConsoleDTOs.ApiErrorItem> items = jdbc.query("SELECT e.* FROM api_error_logs e" + where.sql()
                        + " ORDER BY e.occurred_at DESC, e.id LIMIT :limit OFFSET :offset", limit(where.params, paging),
                (rs, i) -> new ConsoleDTOs.ApiErrorItem(text(rs, "id"), instant(rs, "occurred_at"),
                        rs.getString("request_id"), rs.getString("method"), rs.getString("path_template"),
                        rs.getInt("status"), rs.getString("error_code"), rs.getString("actor_type"),
                        rs.getString("actor_id"), text(rs, "org_id")));
        return new ConsoleDTOs.Page<>(items, total, paging.page(), paging.size());
    }

    /** Counts for a range; without bounds the last 24 hours up to now. */
    public ConsoleDTOs.ApiErrorSummary apiErrorSummary(AuthPrincipal principal, Instant from, Instant to) {
        guard.require(principal, PERM_API_ERRORS, "view");
        Instant end = to != null ? to : Instant.now();
        Instant start = from != null ? from : end.minus(24, ChronoUnit.HOURS);
        ConsoleSql.checkRange(start, end);
        Where where = apiErrorWhere(null, null, null, null, start, end);
        String table = " FROM api_error_logs e" + where.sql();
        Map<String, Object> totals = jdbc.queryForMap("SELECT count(*) AS total,"
                + " count(*) FILTER (WHERE e.status BETWEEN 400 AND 499) AS client,"
                + " count(*) FILTER (WHERE e.status >= 500) AS server" + table, where.params);
        List<ConsoleDTOs.StatusCount> byStatus = jdbc.query("SELECT e.status, count(*) AS n" + table
                        + " GROUP BY e.status ORDER BY n DESC, e.status", where.params,
                (rs, i) -> new ConsoleDTOs.StatusCount(rs.getInt("status"), rs.getLong("n")));
        List<ConsoleDTOs.PathCount> byPath = jdbc.query("SELECT e.method, e.path_template, count(*) AS n,"
                        + " count(*) FILTER (WHERE e.status >= 500) AS server" + table
                        + " GROUP BY e.method, e.path_template ORDER BY n DESC, e.path_template, e.method LIMIT 20", where.params,
                (rs, i) -> new ConsoleDTOs.PathCount(rs.getString("method"), rs.getString("path_template"),
                        rs.getLong("n"), rs.getLong("server")));
        List<ConsoleDTOs.CodeCount> byCode = jdbc.query("SELECT COALESCE(e.error_code, 'UNKNOWN') AS code, count(*) AS n"
                        + table + " GROUP BY 1 ORDER BY n DESC, 1 LIMIT 20", where.params,
                (rs, i) -> new ConsoleDTOs.CodeCount(rs.getString("code"), rs.getLong("n")));
        return new ConsoleDTOs.ApiErrorSummary(start, end, ((Number) totals.get("total")).longValue(),
                ((Number) totals.get("client")).longValue(), ((Number) totals.get("server")).longValue(),
                byStatus, byPath, byCode);
    }

    // ---------------------------------------------------------------- helpers

    private long count(String sql, MapSqlParameterSource params) {
        Long n = jdbc.queryForObject(sql, params, Long.class);
        return n == null ? 0 : n;
    }

    private static MapSqlParameterSource limit(MapSqlParameterSource params, Paging paging) {
        MapSqlParameterSource copy = new MapSqlParameterSource(params.getValues());
        copy.addValue("limit", paging.size());
        copy.addValue("offset", paging.offset());
        return copy;
    }

    private static UUID parseUuid(String id) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw ApiException.notFound();
        }
    }

    private static Instant toInstant(Object value) {
        if (value == null) return null;
        if (value instanceof java.sql.Timestamp ts) return ts.toInstant();
        if (value instanceof java.time.OffsetDateTime odt) return odt.toInstant();
        if (value instanceof Instant i) return i;
        return null;
    }
}
