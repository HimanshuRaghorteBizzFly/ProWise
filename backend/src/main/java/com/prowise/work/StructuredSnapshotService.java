package com.prowise.work;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.domain.StructuredProgress;
import com.prowise.project.ProjectService;

/**
 * Task 3.5: Structured progress snapshots (FR-027, FR-029, docs/domain-rules.md "Snapshots").
 *
 * <p>Runs INSIDE the transaction of the change that caused it (scope approved, work accepted or reopened, which also
 * suspends dependent credit), so the figure and its cause commit together. A snapshot is written only on a material
 * change (numerator, denominator or baseline differ from the latest one). The project's displayed figure is refreshed
 * from the same calculation. Snapshots are append-only (database trigger).
 */
@Service
public class StructuredSnapshotService implements WorkItemStateListener {

    private final JdbcTemplate jdbc;
    private final AcceptedWork acceptedWork;
    private final WorkItemService workItems;

    public StructuredSnapshotService(JdbcTemplate jdbc, AcceptedWork acceptedWork, WorkItemService workItems) {
        this.jdbc = jdbc;
        this.acceptedWork = acceptedWork;
        this.workItems = workItems;
    }

    @Override
    public void creditChanged(UUID orgId, String workItemId, String cause, UUID actorId) {
        String projectId = jdbc.queryForObject("SELECT project_id FROM work_items WHERE id = ? AND org_id = ?", String.class,
                workItemId, orgId);
        record(orgId, projectId, cause, actorId);
    }

    /** Recalculates the project and appends a snapshot when something material changed. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(UUID orgId, String projectId, String cause, UUID actorId) {
        List<Map<String, Object>> project = jdbc.queryForList(
                "SELECT mode, active_baseline_id FROM projects WHERE id = ? AND org_id = ?", projectId, orgId);
        if (project.isEmpty() || !"STRUCTURED".equals(project.get(0).get("mode"))) return;
        UUID baseline = (UUID) project.get(0).get("active_baseline_id");
        StructuredProgress.Result result = acceptedWork.progress(baseline);

        List<Map<String, Object>> latest = jdbc.queryForList("""
                SELECT numerator, denominator, baseline_id FROM progress_snapshots
                WHERE org_id = ? AND project_id = ? AND method = 'STRUCTURED'
                ORDER BY taken_at DESC, id DESC LIMIT 1
                """, orgId, projectId);
        if (!latest.isEmpty()) {
            Map<String, Object> last = latest.get(0);
            boolean same = ((BigDecimal) last.get("numerator")).compareTo(result.numerator()) == 0
                    && ((BigDecimal) last.get("denominator")).compareTo(result.denominator()) == 0
                    && java.util.Objects.equals(last.get("baseline_id"), baseline);
            if (same) return; // not a material change
        }
        jdbc.update("""
                INSERT INTO progress_snapshots (id, org_id, project_id, method, numerator, denominator, value_exact,
                    display_value, missing_reason, baseline_id, accepted_leaves, total_leaves, cause, actor_id)
                VALUES (?, ?, ?, 'STRUCTURED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), orgId, projectId, result.numerator(), result.denominator(), result.exactPercent(),
                result.displayPercent(), result.measurable() ? null : "NOT_MEASURABLE", baseline, result.acceptedLeaves(),
                result.totalLeaves(), cause, actorId);
        // The project card shows the latest calculated figure (null = Not measurable).
        jdbc.update("UPDATE projects SET last_progress_percent = ?, last_reported_at = now() WHERE id = ? AND org_id = ?",
                result.displayPercent() == null ? null : BigDecimal.valueOf(result.displayPercent()), projectId, orgId);
    }

    /** Current figure with its explanation, the active baseline and the full snapshot history. */
    @Transactional(readOnly = true)
    public StructuredProgressView view(Authentication authentication, String projectId) {
        WorkItemService.Caller caller = workItems.caller(authentication);
        ProjectService.ProjectResponse project = workItems.readableProject(caller, projectId);
        UUID baseline = project.activeBaselineId();
        StructuredProgress.Result result = acceptedWork.progress(baseline);
        Baseline active = null;
        if (baseline != null) {
            active = jdbc.queryForObject("""
                    SELECT id, version_no, unit, approved_at FROM scope_versions WHERE id = ? AND org_id = ?
                    """, (rs, n) -> new Baseline(rs.getObject("id", UUID.class), rs.getInt("version_no"), rs.getString("unit"),
                            rs.getTimestamp("approved_at").toInstant()), baseline, caller.orgId());
        }
        String unit = active == null ? null : active.unit();
        String explanation = result.explanation(unit) + (active == null ? "" : ", baseline v" + active.versionNo());
        List<AcceptedWork.LeafRow> leaves = baseline == null ? List.of() : acceptedWork.leaves(baseline);
        List<Snapshot> snapshots = jdbc.query("""
                SELECT s.id, s.taken_at, s.method, s.numerator, s.denominator, s.display_value, s.missing_reason,
                       s.baseline_id, v.version_no, s.accepted_leaves, s.total_leaves, s.cause, s.transition_marker
                FROM progress_snapshots s LEFT JOIN scope_versions v ON v.id = s.baseline_id
                WHERE s.org_id = ? AND s.project_id = ?
                ORDER BY s.taken_at, s.id
                """, (rs, n) -> new Snapshot(rs.getObject("id", UUID.class), rs.getTimestamp("taken_at").toInstant(),
                        rs.getString("method"), rs.getBigDecimal("numerator"), rs.getBigDecimal("denominator"),
                        (Integer) rs.getObject("display_value"),
                        rs.getString("missing_reason") == null ? null : StructuredProgress.NOT_MEASURABLE,
                        rs.getObject("baseline_id", UUID.class), (Integer) rs.getObject("version_no"),
                        rs.getInt("accepted_leaves"), rs.getInt("total_leaves"), rs.getString("cause"),
                        rs.getBoolean("transition_marker")), caller.orgId(), project.id());
        return new StructuredProgressView(project.id(), project.mode(), StructuredProgress.METHOD, result.numerator(),
                result.denominator(), result.displayPercent(), result.label(), explanation, result.acceptedLeaves(),
                result.totalLeaves(), active, leaves, snapshots);
    }

    /* ================================================================== API records */

    public record Baseline(UUID id, int versionNo, String unit, Instant approvedAt) {}

    public record Snapshot(UUID id, Instant takenAt, String method, BigDecimal numerator, BigDecimal denominator,
            Integer percent, String missingLabel, UUID baselineId, Integer baselineVersion, int acceptedLeaves,
            int totalLeaves, String cause, boolean transitionMarker) {}

    public record StructuredProgressView(String projectId, String mode, String method, BigDecimal numerator,
            BigDecimal denominator, Integer percent, String label, String explanation, int acceptedLeaves, int totalLeaves,
            Baseline baseline, List<AcceptedWork.LeafRow> leaves, List<Snapshot> snapshots) {}
}
