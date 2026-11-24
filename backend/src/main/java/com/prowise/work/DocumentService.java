package com.prowise.work;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.authz.PermissionService;
import com.prowise.common.api.ApiException;
import com.prowise.project.ProjectService;
import com.prowise.project.ProjectService.ProjectResponse;
import com.prowise.work.WorkDTOs.Document;

/**
 * Project documents stored in the database (product owner decision), at most 10 MB each.
 * Uploaded first as drafts of the uploader; creating the configured project links them (one transaction).
 * Reading follows the task 2.1 project rule (unreadable or foreign = 404).
 */
@Service
public class DocumentService {

    public static final int MAX_BYTES = 10 * 1024 * 1024;

    private final JdbcTemplate jdbc;
    private final ProjectService projects;
    private final PermissionService permissions;

    public DocumentService(JdbcTemplate jdbc, ProjectService projects, PermissionService permissions) {
        this.jdbc = jdbc;
        this.projects = projects;
        this.permissions = permissions;
    }

    public record Content(Document document, byte[] bytes) {}

    @Transactional
    public Document uploadDraft(UUID orgId, Authentication auth, String fileName, String contentType, byte[] bytes) {
        permissions.requireMembership(auth, orgId);
        var principal = permissions.principal(auth);
        String name = fileName == null ? "" : fileName.replaceAll(".*[/\\\\]", "").trim();
        if (name.isEmpty() || name.length() > 255) throw WorkService.validation("file_name", "Give the file a name of up to 255 characters.");
        if (bytes == null || bytes.length == 0) throw WorkService.validation("file", "The file is empty.");
        if (bytes.length > MAX_BYTES) throw tooLarge();
        String type = contentType == null || contentType.isBlank() ? "application/octet-stream" : contentType.trim();
        if (type.length() > 100) type = "application/octet-stream";
        String id = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO file_metadata (id, org_id, project_id, uploaded_by, uploaded_by_user, file_name, file_size, file_type,
                    storage_path, content)
                VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'database', ?)
                """, id, orgId, principal.userId().toString(), principal.userId(), name, bytes.length, type, bytes);
        return draft(orgId, id);
    }

    @Transactional(readOnly = true)
    public List<Document> list(UUID orgId, String projectId, Authentication auth) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        return jdbc.query(SELECT + " WHERE f.org_id = ? AND f.project_id = ? AND f.content IS NOT NULL ORDER BY f.created_at, f.id",
                (rs, n) -> map(rs), orgId, project.id());
    }

    @Transactional(readOnly = true)
    public Content download(UUID orgId, String projectId, String documentId, Authentication auth) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        List<Content> found = jdbc.query(SELECT.replace("SELECT f.id,", "SELECT f.content, f.id,")
                        + " WHERE f.org_id = ? AND f.project_id = ? AND f.id = ? AND f.content IS NOT NULL",
                (rs, n) -> new Content(map(rs), rs.getBytes("content")), orgId, project.id(), documentId);
        if (found.isEmpty()) throw PermissionService.notFound();
        return found.get(0);
    }

    private Document draft(UUID orgId, String id) {
        return jdbc.query(SELECT + " WHERE f.org_id = ? AND f.id = ?", (rs, n) -> map(rs), orgId, id).get(0);
    }

    private static final String SELECT = """
            SELECT f.id, f.project_id, f.file_name, f.file_size, f.file_type, u.email, f.created_at
            FROM file_metadata f LEFT JOIN users u ON u.id = f.uploaded_by_user
            """;

    private static Document map(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new Document(rs.getString("id"), rs.getString("project_id"), rs.getString("file_name"), rs.getLong("file_size"),
                rs.getString("file_type"), rs.getString("email"), rs.getTimestamp("created_at").toInstant());
    }

    static ApiException tooLarge() {
        return new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "Each document can be at most 10 MB.");
    }
}
