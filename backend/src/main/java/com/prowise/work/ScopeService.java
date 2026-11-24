package com.prowise.work;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
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

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.domain.ScopePlan;
import com.prowise.domain.ScopePlan.Change;
import com.prowise.domain.ScopePlan.Kind;
import com.prowise.domain.ScopePlan.Leaf;
import com.prowise.domain.WorkBreakdown;
import com.prowise.domain.WorkBreakdown.Level;
import com.prowise.project.ProjectService;
import com.prowise.project.ProjectService.ProjectResponse;

/**
 * Task 3.2: approved scope versions. A draft lists changes against the active version; approval (project.scope.change)
 * atomically activates the new version, supersedes the old one, applies the changes to the work items and writes
 * audit + outbox. Approved versions never change; a draft based on an older version is a 409 STALE_VERSION.
 */
@Service
public class ScopeService {

    private final JdbcTemplate jdbc;
    private final ProjectService projects;
    private final PermissionService permissions;
    private final ChangeRecorder changes;
    private final WorkService work;
    private final StructuredProgressService progress;

    public ScopeService(JdbcTemplate jdbc, ProjectService projects, PermissionService permissions, ChangeRecorder changes,
            WorkService work, StructuredProgressService progress) {
        this.progress = progress;
        this.jdbc = jdbc;
        this.projects = projects;
        this.permissions = permissions;
        this.changes = changes;
        this.work = work;
    }

    /* ================================================================== DTOs */

    public record ScopePart(String title, BigDecimal points) {}

    /** kind ADD: title, points, parent_id (a phase or deliverable, or none). SPLIT: parts. REWEIGHT: points. */
    public record ScopeChangeRequest(String kind, String workItemId, BigDecimal points, String title, String parentId,
            List<ScopePart> parts) {}

    public record DraftRequest(String reason, Integer expectedBaseVersion, List<ScopeChangeRequest> changes) {}

    public record ScopeLeaf(String workItemId, String key, String title, BigDecimal points, boolean cancelled) {}

    public record ScopeChangeView(String kind, String workItemId, String key, String title, BigDecimal previousPoints,
            BigDecimal newPoints, String sourceWorkItemId) {}

    public record ScopeVersion(UUID id, int versionNo, int baseVersionNo, String unit, String status, String reason,
            String authorEmail, String approverEmail, Instant createdAt, Instant approvedAt, Instant supersededAt,
            BigDecimal totalPoints, List<ScopeLeaf> leaves, List<ScopeChangeView> changes, long version) {}

    /* ================================================================== initial baseline (setup) */

