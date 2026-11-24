package com.prowise.work;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.domain.AcceptedWork;
import com.prowise.domain.AcceptedWork.Leaf;
import com.prowise.domain.AcceptedWork.Measure;
import com.prowise.project.ProjectService;
import com.prowise.project.ProjectService.ProjectResponse;

/**
 * Task 3.5: progress of a Structured project = points of review-approved leaves / points of the active scope version.
 * Recalculated and snapshotted inside the transaction of every material change (scope approval, task approval,
 * reopening); old snapshots are never rewritten. Progress is never set from tasks counts, time or Git activity.
 */
@Service
public class StructuredProgressService {

    private final JdbcTemplate jdbc;
    private final ProjectService projects;

    public StructuredProgressService(JdbcTemplate jdbc, ProjectService projects) {
        this.jdbc = jdbc;
        this.projects = projects;
    }

    public record Snapshot(UUID id, Integer scopeVersionNo, BigDecimal numerator, BigDecimal denominator, BigDecimal percent,
            BigDecimal displayPercent, String method, String cause, Instant capturedAt) {}

    public record ProgressView(BigDecimal numerator, BigDecimal denominator, BigDecimal percent, BigDecimal displayPercent,
            String label, String method, Integer scopeVersionNo, List<Snapshot> snapshots) {}

    /** Current measure against the active scope version (no snapshot written). */
    public Measure measure(UUID orgId, String projectId) {
        List<Leaf> leaves = jdbc.query("""
                SELECT l.work_item_id, l.weight, l.cancelled,
                       (w.state = 'DONE' AND w.accepted_revision IS NOT NULL AND w.retired_at IS NULL) AS accepted
                FROM scope_leaves l
                JOIN scope_versions v ON v.id = l.scope_version_id AND v.org_id = l.org_id AND v.status = 'ACTIVE'
                JOIN work_items w ON w.id = l.work_item_id AND w.org_id = l.org_id
                WHERE v.org_id = ? AND v.project_id = ?
                """, (rs, n) -> new Leaf(rs.getString("work_item_id"), rs.getBigDecimal("weight"), rs.getBoolean("cancelled"),
                rs.getBoolean("accepted")), orgId, projectId);
        return AcceptedWork.measure(leaves);
    }

    /** Records a snapshot and refreshes the project's cached figure. Must run inside the caller's transaction. */
    @Transactional(propagation = Propagation.MANDATORY)
    public Measure snapshot(UUID orgId, String projectId, String cause, String causeRef) {
        Measure measure = measure(orgId, projectId);
        Map<String, Object> active = jdbc.query("""
                SELECT id, version_no FROM scope_versions WHERE org_id = ? AND project_id = ? AND status = 'ACTIVE'
                """, (rs, n) -> Map.<String, Object>of("id", rs.getObject("id", UUID.class), "no", rs.getInt("version_no")),
                orgId, projectId).stream().findFirst().orElse(null);
        jdbc.update("""
                INSERT INTO progress_snapshots (id, org_id, project_id, scope_version_id, scope_version_no, numerator, denominator,
                    percent, display_percent, method, cause, cause_ref)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), orgId, projectId, active == null ? null : active.get("id"), active == null ? null : active.get("no"),
                measure.numerator(), measure.denominator(), measure.percent(), measure.display(), AcceptedWork.METHOD, cause, causeRef);
        jdbc.update("""
                UPDATE projects SET last_progress_percent = ?, last_progress_method = ?, last_reported_at = now(), updated_at = now()
                WHERE id = ? AND org_id = ?
                """, measure.display(), AcceptedWork.METHOD, projectId, orgId);
        return measure;
    }

    @Transactional(readOnly = true)
    public ProgressView view(UUID orgId, String projectId, Authentication auth) {
        ProjectResponse project = projects.get(orgId, projectId, auth);
        Measure measure = measure(orgId, project.id());
        Integer versionNo = jdbc.query("SELECT version_no FROM scope_versions WHERE org_id = ? AND project_id = ? AND status = 'ACTIVE'",
                (rs, n) -> rs.getInt(1), orgId, project.id()).stream().findFirst().orElse(null);
        List<Snapshot> snapshots = jdbc.query("""
                SELECT id, scope_version_no, numerator, denominator, percent, display_percent, method, cause, captured_at
                FROM progress_snapshots WHERE org_id = ? AND project_id = ? ORDER BY captured_at, id
                """, (rs, n) -> new Snapshot(rs.getObject("id", UUID.class), (Integer) rs.getObject("scope_version_no"),
                rs.getBigDecimal("numerator"), rs.getBigDecimal("denominator"), rs.getBigDecimal("percent"),
                rs.getBigDecimal("display_percent"), rs.getString("method"), rs.getString("cause"),
                ((Timestamp) rs.getObject("captured_at")).toInstant()), orgId, project.id());
        return new ProgressView(measure.numerator(), measure.denominator(), measure.percent(), measure.display(), measure.label(),
                AcceptedWork.METHOD, versionNo, snapshots);
    }
}
