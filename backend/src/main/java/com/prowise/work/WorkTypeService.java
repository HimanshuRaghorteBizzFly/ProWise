package com.prowise.work;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.authz.PermissionService;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.work.WorkDTOs.WorkType;
import com.prowise.work.WorkDTOs.WorkTypeRequest;

/** Task 3.1 (T19): organization work types, created, read, edited and retired. Retired types stay on existing work. */
@Service
public class WorkTypeService {

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;
    private final ChangeRecorder changes;

    public WorkTypeService(JdbcTemplate jdbc, PermissionService permissions, ChangeRecorder changes) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.changes = changes;
    }

    @Transactional(readOnly = true)
    public List<WorkType> list(UUID orgId, Authentication auth) {
        permissions.requireMembership(auth, orgId);
        return jdbc.query("SELECT id, name, description, retired_at, version FROM work_types WHERE org_id = ? ORDER BY lower(name)",
                (rs, n) -> new WorkType(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("description"),
                        rs.getTimestamp("retired_at") != null, rs.getLong("version")), orgId);
    }

    @Transactional
    public WorkType create(UUID orgId, Authentication auth, WorkTypeRequest request) {
        UUID userId = permissions.principal(auth).userId();
        String name = name(request.name());
        UUID id = UUID.randomUUID();
        try {
            jdbc.update("INSERT INTO work_types (id, org_id, name, description, created_by) VALUES (?, ?, ?, ?, ?)",
                    id, orgId, name, description(request.description()), userId);
        } catch (DuplicateKeyException duplicate) {
            throw duplicate();
        }
        WorkType created = one(orgId, id);
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, userId, "work_type.created", "WORK_TYPE", id, null, null, Map.of("name", name)),
                new ChangeRecorder.DomainEvent(orgId, "WORK_TYPE", id, 0, "WorkTypeCreated", Map.of("name", name)));
        return created;
    }

    @Transactional
    public WorkType update(UUID orgId, UUID typeId, Authentication auth, WorkTypeRequest request) {
        UUID userId = permissions.principal(auth).userId();
        WorkType before = one(orgId, typeId);
        if (request.expectedVersion() == null) throw WorkService.validation("expected_version", "is required");
        ExpectedVersion.check(before.version(), request.expectedVersion());
        if (before.retired()) throw new ApiException(HttpStatus.CONFLICT, "WORK_TYPE_RETIRED", "Retired work types cannot be edited.");
        String name = request.name() == null ? before.name() : name(request.name());
        String description = request.description() == null ? before.description() : description(request.description());
        try {
            ExpectedVersion.requireUpdated(jdbc.update("""
                    UPDATE work_types SET name = ?, description = ?, version = version + 1, updated_at = now()
                    WHERE id = ? AND org_id = ? AND version = ?
                    """, name, description, typeId, orgId, request.expectedVersion()));
        } catch (DuplicateKeyException duplicate) {
            throw duplicate();
        }
        WorkType after = one(orgId, typeId);
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, userId, "work_type.updated", "WORK_TYPE", typeId, null,
                        Map.of("name", before.name()), Map.of("name", after.name())),
                new ChangeRecorder.DomainEvent(orgId, "WORK_TYPE", typeId, after.version(), "WorkTypeUpdated", Map.of("name", after.name())));
        return after;
    }

    @Transactional
    public WorkType retire(UUID orgId, UUID typeId, Authentication auth, Long expectedVersion) {
        UUID userId = permissions.principal(auth).userId();
        WorkType before = one(orgId, typeId);
        if (expectedVersion == null) throw WorkService.validation("expected_version", "is required");
        ExpectedVersion.check(before.version(), expectedVersion);
        if (before.retired()) return before;
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE work_types SET retired_at = now(), version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, typeId, orgId, expectedVersion));
        WorkType after = one(orgId, typeId);
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, userId, "work_type.retired", "WORK_TYPE", typeId, null,
                        Map.of("retired", false), Map.of("retired", true)),
                new ChangeRecorder.DomainEvent(orgId, "WORK_TYPE", typeId, after.version(), "WorkTypeRetired", Map.of("name", after.name())));
        return after;
    }

    private WorkType one(UUID orgId, UUID id) {
        return jdbc.query("SELECT id, name, description, retired_at, version FROM work_types WHERE id = ? AND org_id = ?",
                (rs, n) -> new WorkType(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("description"),
                        rs.getTimestamp("retired_at") != null, rs.getLong("version")), id, orgId)
                .stream().findFirst().orElseThrow(PermissionService::notFound);
    }

    private static String name(String value) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty() || trimmed.length() > 80) throw WorkService.validation("name", "Enter a name of up to 80 characters.");
        return trimmed;
    }

    private static String description(String value) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.length() > 300) throw WorkService.validation("description", "must be at most 300 characters");
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static ApiException duplicate() {
        return new ApiException(HttpStatus.CONFLICT, "DUPLICATE_WORK_TYPE", "A work type with this name already exists.",
                List.of(new ApiError.FieldError("name", "is already in use")));
    }
}
