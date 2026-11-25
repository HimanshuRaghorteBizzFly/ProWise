package com.prowise.project;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.authz.SecurityEvidenceService;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.common.storage.FileStorage;
import com.prowise.identity.AuthPrincipal;

/**
 * Project documents and evidence screenshots (task 4.4, the parts the delivery flow needs).
 *
 * <ul>
 *   <li>The organization comes from the path membership (never the body); projects and work items must belong to it,
 *       otherwise 404 with no metadata.</li>
 *   <li>Staged upload (no project yet): the create wizard, needs {@code project.create}. Only the uploader sees a
 *       staged file; the project setup attaches it in its own transaction.</li>
 *   <li>Project document: {@code project.edit} on that project. Screenshot: the work item's primary assignee, or the
 *       accountable developer of a Solo project.</li>
 *   <li>Download: anyone who can read the project (task 2.1 rule); a staged file only by its uploader.</li>
 *   <li>Type, size and file signature follow {@link FilePolicy}. Metadata, audit row and outbox event commit together;
 *       the stored bytes are removed again when that transaction rolls back.</li>
 * </ul>
 */
@Service
public class FileService {

    private static final int HEAD_BYTES = 8192;

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;
    private final SecurityEvidenceService evidence;
    private final ProjectService projects;
    private final FileStorage storage;
    private final ChangeRecorder changes;

