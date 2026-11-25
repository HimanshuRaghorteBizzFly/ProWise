package com.prowise.work;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.authz.SecurityEvidenceService;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.domain.StructuredProgress;
import com.prowise.project.ProjectService;

/**
 * Task 3.2: approved scope and its versions (FR-025, D03).
 *
 * <ul>
 *   <li>A draft states its base (the baseline the author saw), one unit, a reason and the changes: ADD, REMOVE,
 *       CANCEL, REWEIGHT, SPLIT. The server applies them to the base and stores the full proposed set of leaves.</li>
 *   <li>Approval ({@code project.scope.change}) serializes on the project row: if the base is no longer the active
 *       baseline the approval is refused with 409 STALE_VERSION and nothing changes. Otherwise, in one transaction, the
 *       draft becomes the single ACTIVE baseline with the next version number, the old one is SUPERSEDED, work items
 *       take their approved weights and plan status, and the audit row, outbox event and progress snapshot (task 3.5) are written.</li>
 *   <li>Approved versions and their leaves are immutable (database triggers). Prior baselines stay readable.</li>
 *   <li>A cancelled leaf stays in the denominator (and earns nothing) until a later version removes it.</li>
 * </ul>
 */
@Service
public class ScopeService {

    private static final Set<String> UNITS = Set.of("EFFORT", "POINTS", "EQUAL");
    private static final BigDecimal MAX_WEIGHT = BigDecimal.valueOf(1_000_000);

    private final JdbcTemplate jdbc;
    private final WorkItemService workItems;
    private final ProjectService projects;
    private final PermissionService permissions;
    private final SecurityEvidenceService evidence;
    private final ChangeRecorder changes;
    private final ObjectMapper objectMapper;
    private final AcceptedWork acceptedWork;
    private final StructuredSnapshotService snapshots;

    public ScopeService(JdbcTemplate jdbc, WorkItemService workItems, ProjectService projects, PermissionService permissions,
            SecurityEvidenceService evidence, ChangeRecorder changes, ObjectMapper objectMapper, AcceptedWork acceptedWork,
            StructuredSnapshotService snapshots) {
        this.acceptedWork = acceptedWork;
        this.snapshots = snapshots;
        this.jdbc = jdbc;
        this.workItems = workItems;
        this.projects = projects;
        this.permissions = permissions;
        this.evidence = evidence;
        this.changes = changes;
        this.objectMapper = objectMapper;
    }

    /* ================================================================== reads */

