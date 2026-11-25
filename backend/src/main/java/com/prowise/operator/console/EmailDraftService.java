package com.prowise.operator.console;

import static com.prowise.operator.console.ConsoleSql.instant;
import static com.prowise.operator.console.ConsoleSql.like;
import static com.prowise.operator.console.ConsoleSql.present;
import static com.prowise.operator.console.ConsoleSql.upper;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.identity.AuthPrincipal;

/**
 * Operator email drafts for Super Admin review (DRAFT -> SUBMITTED -> APPROVED / REJECTED). Nothing is sent
 * from here. A REJECTED draft goes back to the author for edits (becomes DRAFT again when saved). Permission
 * key: communications.email_drafts (view / create / edit / delete; submit needs execute).
 */
@Service
@Transactional
public class EmailDraftService {

    static final String PERM = "communications.email_drafts";

    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;
    private final OperatorPermissionGuard guard;
    private final ConsoleAudit audit;

    public EmailDraftService(JdbcTemplate jdbc, NamedParameterJdbcTemplate named, OperatorPermissionGuard guard,
            ConsoleAudit audit) {
        this.jdbc = jdbc;
        this.named = named;
        this.guard = guard;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public ConsoleDTOs.Page<DraftDTOs.EmailDraft> list(AuthPrincipal principal, String status, String search,
            Integer page, Integer size) {
        if (!OperatorPermissionGuard.isSuperAdmin(principal)) {
            guard.require(principal, PERM, "view");
        }
        ConsoleSql.Paging paging = ConsoleSql.paging(page, size);
        ConsoleSql.Where where = new ConsoleSql.Where();
        if (present(status)) where.add("d.status = :status", "status", upper(status));
        if (present(search)) where.add("(d.name ILIKE :q OR d.subject ILIKE :q OR d.body_text ILIKE :q)", "q", like(search));
        Long total = named.queryForObject("SELECT count(*) FROM operator_email_drafts d" + where.sql(), where.params, Long.class);
        MapSqlParameterSource params = new MapSqlParameterSource(where.params.getValues())
                .addValue("limit", paging.size()).addValue("offset", paging.offset());
        List<DraftDTOs.EmailDraft> items = named.query("SELECT d.* FROM operator_email_drafts d" + where.sql()
                + " ORDER BY d.updated_at DESC, d.id LIMIT :limit OFFSET :offset", params, (rs, i) -> map(rs));
        return new ConsoleDTOs.Page<>(items, total == null ? 0 : total, paging.page(), paging.size());
    }

    @Transactional(readOnly = true)
    public DraftDTOs.EmailDraft get(AuthPrincipal principal, String id) {
        if (!OperatorPermissionGuard.isSuperAdmin(principal)) {
            guard.require(principal, PERM, "view");
        }
        return load(id);
    }

    public DraftDTOs.EmailDraft create(AuthPrincipal principal, DraftDTOs.EmailDraftRequest req, String ip) {
        guard.require(principal, PERM, "create");
        DraftDTOs.EmailDraftRequest f = validate(req);
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO operator_email_drafts (id, name, category, subject, headline, body_text, body_html, cta_label,
                                                   audience_description, status, author_type, created_by, created_by_email,
                                                   version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, 0, now(), now())
                """, id, f.name(), f.category(), f.subject(), f.headline(), f.bodyText(), f.bodyHtml(), f.ctaLabel(),
                f.audienceDescription(), OperatorPermissionGuard.actorType(principal),
                OperatorPermissionGuard.actorId(principal), principal.email());
        audit.record(principal, "COMMUNICATION", "EMAIL_DRAFT_CREATED", "operator_email_drafts", id.toString(),
                "Created email draft: " + f.name(), ip);
        return load(id.toString());
    }

    public DraftDTOs.EmailDraft update(AuthPrincipal principal, String id, DraftDTOs.EmailDraftRequest req, String ip) {
        guard.require(principal, PERM, "edit");
        DraftDTOs.EmailDraft current = load(id);
        long expected = ExpectedVersion.checkRequired(current.version(), req == null ? null : req.expectedVersion());
        requireChangeable(principal, current);
        DraftDTOs.EmailDraftRequest f = validate(req);
        int rows = jdbc.update("""
                UPDATE operator_email_drafts SET name = ?, category = ?, subject = ?, headline = ?, body_text = ?,
                       body_html = ?, cta_label = ?, audience_description = ?, status = 'DRAFT',
                       version = version + 1, updated_at = now()
                 WHERE id = ? AND version = ?
                """, f.name(), f.category(), f.subject(), f.headline(), f.bodyText(), f.bodyHtml(), f.ctaLabel(),
                f.audienceDescription(), UUID.fromString(id), expected);
        ExpectedVersion.requireUpdated(rows);
        audit.record(principal, "COMMUNICATION", "EMAIL_DRAFT_UPDATED", "operator_email_drafts", id,
                "Updated email draft: " + f.name(), ip);
        return load(id);
    }

    public void delete(AuthPrincipal principal, String id, Long expectedVersion, String ip) {
        guard.require(principal, PERM, "delete");
        DraftDTOs.EmailDraft current = load(id);
        long expected = ExpectedVersion.checkRequired(current.version(), expectedVersion);
        requireChangeable(principal, current);
        int rows = jdbc.update("DELETE FROM operator_email_drafts WHERE id = ? AND version = ?", UUID.fromString(id), expected);
        ExpectedVersion.requireUpdated(rows);
        audit.record(principal, "COMMUNICATION", "EMAIL_DRAFT_DELETED", "operator_email_drafts", id,
                "Deleted email draft: " + current.name(), ip);
    }

    public DraftDTOs.EmailDraft submit(AuthPrincipal principal, String id, Long expectedVersion, String ip) {
        guard.require(principal, PERM, "execute");
        DraftDTOs.EmailDraft current = load(id);
        long expected = ExpectedVersion.checkRequired(current.version(), expectedVersion);
        requireChangeable(principal, current);
        int rows = jdbc.update("""
                UPDATE operator_email_drafts SET status = 'SUBMITTED', submitted_at = now(), version = version + 1,
                       updated_at = now()
                 WHERE id = ? AND version = ?
                """, UUID.fromString(id), expected);
        ExpectedVersion.requireUpdated(rows);
        audit.record(principal, "COMMUNICATION", "EMAIL_DRAFT_SUBMITTED", "operator_email_drafts", id,
                "Submitted email draft for Super Admin review: " + current.name(), ip);
        return load(id);
    }

    /** Super Admin only: approve or reject a SUBMITTED draft (approval sends nothing). */
    public DraftDTOs.EmailDraft review(AuthPrincipal principal, String id, boolean approve, DraftDTOs.ReviewRequest req, String ip) {
        if (!OperatorPermissionGuard.isSuperAdmin(principal)) {
            throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, "Only a Super Admin reviews email drafts.");
        }
        DraftDTOs.EmailDraft current = load(id);
        long expected = ExpectedVersion.checkRequired(current.version(), req == null ? null : req.expectedVersion());
        if (!"SUBMITTED".equals(current.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_STATE", "Only a submitted draft can be reviewed.");
        }
        int rows = jdbc.update("""
                UPDATE operator_email_drafts SET status = ?, reviewed_by = ?, reviewed_at = now(), reviewer_note = ?,
                       version = version + 1, updated_at = now()
                 WHERE id = ? AND version = ?
                """, approve ? "APPROVED" : "REJECTED", principal.email(), req.reviewerNote(), UUID.fromString(id), expected);
        ExpectedVersion.requireUpdated(rows);
        audit.record(principal, "COMMUNICATION", approve ? "EMAIL_DRAFT_APPROVED" : "EMAIL_DRAFT_REJECTED",
                "operator_email_drafts", id, (approve ? "Approved" : "Rejected") + " email draft: " + current.name(), ip);
        return load(id);
    }

    // ---------------------------------------------------------------- helpers

    private void requireChangeable(AuthPrincipal principal, DraftDTOs.EmailDraft draft) {
        boolean author = OperatorPermissionGuard.actorId(principal).equals(draft.createdBy());
        if (!author && !OperatorPermissionGuard.isSuperAdmin(principal) && !guard.isMainOperator(principal)) {
            throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, "Only the author can change this draft.");
        }
        if (!"DRAFT".equals(draft.status()) && !"REJECTED".equals(draft.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_STATE",
                    "Only a DRAFT or REJECTED email draft can be changed (current: " + draft.status() + ").");
        }
    }

    private DraftDTOs.EmailDraft load(String id) {
        UUID uuid;
        try {
            uuid = UUID.fromString(id);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw ApiException.notFound();
        }
        List<DraftDTOs.EmailDraft> found = jdbc.query("SELECT * FROM operator_email_drafts WHERE id = ?", (rs, i) -> map(rs), uuid);
        if (found.isEmpty()) {
            throw ApiException.notFound();
        }
        return found.get(0);
    }

    private static DraftDTOs.EmailDraftRequest validate(DraftDTOs.EmailDraftRequest req) {
        if (req == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "The request has invalid fields.",
                    List.of(new ApiError.FieldError("name", "is required")));
        }
        List<ApiError.FieldError> errors = new ArrayList<>();
        String name = required(req.name(), "name", 200, errors);
        String subject = required(req.subject(), "subject", 255, errors);
        String bodyText = required(req.bodyText(), "body_text", 100_000, errors);
        String category = optional(req.category(), "category", 60, errors);
        String headline = optional(req.headline(), "headline", 255, errors);
        String cta = optional(req.ctaLabel(), "cta_label", 120, errors);
        String audience = optional(req.audienceDescription(), "audience_description", 500, errors);
        String html = req.bodyHtml() == null || req.bodyHtml().isBlank() ? null : req.bodyHtml();
        if (html != null) {
            if (html.length() > 200_000) {
                errors.add(new ApiError.FieldError("body_html", "must be at most 200000 characters"));
            } else {
                String violation = EmailHtmlPolicy.violation(html);
                if (violation != null) errors.add(new ApiError.FieldError("body_html", violation));
            }
        }
        for (String[] field : new String[][] {{"subject", subject}, {"headline", headline}, {"cta_label", cta}}) {
            if (field[1] != null && EmailHtmlPolicy.violation(field[1]) != null) {
                errors.add(new ApiError.FieldError(field[0], "must not contain scripts or event handlers"));
            }
        }
        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "The request has invalid fields.", errors);
        }
        return new DraftDTOs.EmailDraftRequest(name, category, subject, headline, bodyText, html, cta, audience, null);
    }

    private static String required(String value, String field, int max, List<ApiError.FieldError> errors) {
        String v = value == null ? "" : value.trim();
        if (v.isEmpty()) {
            errors.add(new ApiError.FieldError(field, "is required"));
            return null;
        }
        if (v.length() > max) errors.add(new ApiError.FieldError(field, "must be at most " + max + " characters"));
        return v;
    }

    private static String optional(String value, String field, int max, List<ApiError.FieldError> errors) {
        if (value == null || value.isBlank()) return null;
        String v = value.trim();
        if (v.length() > max) errors.add(new ApiError.FieldError(field, "must be at most " + max + " characters"));
        return v;
    }

    private static DraftDTOs.EmailDraft map(ResultSet rs) throws SQLException {
        return new DraftDTOs.EmailDraft(rs.getString("id"), rs.getString("name"), rs.getString("category"),
                rs.getString("subject"), rs.getString("headline"), rs.getString("body_text"), rs.getString("body_html"),
                rs.getString("cta_label"), rs.getString("audience_description"), rs.getString("status"),
                rs.getString("author_type"), rs.getString("created_by"), rs.getString("created_by_email"),
                instant(rs, "submitted_at"), rs.getString("reviewed_by"), instant(rs, "reviewed_at"),
                rs.getString("reviewer_note"), instant(rs, "created_at"), instant(rs, "updated_at"), rs.getLong("version"));
    }
}
