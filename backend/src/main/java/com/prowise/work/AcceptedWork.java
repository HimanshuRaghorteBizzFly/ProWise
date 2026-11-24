package com.prowise.work;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import com.prowise.domain.StructuredProgress;

/**
 * Reads the leaves of a scope version and decides which are accepted, then hands them to the pure
 * {@link StructuredProgress} calculation (tasks 3.2 and 3.5). One place, so the scope preview, the snapshots and the
 * screens always agree.
 *
 * <p>A leaf is accepted when it is Done (reachable only through the review rules of task 3.3, left again on reopen),
 * not cancelled, and every prerequisite in its dependency chain is Done too: a reopened prerequisite suspends the
 * credit of the work that depends on it (task 3.4 credit rule) without changing that work's state. Git activity,
 * elapsed time and task counts are never read (rule 9).
 */
@Component
public class AcceptedWork {

    private final JdbcTemplate jdbc;

    public AcceptedWork(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<LeafRow> leaves(UUID scopeVersionId) {
        return jdbc.query("""
                SELECT l.work_item_id, l.weight, l.cancelled, w.key, w.title, w.state,
                       EXISTS (
                           WITH RECURSIVE up(id, n) AS (
                               SELECT predecessor_id, 1 FROM work_item_dependencies WHERE successor_id = w.id
                               UNION
                               SELECT d.predecessor_id, up.n + 1 FROM work_item_dependencies d JOIN up ON d.successor_id = up.id
                               WHERE up.n < 500)
                           SELECT 1 FROM up JOIN work_items p ON p.id = up.id WHERE p.state <> 'DONE') AS suspended
                FROM scope_leaves l JOIN work_items w ON w.id = l.work_item_id
                WHERE l.scope_version_id = ?
                ORDER BY w.key
                """, (rs, n) -> {
                    boolean cancelled = rs.getBoolean("cancelled");
                    boolean done = "DONE".equals(rs.getString("state"));
                    boolean suspended = done && rs.getBoolean("suspended");
                    return new LeafRow(rs.getString("work_item_id"), rs.getString("key"), rs.getString("title"),
                            rs.getBigDecimal("weight"), cancelled, rs.getString("state"), done && !cancelled && !suspended,
                            suspended);
                }, scopeVersionId);
    }

    public StructuredProgress.Result progress(UUID scopeVersionId) {
        if (scopeVersionId == null) return StructuredProgress.calculate(List.of());
        List<StructuredProgress.Leaf> leaves = new ArrayList<>();
        for (LeafRow row : leaves(scopeVersionId)) {
            leaves.add(new StructuredProgress.Leaf(row.workItemId(), row.weight(), row.accepted(), row.cancelled()));
        }
        return StructuredProgress.calculate(leaves);
    }

    /** A baseline leaf joined with its work item; {@code suspended} = Done but a prerequisite is not accepted. */
    public record LeafRow(String workItemId, String key, String title, BigDecimal weight, boolean cancelled, String state,
            boolean accepted, boolean suspended) {}
}