    @Transactional(readOnly = true)
    public List<ScopeVersionSummary> list(Authentication authentication, String projectId) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        workItems.readableProject(caller, projectId);
        return jdbc.query("""
                SELECT v.id, v.version_no, v.unit, v.status, v.reason, v.created_at, v.approved_at, v.base_version_id,
                       au.email AS author_email, pu.email AS approver_email,
                       (SELECT count(*) FROM scope_leaves l WHERE l.scope_version_id = v.id) AS leaves,
                       (SELECT COALESCE(sum(l.weight), 0) FROM scope_leaves l WHERE l.scope_version_id = v.id) AS total
                FROM scope_versions v
                JOIN users au ON au.id = v.author_id
                LEFT JOIN users pu ON pu.id = v.approver_id
                WHERE v.org_id = ? AND v.project_id = ?
                ORDER BY v.created_at DESC, v.id
                """, (rs, n) -> new ScopeVersionSummary(rs.getObject("id", UUID.class), (Integer) rs.getObject("version_no"),
                        rs.getString("unit"), rs.getString("status"), rs.getString("reason"), rs.getString("author_email"),
                        rs.getString("approver_email"), rs.getInt("leaves"), rs.getBigDecimal("total"),
                        rs.getObject("base_version_id", UUID.class), instant(rs, "created_at"), instant(rs, "approved_at")),
                caller.orgId(), projectId);
    }

    @Transactional(readOnly = true)
    public ScopeVersionResponse get(Authentication authentication, UUID versionId) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        Version version = visible(caller, versionId);
        return response(caller.orgId(), version.id());
    }

    /* ================================================================== draft */

    @Transactional
    public ScopeVersionResponse draft(Authentication authentication, String projectId, DraftRequest request) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        ProjectService.ProjectResponse project = workItems.readableProject(caller, projectId);
        requireScopeChange(caller, project.id());
        if (project.archived()) throw WorkItemService.conflict("PROJECT_ARCHIVED", "Archived projects cannot be edited.");
        if (!"STRUCTURED".equals(project.mode())) {
            throw WorkItemService.conflict("PROJECT_NOT_STRUCTURED", "Only Structured projects have an approved scope.");
        }
        String unit = request.unit() == null ? null : request.unit().trim().toUpperCase(Locale.ROOT);
        if (unit == null || !UNITS.contains(unit)) throw WorkItemService.validation("unit", "must be EFFORT, POINTS or EQUAL");
        String reason = reason(request.reason());
        List<Change> requested = request.changes() == null ? List.of() : request.changes();
        if (requested.isEmpty()) throw WorkItemService.validation("changes", "list at least one change");
        if (requested.size() > 500) throw WorkItemService.validation("changes", "at most 500 changes");

        lockProject(caller.orgId(), project.id());
        Version base = activeVersion(caller.orgId(), project.id());
        if (!Objects.equals(base == null ? null : base.id(), request.baseVersionId())) {
            throw ApiException.staleVersion(); // the author did not see the current baseline
        }
        if (base != null && !base.unit().equals(unit)) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "UNIT_MISMATCH",
                    "A scope uses one unit. Keep " + base.unit() + " or restate the whole scope in a new plan.",
                    List.of(new ApiError.FieldError("unit", "differs from the current baseline unit " + base.unit())));
        }

        Map<String, LeafDraft> leaves = new LinkedHashMap<>();
        if (base != null) {
            for (AcceptedWork.LeafRow row : leafRows(base.id())) leaves.put(row.workItemId(), new LeafDraft(row.weight(), row.cancelled()));
        }
        Set<String> touched = new HashSet<>();
        List<Map<String, Object>> recorded = new ArrayList<>();
        for (Change change : requested) {
            String op = change.op() == null ? "" : change.op().trim().toUpperCase(Locale.ROOT);
            String itemId = change.workItemId();
            if (itemId == null || itemId.isBlank()) throw WorkItemService.validation("work_item_id", "is required");
            if (!touched.add(itemId)) throw invalidChange("Each work item can appear in one change only.");
            WorkItemService.Item item = itemInProject(caller, project.id(), itemId);
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("op", op);
            entry.put("work_item_id", itemId);
            entry.put("key", item.key());
            switch (op) {
                case "ADD" -> {
                    if (leaves.containsKey(itemId)) throw invalidChange(item.key() + " is already in the scope.");
                    requireReadyLeaf(item);
                    BigDecimal weight = weight(unit, change.weight());
                    leaves.put(itemId, new LeafDraft(weight, false));
                    entry.put("weight", weight);
                }
                case "REMOVE" -> {
                    DependencyService.requireNoSuccessorLinks(jdbc, itemId); // task 3.4: treat its links first
                    if (leaves.remove(itemId) == null) throw invalidChange(item.key() + " is not in the scope.");
                }
                case "CANCEL" -> {
                    LeafDraft leaf = leaves.get(itemId);
                    if (leaf == null || leaf.cancelled()) throw invalidChange(item.key() + " is not open work in the scope.");
                    if ("DONE".equals(item.state())) {
                        throw invalidChange(item.key() + " is accepted; reopen it before cancelling.");
                    }
                    leaves.put(itemId, new LeafDraft(leaf.weight(), true));
                }
                case "REWEIGHT" -> {
                    LeafDraft leaf = leaves.get(itemId);
                    if (leaf == null) throw invalidChange(item.key() + " is not in the scope.");
                    BigDecimal weight = weight(unit, change.weight());
                    leaves.put(itemId, new LeafDraft(weight, leaf.cancelled()));
                    entry.put("from", leaf.weight());
                    entry.put("weight", weight);
                }
                case "SPLIT" -> {
                    LeafDraft leaf = leaves.get(itemId);
                    if (leaf == null || leaf.cancelled()) throw invalidChange(item.key() + " is not open work in the scope.");
                    List<SplitPart> parts = change.into() == null ? List.of() : change.into();
                    if (parts.size() < 2 || parts.size() > 20) throw WorkItemService.validation("into", "split into 2 to 20 parts");
                    leaves.remove(itemId);
                    List<Map<String, Object>> created = new ArrayList<>();
                    for (SplitPart part : parts) {
                        BigDecimal weight = weight(unit, part.weight());
                        String partId = workItems.createProposedPart(caller, project, item, part.title());
                        leaves.put(partId, new LeafDraft(weight, false));
                        touched.add(partId);
                        created.add(Map.of("work_item_id", partId, "weight", weight));
                    }
                    entry.put("into", created);
                }
                default -> throw WorkItemService.validation("op", "must be ADD, REMOVE, CANCEL, REWEIGHT or SPLIT");
            }
            recorded.add(entry);
        }
        requireNoNestedLeaves(caller.orgId(), leaves.keySet());
        if ("POINTS".equals(unit)) {
            requireWithinPointLimit(leaves.values().stream().map(LeafDraft::weight).reduce(BigDecimal.ZERO, BigDecimal::add));
        }

        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO scope_versions (id, org_id, project_id, unit, status, base_version_id, reason, changes, author_id)
                VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?::jsonb, ?)
                """, id, caller.orgId(), project.id(), unit, base == null ? null : base.id(), reason, json(recorded),
                caller.userId());
        for (Map.Entry<String, LeafDraft> leaf : leaves.entrySet()) {
            jdbc.update("INSERT INTO scope_leaves (scope_version_id, org_id, work_item_id, weight, cancelled) VALUES (?, ?, ?, ?, ?)",
                    id, caller.orgId(), leaf.getKey(), leaf.getValue().weight(), leaf.getValue().cancelled());
        }
        changes.record(
                new ChangeRecorder.AuditEntry(caller.orgId(), caller.userId(), "scope.drafted", "SCOPE_VERSION", id, reason,
                        null, Map.of("project_id", project.id(), "unit", unit, "changes", recorded.size())),
                new ChangeRecorder.DomainEvent(caller.orgId(), "SCOPE_VERSION", id, 0L, "ScopeChangeProposed",
                        Map.of("project_id", project.id(), "base_version_id", String.valueOf(base == null ? null : base.id()))));
        return response(caller.orgId(), id);
    }

    /* ================================================================== approve */

    @Transactional
    public ScopeVersionResponse approve(Authentication authentication, UUID versionId, DecisionRequest request) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        Version draft = visible(caller, versionId);
        requireScopeChange(caller, draft.projectId());
        long expected = expected(request.expectedVersion());

        lockProject(caller.orgId(), draft.projectId());
        draft = find(caller.orgId(), versionId); // re-read under the project lock
        ProjectService.ProjectResponse project = projects.get(caller.orgId(), draft.projectId(), caller.authentication());
        if (project.archived()) throw WorkItemService.conflict("PROJECT_ARCHIVED", "Archived projects cannot be edited.");
        Version base = activeVersion(caller.orgId(), draft.projectId());
        if (!"DRAFT".equals(draft.status()) || draft.version() != expected
                || !Objects.equals(base == null ? null : base.id(), draft.baseVersionId())) {
            throw ApiException.staleVersion(); // discarded, already decided, or the baseline moved on
        }

        // Work may have changed since the draft: added leaves must still be ready, unretired leaves of this project.
        List<AcceptedWork.LeafRow> proposed = leafRows(draft.id());
        Set<String> baseIds = new HashSet<>();
        if (base != null) for (AcceptedWork.LeafRow row : leafRows(base.id())) baseIds.add(row.workItemId());
        for (AcceptedWork.LeafRow leaf : proposed) {
            WorkItemService.Item item = workItems.find(caller.orgId(), leaf.workItemId());
            if (item == null || !item.projectId().equals(draft.projectId()) || "RETIRED".equals(item.planStatus())) {
                throw invalidChange("Work in this proposal was retired or moved. Create a new proposal.");
            }
            if (!baseIds.contains(leaf.workItemId())) requireReadyLeaf(item);
        }
        requireNoNestedLeaves(caller.orgId(), proposed.stream().map(AcceptedWork.LeafRow::workItemId).toList());

        StructuredProgress.Result before = base == null ? StructuredProgress.calculate(List.of()) : progress(base.id());
        if (base != null) {
            jdbc.update("UPDATE scope_versions SET status = 'SUPERSEDED' WHERE id = ? AND status = 'ACTIVE'", base.id());
        }
        Integer next = jdbc.queryForObject(
                "SELECT COALESCE(max(version_no), 0) + 1 FROM scope_versions WHERE project_id = ?", Integer.class, draft.projectId());
        Timestamp effective = Timestamp.from(request.effectiveAt() == null ? Instant.now() : request.effectiveAt());
        int updated = jdbc.update("""
                UPDATE scope_versions SET status = 'ACTIVE', version_no = ?, approver_id = ?, approved_at = now(),
                    effective_at = ?, version = version + 1
                WHERE id = ? AND status = 'DRAFT' AND version = ?
                """, next, caller.userId(), effective, draft.id(), expected);
        ExpectedVersion.requireUpdated(updated);
        jdbc.update("UPDATE projects SET active_baseline_id = ?, updated_at = now() WHERE id = ? AND org_id = ?",
                draft.id(), draft.projectId(), caller.orgId());

        applyToWorkItems(caller, draft, proposed, baseIds);
        StructuredProgress.Result after = progress(draft.id());
        snapshots.record(caller.orgId(), draft.projectId(), "SCOPE_APPROVED", caller.userId());

        Map<String, Object> previous = new LinkedHashMap<>();
        previous.put("baseline_id", base == null ? null : base.id().toString());
        previous.put("version_no", base == null ? null : base.versionNo());
        previous.put("numerator", before.numerator());
        previous.put("denominator", before.denominator());
        Map<String, Object> current = new LinkedHashMap<>();
        current.put("baseline_id", draft.id().toString());
        current.put("version_no", next);
        current.put("unit", draft.unit());
        current.put("numerator", after.numerator());
        current.put("denominator", after.denominator());
        current.put("author_id", draft.authorId().toString());
        changes.record(
                new ChangeRecorder.AuditEntry(caller.orgId(), caller.userId(), "scope.approved", "SCOPE_VERSION", draft.id(),
                        draft.reason(), previous, current),
                new ChangeRecorder.DomainEvent(caller.orgId(), "SCOPE_VERSION", draft.id(), next, "ScopeChanged",
                        withProject(current, draft.projectId())));
        return response(caller.orgId(), draft.id());
    }

    /** Leaves take their approved weights; removed leaves retire; cancelled leaves are Cancelled; ancestors join the plan. */
    private void applyToWorkItems(WorkItemService.Caller caller, Version draft, List<AcceptedWork.LeafRow> proposed, Set<String> baseIds) {
        Set<String> proposedIds = new HashSet<>();
        for (AcceptedWork.LeafRow leaf : proposed) {
            proposedIds.add(leaf.workItemId());
            jdbc.update("""
                    UPDATE work_items SET plan_status = 'ACTIVE', weight = ?, weight_unit = ?,
                        state = CASE WHEN ? THEN 'CANCELLED' ELSE state END,
                        version = version + 1, updated_at = now()
                    WHERE id = ? AND org_id = ?
                    """, leaf.weight(), draft.unit(), leaf.cancelled(), leaf.workItemId(), caller.orgId());
            jdbc.update("""
                    WITH RECURSIVE up(id, parent_id, n) AS (
                        SELECT id, parent_id, 0 FROM work_items WHERE id = ?
                        UNION ALL
                        SELECT w.id, w.parent_id, u.n + 1 FROM work_items w JOIN up u ON w.id = u.parent_id WHERE u.n < 50)
                    UPDATE work_items SET plan_status = 'ACTIVE', weight = NULL, version = version + 1, updated_at = now()
                    WHERE id IN (SELECT id FROM up WHERE n > 0) AND org_id = ? AND plan_status <> 'RETIRED'
                      AND (plan_status <> 'ACTIVE' OR weight IS NOT NULL)
                    """, leaf.workItemId(), caller.orgId());
        }
        for (String removed : baseIds) {
            if (proposedIds.contains(removed)) continue;
            boolean split = activeChildren(removed) > 0;
            if (split) continue; // a split leaf is now a parent: it stays in the plan without weight (handled above)
            jdbc.update("""
                    UPDATE work_items SET plan_status = 'RETIRED', retired_at = now(), retired_reason = ?,
                        version = version + 1, updated_at = now()
                    WHERE id = ? AND org_id = ?
                    """, "Removed by scope version: " + draft.reason(), removed, caller.orgId());
        }
    }

    /* ================================================================== discard */

    @Transactional
    public ScopeVersionResponse discard(Authentication authentication, UUID versionId, DecisionRequest request) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        Version draft = visible(caller, versionId);
        requireScopeChange(caller, draft.projectId());
        long expected = expected(request.expectedVersion());
        if (!"DRAFT".equals(draft.status())) throw ApiException.staleVersion();
        int updated = jdbc.update("""
                UPDATE scope_versions SET status = 'DISCARDED', version = version + 1
                WHERE id = ? AND status = 'DRAFT' AND version = ?
                """, draft.id(), expected);
        ExpectedVersion.requireUpdated(updated);
        // Parts proposed by a split in this draft never joined the plan: retire them with the draft.
        JsonNode recorded = draft.changes();
        for (JsonNode change : recorded) {
            if (!"SPLIT".equals(change.path("op").asText())) continue;
            for (JsonNode part : change.path("into")) {
                jdbc.update("""
                        UPDATE work_items SET plan_status = 'RETIRED', retired_at = now(), retired_reason = 'Split proposal discarded',
                            version = version + 1, updated_at = now()
                        WHERE id = ? AND org_id = ? AND plan_status = 'DRAFT'
                        """, part.path("work_item_id").asText(), caller.orgId());
            }
        }
        changes.record(
                new ChangeRecorder.AuditEntry(caller.orgId(), caller.userId(), "scope.discarded", "SCOPE_VERSION", draft.id(),
                        null, Map.of("status", "DRAFT"), Map.of("status", "DISCARDED")),
                new ChangeRecorder.DomainEvent(caller.orgId(), "SCOPE_VERSION", draft.id(), expected + 1,
                        "ScopeChangeDiscarded", Map.of("project_id", draft.projectId())));
        return response(caller.orgId(), draft.id());
    }

    /* ================================================================== progress helpers (shared with 3.5) */

    /** Progress of one scope version (shared calculation, task 3.5). */
    StructuredProgress.Result progress(UUID versionId) {
        return acceptedWork.progress(versionId);
    }

    List<AcceptedWork.LeafRow> leafRows(UUID versionId) {
        return acceptedWork.leaves(versionId);
    }

    Version activeVersion(UUID orgId, String projectId) {
        List<UUID> ids = jdbc.queryForList(
                "SELECT id FROM scope_versions WHERE org_id = ? AND project_id = ? AND status = 'ACTIVE'", UUID.class,
                orgId, projectId);
        return ids.isEmpty() ? null : find(orgId, ids.get(0));
    }

    /* ================================================================== validation */

    private void requireReadyLeaf(WorkItemService.Item item) {
        List<String> missing = new ArrayList<>();
        if (!"DRAFT".equals(item.planStatus())) missing.add("is not draft work");
        if (activeChildren(item.id()) > 0) missing.add("has sub-items (only leaves are measured)");
        if (item.primaryAssigneeId() == null) missing.add("has no primary assignee");
        if (item.criteria() == null || item.criteria().isBlank()) missing.add("has no acceptance criteria");
        if ("CANCELLED".equals(item.state())) missing.add("is cancelled");
        if (!missing.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "LEAF_NOT_READY",
                    item.key() + " cannot be measured yet: it " + String.join(", ", missing) + ".",
                    List.of(new ApiError.FieldError("work_item_id", String.join("; ", missing))));
        }
    }

    /** No leaf may be an ancestor of another leaf: a parent and its child would be counted twice. */
    private void requireNoNestedLeaves(UUID orgId, java.util.Collection<String> leafIds) {
        if (leafIds.isEmpty()) return;
        Set<String> ids = new HashSet<>(leafIds);
        for (String leafId : leafIds) {
            List<String> ancestors = jdbc.queryForList("""
                    WITH RECURSIVE up(id, parent_id, n) AS (
                        SELECT id, parent_id, 0 FROM work_items WHERE id = ? AND org_id = ?
                        UNION ALL
                        SELECT w.id, w.parent_id, u.n + 1 FROM work_items w JOIN up u ON w.id = u.parent_id WHERE u.n < 50)
                    SELECT id FROM up WHERE n > 0
                    """, String.class, leafId, orgId);
            for (String ancestor : ancestors) {
                if (ids.contains(ancestor)) {
                    throw invalidChange("A parent and its own sub-item cannot both be measured leaves.");
                }
            }
        }
    }

    /** Owner rule (2026-11-25): a project's task points total at most 100 (they may total less). */
    static final BigDecimal MAX_PROJECT_POINTS = BigDecimal.valueOf(100);

    static void requireWithinPointLimit(BigDecimal total) {
        if (total.compareTo(MAX_PROJECT_POINTS) > 0) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "POINTS_OVER_LIMIT",
                    "Task points total " + total.stripTrailingZeros().toPlainString() + ". The total may not be above 100.",
                    List.of(new ApiError.FieldError("points", "total is above 100")));
        }
    }

    private static BigDecimal weight(String unit, BigDecimal value) {
        if ("EQUAL".equals(unit)) {
            if (value != null && value.compareTo(BigDecimal.ONE) != 0) {
                throw WorkItemService.validation("weight", "is always 1 with equal weighting");
            }
            return BigDecimal.ONE;
        }
        if (value == null || value.signum() <= 0) throw WorkItemService.validation("weight", "must be greater than zero");
        if (value.compareTo(MAX_WEIGHT) > 0) throw WorkItemService.validation("weight", "must be at most 1,000,000");
        if (value.stripTrailingZeros().scale() > 2) throw WorkItemService.validation("weight", "has at most 2 decimals");
        return value;
    }

    private static String reason(String value) {
        String reason = value == null ? "" : value.trim();
        if (reason.isEmpty() || reason.length() > 1000) throw WorkItemService.validation("reason", "is required (up to 1000 characters)");
        return reason;
    }

    private static long expected(Long value) {
        if (value == null) throw WorkItemService.validation("expected_version", "is required");
        return value;
    }

    private static ApiException invalidChange(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_SCOPE_CHANGE", message);
    }

    /* ================================================================== access */

    private void requireScopeChange(WorkItemService.Caller caller, String projectId) {
        if (!workItems.can(caller, projectId, PermissionKey.PROJECT_SCOPE_CHANGE)) throw PermissionService.forbidden();
    }

    private WorkItemService.Item itemInProject(WorkItemService.Caller caller, String projectId, String itemId) {
        WorkItemService.Item item = workItems.find(caller.orgId(), itemId);
        if (item == null || !item.projectId().equals(projectId) || "RETIRED".equals(item.planStatus())) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_SCOPE_CHANGE",
                    "The changes must refer to active work in this project.",
                    List.of(new ApiError.FieldError("work_item_id", "is not active work in this project")));
        }
        return item;
    }

    private Version visible(WorkItemService.Caller caller, UUID versionId) {
        Version version = versionId == null ? null : find(caller.orgId(), versionId);
        if (version == null) {
            evidence.recordDenied(caller.principal(), SecurityEvidenceService.ACCESS_DENIED, "SCOPE_VERSION",
                    versionId == null ? null : versionId.toString(), "Foreign, unknown or unreadable scope version");
            throw PermissionService.notFound();
        }
        workItems.readableProject(caller, version.projectId());
        return version;
    }

    private void lockProject(UUID orgId, String projectId) {
        jdbc.queryForList("SELECT id FROM projects WHERE id = ? AND org_id = ? FOR UPDATE", projectId, orgId);
    }

    private int activeChildren(String itemId) {
        Integer count = jdbc.queryForObject(
                "SELECT count(*) FROM work_items WHERE parent_id = ? AND plan_status <> 'RETIRED'", Integer.class, itemId);
        return count == null ? 0 : count;
    }

    /* ================================================================== mapping */

    record Version(UUID id, String projectId, Integer versionNo, String unit, String status, UUID baseVersionId,
            String reason, JsonNode changes, UUID authorId, long version) {}

    private record LeafDraft(BigDecimal weight, boolean cancelled) {}

    private Version find(UUID orgId, UUID id) {
        List<Version> rows = jdbc.query("""
                SELECT id, project_id, version_no, unit, status, base_version_id, reason, changes::text AS changes,
                       author_id, version
                FROM scope_versions WHERE id = ? AND org_id = ?
                """, (rs, n) -> new Version(rs.getObject("id", UUID.class), rs.getString("project_id"),
                        (Integer) rs.getObject("version_no"), rs.getString("unit"), rs.getString("status"),
                        rs.getObject("base_version_id", UUID.class), rs.getString("reason"), tree(rs.getString("changes")),
                        rs.getObject("author_id", UUID.class), rs.getLong("version")), id, orgId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private ScopeVersionResponse response(UUID orgId, UUID id) {
        Map<String, Object> row = jdbc.queryForMap("""
                SELECT v.id, v.project_id, v.version_no, v.unit, v.status, v.base_version_id, v.reason, v.changes::text AS changes,
                       v.author_id, au.email AS author_email, v.approver_id, pu.email AS approver_email,
                       v.created_at, v.approved_at, v.effective_at, v.version
                FROM scope_versions v JOIN users au ON au.id = v.author_id LEFT JOIN users pu ON pu.id = v.approver_id
                WHERE v.id = ? AND v.org_id = ?
                """, id, orgId);
        UUID baseId = (UUID) row.get("base_version_id");
        List<AcceptedWork.LeafRow> leaves = leafRows(id);
        List<AcceptedWork.LeafRow> baseLeaves = baseId == null ? List.of() : leafRows(baseId);

        Map<String, AcceptedWork.LeafRow> baseById = new LinkedHashMap<>();
        for (AcceptedWork.LeafRow leaf : baseLeaves) baseById.put(leaf.workItemId(), leaf);
        Map<String, AcceptedWork.LeafRow> nowById = new LinkedHashMap<>();
        for (AcceptedWork.LeafRow leaf : leaves) nowById.put(leaf.workItemId(), leaf);
        List<DiffEntry> added = new ArrayList<>();
        List<DiffEntry> removed = new ArrayList<>();
        List<DiffEntry> reweighted = new ArrayList<>();
        List<DiffEntry> cancelled = new ArrayList<>();
        for (AcceptedWork.LeafRow leaf : leaves) {
            AcceptedWork.LeafRow old = baseById.get(leaf.workItemId());
            if (old == null) {
                added.add(new DiffEntry(leaf.workItemId(), leaf.key(), leaf.title(), null, leaf.weight()));
            } else {
                if (old.weight().compareTo(leaf.weight()) != 0) {
                    reweighted.add(new DiffEntry(leaf.workItemId(), leaf.key(), leaf.title(), old.weight(), leaf.weight()));
                }
                if (!old.cancelled() && leaf.cancelled()) {
                    cancelled.add(new DiffEntry(leaf.workItemId(), leaf.key(), leaf.title(), old.weight(), leaf.weight()));
                }
            }
        }
        for (AcceptedWork.LeafRow old : baseLeaves) {
            if (!nowById.containsKey(old.workItemId())) {
                removed.add(new DiffEntry(old.workItemId(), old.key(), old.title(), old.weight(), null));
            }
        }

        StructuredProgress.Result before = baseId == null ? StructuredProgress.calculate(List.of()) : progress(baseId);
        StructuredProgress.Result after = progress(id);
        String unit = (String) row.get("unit");
        Effect effect = new Effect(figure(before, unit), figure(after, unit), summary(before) + " becomes " + summary(after));

        List<ScopeLeaf> leafViews = leaves.stream()
                .map(l -> new ScopeLeaf(l.workItemId(), l.key(), l.title(), l.weight(), l.cancelled(), l.state(), l.accepted()))
                .toList();
        return new ScopeVersionResponse((UUID) row.get("id"), (String) row.get("project_id"),
                (Integer) row.get("version_no"), unit, (String) row.get("status"), baseId, (String) row.get("reason"),
                tree((String) row.get("changes")),
                new Person(((UUID) row.get("author_id")).toString(), (String) row.get("author_email")),
                row.get("approver_id") == null ? null
                        : new Person(((UUID) row.get("approver_id")).toString(), (String) row.get("approver_email")),
                leafViews, new Diff(added, removed, reweighted, cancelled), effect,
                instant(row.get("created_at")), instant(row.get("approved_at")), instant(row.get("effective_at")),
                ((Number) row.get("version")).longValue());
    }

    private static Figure figure(StructuredProgress.Result result, String unit) {
        return new Figure(result.numerator(), result.denominator(), result.displayPercent(), result.label(),
                result.explanation(unit));
    }

    private static String summary(StructuredProgress.Result result) {
        if (!result.measurable()) return StructuredProgress.NOT_MEASURABLE;
        return plain(result.numerator()) + "/" + plain(result.denominator()) + " = " + result.displayPercent() + "%";
    }

    private static String plain(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private JsonNode tree(String value) {
        try {
            return objectMapper.readTree(value == null ? "[]" : value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static Map<String, Object> withProject(Map<String, ?> data, String projectId) {
        Map<String, Object> payload = new LinkedHashMap<>(data);
        payload.put("project_id", projectId);
        return payload;
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private static Instant instant(Object value) {
        if (value instanceof Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof java.time.OffsetDateTime offset) return offset.toInstant();
        return null;
    }

    /* ================================================================== API records */

    public record SplitPart(String title, BigDecimal weight) {}

    public record Change(String op, String workItemId, BigDecimal weight, List<SplitPart> into) {}

    public record DraftRequest(String unit, String reason, UUID baseVersionId, List<Change> changes) {}

    public record DecisionRequest(Long expectedVersion, Instant effectiveAt) {}

    public record Person(String userId, String email) {}

    public record ScopeLeaf(String workItemId, String key, String title, BigDecimal weight, boolean cancelled, String state,
            boolean accepted) {}

    public record DiffEntry(String workItemId, String key, String title, BigDecimal from, BigDecimal to) {}

    public record Diff(List<DiffEntry> added, List<DiffEntry> removed, List<DiffEntry> reweighted, List<DiffEntry> cancelled) {}

    public record Figure(BigDecimal numerator, BigDecimal denominator, Integer percent, String label, String explanation) {}

    public record Effect(Figure before, Figure after, String summary) {}

    public record ScopeVersionResponse(UUID id, String projectId, Integer versionNo, String unit, String status,
            UUID baseVersionId, String reason, JsonNode changes, Person author, Person approver, List<ScopeLeaf> leaves,
            Diff diff, Effect effect, Instant createdAt, Instant approvedAt, Instant effectiveAt, long version) {}

    public record ScopeVersionSummary(UUID id, Integer versionNo, String unit, String status, String reason,
            String authorEmail, String approverEmail, int leafCount, BigDecimal total, UUID baseVersionId,
            Instant createdAt, Instant approvedAt) {}
}