    /**
     * The setup's tasks become version 1. Approved at once when the creator holds project.scope.change, otherwise
     * left as a draft for someone who does. Called inside the configured-project transaction.
     */
    static UUID createInitialBaseline(JdbcTemplate jdbc, UUID orgId, String projectId, UUID authorId, boolean approve,
            Map<String, BigDecimal> leaves) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO scope_versions (id, org_id, project_id, version_no, base_version_no, unit, status, reason, author_id)
                VALUES (?, ?, ?, 1, 0, 'POINTS', 'DRAFT', 'Initial scope from project setup', ?)
                """, id, orgId, projectId, authorId);
        leaves.forEach((itemId, weight) -> jdbc.update(
                "INSERT INTO scope_leaves (scope_version_id, org_id, work_item_id, weight) VALUES (?, ?, ?, ?)", id, orgId, itemId, weight));
        leaves.forEach((itemId, weight) -> jdbc.update("""
                INSERT INTO scope_changes (id, org_id, scope_version_id, kind, work_item_id, new_weight) VALUES (?, ?, ?, 'ADD', ?, ?)
                """, UUID.randomUUID(), orgId, id, itemId, weight));
        if (approve) {
            jdbc.update("""
                    UPDATE scope_versions SET status = 'ACTIVE', approver_id = ?, approved_at = now(), effective_at = now(), version = version + 1
                    WHERE id = ?
                    """, authorId, id);
        }
        return id;
    }

    /* ================================================================== reads */

    @Transactional(readOnly = true)
    public List<ScopeVersion> list(UUID orgId, String projectId, Authentication auth) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        List<UUID> ids = jdbc.queryForList("""
                SELECT id FROM scope_versions WHERE org_id = ? AND project_id = ?
                ORDER BY CASE status WHEN 'DRAFT' THEN 1 ELSE 0 END, version_no DESC, created_at DESC
                """, UUID.class, orgId, project.id());
        return ids.stream().map(id -> view(orgId, id)).toList();
    }

    /** A scope version with its project, the project's active version (to show the effect) and whether the caller may approve it. */
    public record ProjectScopeVersion(String projectId, String projectKey, String projectName, boolean canApprove,
            ScopeVersion version, ScopeVersion active) {}

    /** Scope versions of every Structured project the caller may read; status DRAFT, ACTIVE, SUPERSEDED or all. */
    @Transactional(readOnly = true)
    public List<ProjectScopeVersion> orgVersions(UUID orgId, Authentication auth, String status) {
        String wanted = status == null || status.isBlank() ? null : status.trim().toUpperCase(java.util.Locale.ROOT);
        if (wanted != null && !List.of("DRAFT", "ACTIVE", "SUPERSEDED").contains(wanted)) {
            throw WorkService.validation("status", "must be DRAFT, ACTIVE or SUPERSEDED");
        }
        List<ProjectScopeVersion> result = new ArrayList<>();
        for (ProjectResponse project : projects.readable(orgId, auth, "STRUCTURED")) {
            List<UUID> ids = jdbc.queryForList("""
                    SELECT id FROM scope_versions WHERE org_id = ? AND project_id = ? AND (CAST(? AS text) IS NULL OR status = CAST(? AS text))
                    ORDER BY CASE status WHEN 'DRAFT' THEN 0 ELSE 1 END, version_no DESC, created_at DESC
                    """, UUID.class, orgId, project.id(), wanted, wanted);
            for (UUID id : ids) result.add(withProject(orgId, project, view(orgId, id), auth));
        }
        result.sort((a, b) -> b.version().createdAt().compareTo(a.version().createdAt()));
        return result;
    }

    /** One scope version by id when its project is readable; otherwise 404 with no metadata. */
    @Transactional(readOnly = true)
    public ProjectScopeVersion orgVersion(UUID orgId, UUID versionId, Authentication auth) {
        String projectId = jdbc.query("SELECT project_id FROM scope_versions WHERE id = ? AND org_id = ?", (rs, n) -> rs.getString(1), versionId, orgId)
                .stream().findFirst().orElseThrow(PermissionService::notFound);
        ProjectResponse project = projects.get(orgId, projectId, auth);
        return withProject(orgId, project, view(orgId, versionId), auth);
    }

    private ProjectScopeVersion withProject(UUID orgId, ProjectResponse project, ScopeVersion version, Authentication auth) {
        UUID activeId = jdbc.query("SELECT id FROM scope_versions WHERE org_id = ? AND project_id = ? AND status = 'ACTIVE'",
                (rs, n) -> rs.getObject(1, UUID.class), orgId, project.id()).stream().findFirst().orElse(null);
        ScopeVersion active = activeId == null || activeId.equals(version.id()) ? null : view(orgId, activeId);
        boolean canApprove = "DRAFT".equals(version.status()) && !project.archived()
                && permissions.canOnProject(auth, orgId, project.id(), PermissionKey.PROJECT_SCOPE_CHANGE.value());
        return new ProjectScopeVersion(project.id(), project.key(), project.name(), canApprove, version, active);
    }

    /** Leaves of the active version (empty when none is approved yet): the denominator for progress (task 3.5). */
    public List<ScopeLeaf> activeLeaves(UUID orgId, String projectId) {
        return jdbc.query("""
                SELECT l.work_item_id, w.key, w.title, l.weight, l.cancelled FROM scope_leaves l
                JOIN scope_versions v ON v.id = l.scope_version_id AND v.org_id = l.org_id
                JOIN work_items w ON w.id = l.work_item_id AND w.org_id = l.org_id
                WHERE v.org_id = ? AND v.project_id = ? AND v.status = 'ACTIVE' ORDER BY w.position, w.key
                """, (rs, n) -> new ScopeLeaf(rs.getString("work_item_id"), rs.getString("key"), rs.getString("title"),
                rs.getBigDecimal("weight"), rs.getBoolean("cancelled")), orgId, projectId);
    }

    /* ================================================================== draft */

    @Transactional
    public ScopeVersion createDraft(UUID orgId, String projectId, Authentication auth, DraftRequest request) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        UUID userId = permissions.principal(auth).userId();
        if (!"STRUCTURED".equals(project.mode())) throw new ApiException(HttpStatus.CONFLICT, "PROJECT_NOT_STRUCTURED", "Only Structured projects have a scope.");
        if (project.archived()) throw new ApiException(HttpStatus.CONFLICT, "PROJECT_ARCHIVED", "Archived projects are read-only.");
        if (!permissions.canOnProject(auth, orgId, project.id(), PermissionKey.PROJECT_SCOPE_CHANGE.value())) throw PermissionService.forbidden();
        String reason = request.reason() == null ? "" : request.reason().trim();
        if (reason.isEmpty() || reason.length() > 1000) throw WorkService.validation("reason", "Explain the scope change (up to 1000 characters).");
        if (request.expectedBaseVersion() == null) throw WorkService.validation("expected_base_version", "is required");
        work.lockProject(orgId, project.id());
        int active = activeVersionNo(orgId, project.id());
        if (request.expectedBaseVersion() != active) throw ApiException.staleVersion();

        List<Leaf> base = baseLeaves(orgId, project.id(), active);
        Map<String, WorkService.ItemRow> rows = work.rows(orgId, project.id());
        UUID draftId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO scope_versions (id, org_id, project_id, version_no, base_version_no, unit, status, reason, author_id)
                VALUES (?, ?, ?, ?, ?, 'POINTS', 'DRAFT', ?, ?)
                """, draftId, orgId, project.id(), active + 1, active, reason, userId);

        List<Change> plan = new ArrayList<>();
        List<Object[]> changeRows = new ArrayList<>();
        Map<String, BigDecimal> previous = new HashMap<>();
        base.forEach(leaf -> previous.put(leaf.id(), leaf.weight()));
        int position = 0;
        for (int i = 0; i < (request.changes() == null ? 0 : request.changes().size()); i++) {
            ScopeChangeRequest change = request.changes().get(i);
            String field = "changes[" + i + "]";
            Kind kind = kind(change.kind(), field);
            switch (kind) {
                case ADD -> {
                    WorkService.ItemRow parent = change.parentId() == null || change.parentId().isBlank() ? null : rows.get(change.parentId());
                    if (change.parentId() != null && !change.parentId().isBlank() && parent == null) {
                        throw WorkService.validation(field + ".parent_id", "The parent is not part of this project.");
                    }
                    if (parent != null && WorkBreakdown.measurable(parent.level())) {
                        throw WorkService.validation(field + ".parent_id", "Use a split to add work under a task.");
                    }
                    WorkBreakdown.placementError(Level.TASK, parent == null ? null : parent.level())
                            .ifPresent(message -> { throw WorkService.validation(field + ".parent_id", message); });
                    String title = text(change.title(), field + ".title");
                    BigDecimal points = points(change.points(), field + ".points");
                    String itemId = work.insertProposed(orgId, project, parent == null ? null : parent.id(), Level.TASK, title, points, userId, draftId);
                    plan.add(new Change(Kind.ADD, itemId, points, null));
                    changeRows.add(new Object[] {"ADD", itemId, null, null, points});
                }
                case REMOVE, CANCEL -> {
                    String target = target(change.workItemId(), field);
                    DependencyService.requireNoLinks(jdbc, orgId, target, null); // task 3.4: links need explicit treatment first
                    plan.add(new Change(kind, target, null, null));
                    changeRows.add(new Object[] {kind.name(), target, null, previous.get(target), previous.get(target)});
                }
                case REWEIGHT -> {
                    String target = target(change.workItemId(), field);
                    BigDecimal points = points(change.points(), field + ".points");
                    plan.add(new Change(Kind.REWEIGHT, target, points, null));
                    changeRows.add(new Object[] {"REWEIGHT", target, null, previous.get(target), points});
                }
                case SPLIT -> {
                    String target = target(change.workItemId(), field);
                    if (change.parts() == null || change.parts().size() < 2) throw WorkService.validation(field + ".parts", "Split into at least two parts.");
                    DependencyService.requireNoLinks(jdbc, orgId, target, null); // a split task becomes a parent: treat its links first
                    List<Leaf> parts = new ArrayList<>();
                    for (int p = 0; p < change.parts().size(); p++) {
                        ScopePart part = change.parts().get(p);
                        String title = text(part == null ? null : part.title(), field + ".parts[" + p + "].title");
                        BigDecimal points = points(part.points(), field + ".parts[" + p + "].points");
                        String itemId = work.insertProposed(orgId, project, target, Level.SUBTASK, title, points, userId, draftId);
                        parts.add(new Leaf(itemId, points, false));
                        changeRows.add(new Object[] {"SPLIT", itemId, target, null, points});
                    }
                    plan.add(new Change(Kind.SPLIT, target, null, parts));
                    changeRows.add(new Object[] {"SPLIT", target, null, previous.get(target), null});
                }
            }
        }
        List<Leaf> next;
        try {
            next = ScopePlan.apply(base, plan);
        } catch (IllegalArgumentException invalid) {
            throw WorkService.validation("changes", invalid.getMessage());
        }
        for (Leaf leaf : next) {
            jdbc.update("INSERT INTO scope_leaves (scope_version_id, org_id, work_item_id, weight, cancelled) VALUES (?, ?, ?, ?, ?)",
                    draftId, orgId, leaf.id(), leaf.weight(), leaf.cancelled());
        }
        for (Object[] row : changeRows) {
            jdbc.update("""
                    INSERT INTO scope_changes (id, org_id, scope_version_id, kind, work_item_id, source_work_item_id, previous_weight,
                        new_weight, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, UUID.randomUUID(), orgId, draftId, row[0], row[1], row[2], row[3], row[4], position++);
        }
        ScopeVersion draft = view(orgId, draftId);
        Map<String, Object> next2 = totals(base, next);
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, userId, "scope.draft_created", "SCOPE_VERSION", draftId, reason, null, next2),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(project.id()), project.version(), "ScopeChangeProposed", next2));
        return draft;
    }

    /* ================================================================== approval */

    @Transactional
    public ScopeVersion approve(UUID orgId, String projectId, UUID versionId, Authentication auth, Long expectedVersion) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        UUID userId = permissions.principal(auth).userId();
        if (!permissions.canOnProject(auth, orgId, project.id(), PermissionKey.PROJECT_SCOPE_CHANGE.value())) throw PermissionService.forbidden();
        if (project.archived()) throw new ApiException(HttpStatus.CONFLICT, "PROJECT_ARCHIVED", "Archived projects are read-only.");
        if (expectedVersion == null) throw WorkService.validation("expected_version", "is required");
        work.lockProject(orgId, project.id());
        List<Map<String, Object>> found = jdbc.queryForList(
                "SELECT status, base_version_no, version FROM scope_versions WHERE id = ? AND org_id = ? AND project_id = ?",
                versionId, orgId, project.id());
        if (found.isEmpty()) throw PermissionService.notFound();
        Map<String, Object> draft = found.get(0);
        if (!"DRAFT".equals(draft.get("status"))) throw new ApiException(HttpStatus.CONFLICT, "SCOPE_VERSION_DECIDED", "This scope version was already approved.");
        ExpectedVersion.check(((Number) draft.get("version")).longValue(), expectedVersion);
        int active = activeVersionNo(orgId, project.id());
        if (((Number) draft.get("base_version_no")).intValue() != active) {
            // Another scope change was approved after this draft was made: its base is outdated.
            throw ApiException.staleVersion();
        }
        List<Leaf> before = baseLeaves(orgId, project.id(), active);
        jdbc.update("UPDATE scope_versions SET status = 'SUPERSEDED', superseded_at = now() WHERE org_id = ? AND project_id = ? AND status = 'ACTIVE'",
                orgId, project.id());
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE scope_versions SET status = 'ACTIVE', version_no = ?, approver_id = ?, approved_at = now(), effective_at = now(),
                    version = version + 1
                WHERE id = ? AND org_id = ? AND status = 'DRAFT' AND version = ?
                """, active + 1, userId, versionId, orgId, expectedVersion));

        // Apply the approved changes to the work items.
        for (Map<String, Object> change : jdbc.queryForList(
                "SELECT kind, work_item_id, source_work_item_id, new_weight FROM scope_changes WHERE scope_version_id = ? AND org_id = ? ORDER BY position",
                versionId, orgId)) {
            String kind = (String) change.get("kind");
            String itemId = (String) change.get("work_item_id");
            // Task 3.4: a removed, cancelled or split task must have had its links treated (links may be added after the draft).
            if (List.of("REMOVE", "CANCEL").contains(kind) || ("SPLIT".equals(kind) && change.get("source_work_item_id") == null)) {
                DependencyService.requireNoLinks(jdbc, orgId, itemId, null);
            }
            switch (kind) {
                case "ADD" -> jdbc.update("UPDATE work_items SET proposed_scope_version_id = NULL, version = version + 1, updated_at = now() WHERE id = ? AND org_id = ?", itemId, orgId);
                case "REMOVE" -> jdbc.update("UPDATE work_items SET retired_at = now(), version = version + 1, updated_at = now() WHERE id = ? AND org_id = ?", itemId, orgId);
                case "CANCEL" -> jdbc.update("UPDATE work_items SET cancelled_at = now(), version = version + 1, updated_at = now() WHERE id = ? AND org_id = ?", itemId, orgId);
                case "REWEIGHT" -> jdbc.update("UPDATE work_items SET weight = ?, version = version + 1, updated_at = now() WHERE id = ? AND org_id = ?",
                        change.get("new_weight"), itemId, orgId);
                case "SPLIT" -> {
                    if (change.get("source_work_item_id") != null) {
                        jdbc.update("UPDATE work_items SET proposed_scope_version_id = NULL, version = version + 1, updated_at = now() WHERE id = ? AND org_id = ?", itemId, orgId);
                    } else {
                        // The split task becomes a parent: it never earns credit, so it carries no points.
                        jdbc.update("UPDATE work_items SET weight = 0, version = version + 1, updated_at = now() WHERE id = ? AND org_id = ?", itemId, orgId);
                    }
                }
                default -> throw new IllegalStateException(kind);
            }
        }
        ScopeVersion approved = view(orgId, versionId);
        List<Leaf> after = approved.leaves().stream().map(l -> new Leaf(l.workItemId(), l.points(), l.cancelled())).toList();
        Map<String, Object> payload = totals(before, after);
        payload.put("version_no", approved.versionNo());
        payload.put("previous_version_no", active);
        // Task 3.5: a new denominator is a material change; the old snapshots stay as they were.
        payload.put("progress_display", progress.snapshot(orgId, project.id(), "SCOPE_APPROVED", versionId.toString()).display());
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, userId, "scope.approved", "SCOPE_VERSION", versionId, approved.reason(),
                        Map.of("version_no", active, "total_points", ScopePlan.total(before)), payload),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(project.id()), project.version(), "ScopeChanged", payload));
        return approved;
    }

    /* ================================================================== helpers */

    private int activeVersionNo(UUID orgId, String projectId) {
        return jdbc.query("SELECT version_no FROM scope_versions WHERE org_id = ? AND project_id = ? AND status = 'ACTIVE'",
                (rs, n) -> rs.getInt(1), orgId, projectId).stream().findFirst().orElse(0);
    }

    private List<Leaf> baseLeaves(UUID orgId, String projectId, int activeVersionNo) {
        if (activeVersionNo == 0) return List.of();
        return jdbc.query("""
                SELECT l.work_item_id, l.weight, l.cancelled FROM scope_leaves l
                JOIN scope_versions v ON v.id = l.scope_version_id AND v.org_id = l.org_id
                WHERE v.org_id = ? AND v.project_id = ? AND v.status = 'ACTIVE'
                """, (rs, n) -> new Leaf(rs.getString("work_item_id"), rs.getBigDecimal("weight"), rs.getBoolean("cancelled")), orgId, projectId);
    }

    private ScopeVersion view(UUID orgId, UUID id) {
        Map<String, Object> v = jdbc.queryForMap("""
                SELECT v.*, a.email AS author_email, ap.email AS approver_email FROM scope_versions v
                JOIN users a ON a.id = v.author_id LEFT JOIN users ap ON ap.id = v.approver_id
                WHERE v.id = ? AND v.org_id = ?
                """, id, orgId);
        List<ScopeLeaf> leaves = jdbc.query("""
                SELECT l.work_item_id, w.key, w.title, l.weight, l.cancelled FROM scope_leaves l
                JOIN work_items w ON w.id = l.work_item_id AND w.org_id = l.org_id
                WHERE l.scope_version_id = ? AND l.org_id = ? ORDER BY w.position, w.key
                """, (rs, n) -> new ScopeLeaf(rs.getString("work_item_id"), rs.getString("key"), rs.getString("title"),
                rs.getBigDecimal("weight"), rs.getBoolean("cancelled")), id, orgId);
        List<ScopeChangeView> changeViews = jdbc.query("""
                SELECT c.kind, c.work_item_id, w.key, w.title, c.previous_weight, c.new_weight, c.source_work_item_id FROM scope_changes c
                JOIN work_items w ON w.id = c.work_item_id AND w.org_id = c.org_id
                WHERE c.scope_version_id = ? AND c.org_id = ? ORDER BY c.position
                """, (rs, n) -> new ScopeChangeView(rs.getString("kind"), rs.getString("work_item_id"), rs.getString("key"),
                rs.getString("title"), rs.getBigDecimal("previous_weight"), rs.getBigDecimal("new_weight"),
                rs.getString("source_work_item_id")), id, orgId);
        BigDecimal total = leaves.stream().map(ScopeLeaf::points).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new ScopeVersion(id, ((Number) v.get("version_no")).intValue(), ((Number) v.get("base_version_no")).intValue(),
                (String) v.get("unit"), (String) v.get("status"), (String) v.get("reason"), (String) v.get("author_email"),
                (String) v.get("approver_email"), instant(v.get("created_at")), instant(v.get("approved_at")),
                instant(v.get("superseded_at")), total, leaves, changeViews, ((Number) v.get("version")).longValue());
    }

    private static Instant instant(Object value) {
        return value instanceof Timestamp ts ? ts.toInstant() : null;
    }

    private static Map<String, Object> totals(List<Leaf> before, List<Leaf> after) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("previous_total_points", ScopePlan.total(before));
        s.put("total_points", ScopePlan.total(after));
        s.put("leaves", after.size());
        return s;
    }

    private static Kind kind(String value, String field) {
        try {
            return Kind.valueOf(value == null ? "" : value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw WorkService.validation(field + ".kind", "Choose ADD, REMOVE, CANCEL, SPLIT or REWEIGHT.");
        }
    }

    private static String target(String id, String field) {
        if (id == null || id.isBlank()) throw WorkService.validation(field + ".work_item_id", "Choose the task.");
        return id;
    }

    private static String text(String value, String field) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isEmpty() || trimmed.length() > 200) throw WorkService.validation(field, "Enter a title of up to 200 characters.");
        return trimmed;
    }

    private static BigDecimal points(BigDecimal value, String field) {
        if (!WorkBreakdown.validPoints(Level.TASK, value)) throw WorkService.validation(field, "Enter points greater than 0.");
        return value.setScale(2);
    }
}