    public FileService(JdbcTemplate jdbc, PermissionService permissions, SecurityEvidenceService evidence,
            ProjectService projects, FileStorage storage, ChangeRecorder changes) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.evidence = evidence;
        this.projects = projects;
        this.storage = storage;
        this.changes = changes;
    }

    /* ================================================================== upload */

    @Transactional
    public FileView upload(UUID orgId, Authentication authentication, String kindValue, String projectId, String workItemId,
            MultipartFile file) {
        permissions.requireMembership(authentication, orgId);
        AuthPrincipal actor = permissions.principal(authentication);
        FilePolicy.Kind kind = kind(kindValue);
        if (file == null || file.isEmpty()) throw validation("file", "choose a file to upload");

        String project = blank(projectId) ? null : projectId.trim();
        String item = blank(workItemId) ? null : workItemId.trim();
        if (item != null) {
            Map<String, Object> row = workItem(orgId, item, authentication);
            String itemProject = (String) row.get("project_id");
            if (project != null && !project.equals(itemProject)) throw PermissionService.notFound();
            project = itemProject;
            if (kind != FilePolicy.Kind.SCREENSHOT) throw validation("kind", "work items take screenshots");
            if (!actor.userId().toString().equals(row.get("primary_assignee_id"))) {
                throw new ApiException(HttpStatus.FORBIDDEN, "NOT_ASSIGNEE", "Only the assigned developer adds evidence to this task.");
            }
        } else if (project != null) {
            ProjectService.ProjectResponse readable = projects.get(orgId, project, authentication);
            if (kind == FilePolicy.Kind.PROJECT_DOCUMENT) {
                if (!permissions.canOnProject(authentication, orgId, project, PermissionKey.PROJECT_EDIT.value())) {
                    throw PermissionService.forbidden();
                }
            } else {
                UUID membership = permissions.requireMembership(authentication, orgId);
                boolean accountable = readable.accountable() != null && membership.equals(readable.accountable().membershipId());
                if (!"INDIVIDUAL".equals(readable.mode()) || !accountable) {
                    throw new ApiException(HttpStatus.FORBIDDEN, "NOT_ACCOUNTABLE_DEVELOPER",
                            "Only the project's developer adds screenshots to a Solo submission.");
                }
            }
        } else {
            // Staged for the create wizard.
            if (kind != FilePolicy.Kind.PROJECT_DOCUMENT) throw validation("project_id", "is required for screenshots");
            permissions.require(authentication, orgId, PermissionKey.PROJECT_CREATE.value());
        }

        byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException("The upload could not be read.", e);
        }
        byte[] head = java.util.Arrays.copyOf(content, Math.min(content.length, HEAD_BYTES));
        String name = FilePolicy.displayName(file.getOriginalFilename());
        FilePolicy.Decision decision = FilePolicy.check(kind, name, content.length, head);
        if (!decision.accepted()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "FILE_REJECTED", decision.problem(),
                    List.of(new ApiError.FieldError("file", decision.problem())));
        }

        String key = storage.put(orgId.toString(), content);
        removeOnRollback(key);
        String id = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO file_metadata (id, project_id, work_item_id, uploaded_by, uploaded_by_user, file_name, file_size,
                    file_type, storage_path, org_id, kind, sha256, attached_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, project, item, actor.userId().toString(), actor.userId(), name, (long) content.length,
                decision.contentType(), key, orgId, kind.name(), sha256(content),
                project == null ? null : Timestamp.from(Instant.now()));

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("file_id", id);
        snapshot.put("kind", kind.name());
        snapshot.put("project_id", project);
        snapshot.put("work_item_id", item);
        snapshot.put("size", content.length);
        snapshot.put("content_type", decision.contentType());
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, actor.userId(), "file.uploaded", "FILE", UUID.fromString(id), null,
                        null, snapshot),
                new ChangeRecorder.DomainEvent(orgId, "FILE", UUID.fromString(id), 0L, "FileUploaded", snapshot));
        return view(orgId, id);
    }

    /** Called by the project setup inside its transaction: staged documents of this uploader join the project. */
    public void attachStaged(UUID orgId, UUID uploaderId, String projectId, List<UUID> fileIds) {
        if (fileIds == null) return;
        if (fileIds.size() > 50) throw validation("document_file_ids", "at most 50 documents");
        for (UUID fileId : fileIds) {
            int updated = jdbc.update("""
                    UPDATE file_metadata SET project_id = ?, attached_at = now()
                    WHERE id = ? AND org_id = ? AND uploaded_by_user = ? AND project_id IS NULL AND kind = 'PROJECT_DOCUMENT'
                    """, projectId, fileId.toString(), orgId, uploaderId);
            if (updated != 1) {
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "FILE_NOT_STAGED",
                        "A document is no longer available. Upload it again.",
                        List.of(new ApiError.FieldError("document_file_ids", "unknown or already used: " + fileId)));
            }
        }
    }

    /* ================================================================== reads */

    @Transactional(readOnly = true)
    public List<FileView> projectFiles(UUID orgId, String projectId, Authentication authentication) {
        projects.get(orgId, projectId, authentication);
        return jdbc.query(SELECT + " WHERE f.org_id = ? AND f.project_id = ? AND f.kind = 'PROJECT_DOCUMENT' ORDER BY f.created_at",
                (rs, n) -> row(rs), orgId, projectId);
    }

    @Transactional(readOnly = true)
    public List<FileView> workItemFiles(UUID orgId, String workItemId, Authentication authentication) {
        workItem(orgId, workItemId, authentication);
        return jdbc.query(SELECT + " WHERE f.org_id = ? AND f.work_item_id = ? ORDER BY f.created_at",
                (rs, n) -> row(rs), orgId, workItemId);
    }

    /** Files referenced as evidence must exist in this organization and belong to that task or project. */
    public void requireEvidenceFile(UUID orgId, String fileId, String projectId, String workItemId) {
        Integer count = jdbc.queryForObject("""
                SELECT count(*) FROM file_metadata
                WHERE id = ? AND org_id = ? AND project_id = ? AND (CAST(? AS varchar) IS NULL OR work_item_id = ?)
                """, Integer.class, fileId, orgId, projectId, workItemId, workItemId);
        if (count == null || count != 1) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "EVIDENCE_FILE_UNKNOWN",
                    "An attached file is not part of this work. Upload it again.",
                    List.of(new ApiError.FieldError("evidence", "unknown file " + fileId)));
        }
    }

    public record Download(FileView file, InputStream content) {}

    @Transactional(readOnly = true)
    public Download download(UUID orgId, String fileId, Authentication authentication) {
        AuthPrincipal actor = permissions.principal(authentication);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT project_id, uploaded_by_user, storage_path FROM file_metadata WHERE id = ? AND org_id = ?",
                fileId == null ? "" : fileId, orgId);
        if (rows.isEmpty()) throw notFound(actor, fileId);
        Map<String, Object> row = rows.get(0);
        String projectId = (String) row.get("project_id");
        if (projectId == null) {
            if (!actor.userId().equals(row.get("uploaded_by_user"))) throw notFound(actor, fileId);
        } else if (!projects.readable(orgId, projectId, authentication)) {
            throw notFound(actor, fileId);
        }
        return new Download(view(orgId, fileId), storage.open((String) row.get("storage_path")));
    }

    @Transactional
    public void deleteStaged(UUID orgId, String fileId, Authentication authentication) {
        AuthPrincipal actor = permissions.principal(authentication);
        List<String> keys = jdbc.queryForList("""
                SELECT storage_path FROM file_metadata
                WHERE id = ? AND org_id = ? AND uploaded_by_user = ? AND project_id IS NULL
                """, String.class, fileId == null ? "" : fileId, orgId, actor.userId());
        if (keys.isEmpty()) throw notFound(actor, fileId);
        jdbc.update("DELETE FROM file_metadata WHERE id = ? AND org_id = ?", fileId, orgId);
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, actor.userId(), "file.discarded", "FILE", UUID.fromString(fileId),
                        null, Map.of("staged", true), null),
                new ChangeRecorder.DomainEvent(orgId, "FILE", UUID.fromString(fileId), 1L, "FileDiscarded",
                        Map.of("file_id", fileId)));
        String key = keys.get(0);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                storage.delete(key);
            }
        });
    }

    /* ================================================================== helpers */

    private static final String SELECT = """
            SELECT f.id, f.file_name, f.file_size, f.file_type, f.kind, f.project_id, f.work_item_id, f.created_at,
                   u.email AS uploader_email
            FROM file_metadata f LEFT JOIN users u ON u.id = f.uploaded_by_user
            """;

    private FileView view(UUID orgId, String id) {
        return jdbc.query(SELECT + " WHERE f.id = ? AND f.org_id = ?", (rs, n) -> row(rs), id, orgId).get(0);
    }

    private static FileView row(java.sql.ResultSet rs) throws java.sql.SQLException {
        String id = rs.getString("id");
        return new FileView(id, rs.getString("file_name"), rs.getLong("file_size"), rs.getString("file_type"),
                rs.getString("kind"), rs.getString("project_id"), rs.getString("work_item_id"),
                rs.getString("uploader_email"), rs.getTimestamp("created_at").toInstant(), "/v1/files/" + id + "/content");
    }

    /** The work item in this organization whose project the caller can read; else 404. */
    private Map<String, Object> workItem(UUID orgId, String workItemId, Authentication authentication) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT project_id, primary_assignee_id FROM work_items WHERE id = ? AND org_id = ?", workItemId, orgId);
        if (rows.isEmpty() || !projects.readable(orgId, (String) rows.get(0).get("project_id"), authentication)) {
            throw notFound(permissions.principal(authentication), workItemId);
        }
        return rows.get(0);
    }

    private void removeOnRollback(String key) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) storage.delete(key);
            }
        });
    }

    private ApiException notFound(AuthPrincipal actor, String ref) {
        evidence.recordDenied(actor, SecurityEvidenceService.ACCESS_DENIED, "FILE",
                ref == null ? null : ref.substring(0, Math.min(ref.length(), 100)), "Foreign, unknown or unreadable file");
        return PermissionService.notFound();
    }

    private static FilePolicy.Kind kind(String value) {
        try {
            return FilePolicy.Kind.valueOf(value == null ? "" : value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw validation("kind", "must be PROJECT_DOCUMENT or SCREENSHOT");
        }
    }

    private static String sha256(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The request has invalid fields.",
                List.of(new ApiError.FieldError(field, message)));
    }

    public record FileView(String id, String name, long size, String contentType, String kind, String projectId,
            String workItemId, String uploadedByEmail, Instant createdAt, String downloadPath) {}
}
