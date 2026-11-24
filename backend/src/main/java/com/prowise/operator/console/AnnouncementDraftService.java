package com.prowise.operator.console;

import static com.prowise.operator.console.ConsoleSql.instant;
import static com.prowise.operator.console.ConsoleSql.like;
import static com.prowise.operator.console.ConsoleSql.present;
import static com.prowise.operator.console.ConsoleSql.upper;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.identity.AuthPrincipal;

/**
 * Operator announcement drafts on the existing announcements table. Operators create and edit drafts and
 * submit them (PENDING_REVIEW); only a Super Admin publishes (existing /v1/admin/announcements/{id}/publish)
 * or sends a draft back (CHANGES_REQUESTED). Only the author, a Main Platform Operator or a Super Admin may
 * change a draft, and only while it is DRAFT or CHANGES_REQUESTED. Permission key: communications.announcements
 * (view / create / edit / delete; submit needs edit).
 */
@Service
@Transactional
public class AnnouncementDraftService {

    static final String PERM = "communications.announcements";
    static final String PENDING_REVIEW = "PENDING_REVIEW";
    static final String CHANGES_REQUESTED = "CHANGES_REQUESTED";
    private static final Set<String> EDITABLE = Set.of("DRAFT", CHANGES_REQUESTED);
    private static final Pattern CODE = Pattern.compile("[A-Z][A-Z0-9_]{0,39}");

    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;
    private final OperatorPermissionGuard guard;
    private final ConsoleAudit audit;
    private final ObjectMapper objectMapper;

    public AnnouncementDraftService(JdbcTemplate jdbc, NamedParameterJdbcTemplate named, OperatorPermissionGuard guard,
            ConsoleAudit audit, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.named = named;
        this.guard = guard;
        this.audit = audit;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public ConsoleDTOs.Page<DraftDTOs.AnnouncementDraft> list(AuthPrincipal principal, String status, String search,
            Integer page, Integer size) {
        guard.require(principal, PERM, "view");
        ConsoleSql.Paging paging = ConsoleSql.paging(page, size);
        ConsoleSql.Where where = new ConsoleSql.Where().add("a.author_type IS NOT NULL");
        if (present(status)) where.add("a.status = :status", "status", upper(status));
        if (present(search)) where.add("(a.title ILIKE :q OR a.message ILIKE :q)", "q", like(search));
        Long total = named.queryForObject("SELECT count(*) FROM announcements a" + where.sql(), where.params, Long.class);
        MapSqlParameterSource params = new MapSqlParameterSource(where.params.getValues())
                .addValue("limit", paging.size()).addValue("offset", paging.offset());
        List<DraftDTOs.AnnouncementDraft> items = named.query("SELECT a.* FROM announcements a" + where.sql()
                + " ORDER BY a.updated_at DESC, a.id LIMIT :limit OFFSET :offset", params, (rs, i) -> map(rs));
        return new ConsoleDTOs.Page<>(items, total == null ? 0 : total, paging.page(), paging.size());
    }

    @Transactional(readOnly = true)
    public DraftDTOs.AnnouncementDraft get(AuthPrincipal principal, String id) {
        guard.require(principal, PERM, "view");
        return load(id);
    }

    public DraftDTOs.AnnouncementDraft create(AuthPrincipal principal, DraftDTOs.AnnouncementDraftRequest req, String ip) {
        guard.require(principal, PERM, "create");
        Fields f = validate(req);
        String id = "ann-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        jdbc.update("""
                INSERT INTO announcements (id, title, message, type, target_audience, target_plans, target_org_ids, channels,
                                           status, scheduled_for, expires_at, created_by, author_type, author_id,
                                           version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, 'DRAFT', ?, ?, ?, ?, ?, 0, now(), now())
                """, id, f.title, f.message, f.type, f.audience, json(f.plans), json(f.orgIds), json(f.channels),
                ts(req.scheduledFor()), ts(req.expiresAt()), createdBy(principal),
                OperatorPermissionGuard.actorType(principal), OperatorPermissionGuard.actorId(principal));
        audit.record(principal, "COMMUNICATION", "ANNOUNCEMENT_DRAFT_CREATED", "announcements", id,
                "Created announcement draft: " + f.title, ip);
        return load(id);
    }

    public DraftDTOs.AnnouncementDraft update(AuthPrincipal principal, String id, DraftDTOs.AnnouncementDraftRequest req,
            String ip) {
        guard.require(principal, PERM, "edit");
        DraftDTOs.AnnouncementDraft current = load(id);
        long expected = ExpectedVersion.checkRequired(current.version(), req == null ? null : req.expectedVersion());
        requireChangeable(principal, current);
        Fields f = validate(req);
        int rows = jdbc.update("""
                UPDATE announcements SET title = ?, message = ?, type = ?, target_audience = ?, target_plans = ?::jsonb,
                       target_org_ids = ?::jsonb, channels = ?::jsonb, scheduled_for = ?, expires_at = ?,
                       version = version + 1, updated_at = now()
                 WHERE id = ? AND version = ? AND author_type IS NOT NULL
                """, f.title, f.message, f.type, f.audience, json(f.plans), json(f.orgIds), json(f.channels),
                ts(req.scheduledFor()), ts(req.expiresAt()), id, expected);
        ExpectedVersion.requireUpdated(rows);
        audit.record(principal, "COMMUNICATION", "ANNOUNCEMENT_DRAFT_UPDATED", "announcements", id,
                "Updated announcement draft: " + f.title, ip);
        return load(id);
    }

    public void delete(AuthPrincipal principal, String id, Long expectedVersion, String ip) {
        guard.require(principal, PERM, "delete");
        DraftDTOs.AnnouncementDraft current = load(id);
        long expected = ExpectedVersion.checkRequired(current.version(), expectedVersion);
        requireChangeable(principal, current);
        int rows = jdbc.update("DELETE FROM announcements WHERE id = ? AND version = ? AND author_type IS NOT NULL", id, expected);
        ExpectedVersion.requireUpdated(rows);
        audit.record(principal, "COMMUNICATION", "ANNOUNCEMENT_DRAFT_DELETED", "announcements", id,
                "Deleted announcement draft: " + current.title(), ip);
    }

    public DraftDTOs.AnnouncementDraft submit(AuthPrincipal principal, String id, Long expectedVersion, String ip) {
        guard.require(principal, PERM, "edit");
        DraftDTOs.AnnouncementDraft current = load(id);
        long expected = ExpectedVersion.checkRequired(current.version(), expectedVersion);
        requireChangeable(principal, current);
        int rows = jdbc.update("""
                UPDATE announcements SET status = 'PENDING_REVIEW', submitted_at = now(), submitted_by = ?,
                       reviewer_note = NULL, version = version + 1, updated_at = now()
                 WHERE id = ? AND version = ? AND author_type IS NOT NULL
                """, createdBy(principal), id, expected);
        ExpectedVersion.requireUpdated(rows);
        audit.record(principal, "COMMUNICATION", "ANNOUNCEMENT_DRAFT_SUBMITTED", "announcements", id,
                "Submitted announcement draft for Super Admin review: " + current.title(), ip);
        return load(id);
    }

    /** Super Admin only (enforced by the controller): sends a submitted draft back to its author. */
    public DraftDTOs.AnnouncementDraft requestChanges(AuthPrincipal principal, String id, DraftDTOs.ReviewRequest req, String ip) {
        if (!OperatorPermissionGuard.isSuperAdmin(principal)) {
            throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, "Only a Super Admin reviews announcement drafts.");
        }
        DraftDTOs.AnnouncementDraft current = load(id);
        long expected = ExpectedVersion.checkRequired(current.version(), req == null ? null : req.expectedVersion());
        if (!PENDING_REVIEW.equals(current.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_STATE", "Only a submitted draft can be sent back.");
        }
        int rows = jdbc.update("""
                UPDATE announcements SET status = 'CHANGES_REQUESTED', reviewer_note = ?, reviewed_by = ?, reviewed_at = now(),
                       version = version + 1, updated_at = now()
                 WHERE id = ? AND version = ?
                """, req.reviewerNote(), principal.email(), id, expected);
        ExpectedVersion.requireUpdated(rows);
        audit.record(principal, "COMMUNICATION", "ANNOUNCEMENT_DRAFT_CHANGES_REQUESTED", "announcements", id,
                "Requested changes on announcement draft: " + current.title(), ip);
        return load(id);
    }

    // ---------------------------------------------------------------- helpers

    private void requireChangeable(AuthPrincipal principal, DraftDTOs.AnnouncementDraft draft) {
        boolean author = OperatorPermissionGuard.actorId(principal).equals(draft.authorId());
        if (!author && !OperatorPermissionGuard.isSuperAdmin(principal) && !guard.isMainOperator(principal)) {
            throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN, "Only the author can change this draft.");
        }
        if (!EDITABLE.contains(draft.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_STATE",
                    "Only a draft in DRAFT or CHANGES_REQUESTED can be changed (current: " + draft.status() + ").");
        }
    }

    private DraftDTOs.AnnouncementDraft load(String id) {
        List<DraftDTOs.AnnouncementDraft> found = jdbc.query(
                "SELECT * FROM announcements WHERE id = ? AND author_type IS NOT NULL", (rs, i) -> map(rs), id);
        if (found.isEmpty()) {
            throw ApiException.notFound();
        }
        return found.get(0);
    }

    private record Fields(String title, String message, String type, String audience, List<String> plans,
                          List<String> orgIds, List<String> channels) {}

    private static Fields validate(DraftDTOs.AnnouncementDraftRequest req) {
        List<ApiError.FieldError> errors = new ArrayList<>();
        if (req == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "The request has invalid fields.",
                    List.of(new ApiError.FieldError("title", "is required"), new ApiError.FieldError("message", "is required")));
        }
        String title = req.title() == null ? "" : req.title().trim();
        String message = req.message() == null ? "" : req.message().trim();
        if (title.isEmpty()) errors.add(new ApiError.FieldError("title", "is required"));
        else if (title.length() > 255) errors.add(new ApiError.FieldError("title", "must be at most 255 characters"));
        if (message.isEmpty()) errors.add(new ApiError.FieldError("message", "is required"));
        else if (message.length() > 20_000) errors.add(new ApiError.FieldError("message", "must be at most 20000 characters"));
        String type = req.type() == null || req.type().isBlank() ? "INFO" : upper(req.type());
        if (!CODE.matcher(type).matches()) errors.add(new ApiError.FieldError("type", "must be letters, digits and underscores"));
        String audience = req.targetAudience() == null || req.targetAudience().isBlank() ? "ALL_ORGS" : upper(req.targetAudience());
        if (!CODE.matcher(audience).matches()) errors.add(new ApiError.FieldError("target_audience", "must be letters, digits and underscores"));
        if (req.scheduledFor() != null && req.expiresAt() != null && req.expiresAt().isBefore(req.scheduledFor())) {
            errors.add(new ApiError.FieldError("expires_at", "must not be before scheduled_for"));
        }
        List<String> channels = req.channels() == null || req.channels().isEmpty() ? List.of("IN_APP_BANNER") : req.channels();
        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "The request has invalid fields.", errors);
        }
        return new Fields(title, message, type, audience, clean(req.targetPlans()), clean(req.targetOrgIds()), clean(channels));
    }

    private static List<String> clean(List<String> values) {
        if (values == null) return List.of();
        return values.stream().filter(v -> v != null && !v.isBlank()).map(String::trim).distinct().limit(200).toList();
    }

    private static String createdBy(AuthPrincipal principal) {
        return principal.email() != null ? principal.email() : OperatorPermissionGuard.actorId(principal);
    }

    private static Timestamp ts(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    private String json(List<String> values) {
        try {
            return objectMapper.writeValueAsString(values == null ? List.of() : values);
        } catch (Exception e) {
            return "[]";
        }
    }

    private List<String> list(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private DraftDTOs.AnnouncementDraft map(ResultSet rs) throws SQLException {
        return new DraftDTOs.AnnouncementDraft(rs.getString("id"), rs.getString("title"), rs.getString("message"),
                rs.getString("type"), rs.getString("target_audience"), list(rs.getString("target_plans")),
                list(rs.getString("target_org_ids")), list(rs.getString("channels")), rs.getString("status"),
                instant(rs, "scheduled_for"), instant(rs, "expires_at"), instant(rs, "published_at"),
                rs.getString("author_type"), rs.getString("author_id"), rs.getString("created_by"),
                instant(rs, "submitted_at"), rs.getString("submitted_by"), rs.getString("reviewer_note"),
                rs.getString("reviewed_by"), instant(rs, "reviewed_at"), instant(rs, "created_at"),
                instant(rs, "updated_at"), rs.getLong("version"));
    }
}
