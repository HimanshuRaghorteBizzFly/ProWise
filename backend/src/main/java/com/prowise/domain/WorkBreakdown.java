package com.prowise.domain;

import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Work breakdown rules (task 3.1, domain rules "Hierarchy"). Pure Java, no Spring.
 *
 * <p>Project -> optional MILESTONE (a phase) -> optional DELIVERABLE -> TASK -> SUBTASK. At most five levels including
 * the project; parents stay inside the same project; no cycles. Only leaves (a TASK or SUBTASK without children)
 * carry points, an assignee and a reviewer; a parent never earns credit.
 */
public final class WorkBreakdown {

    public static final int MAX_LEVELS = 5; // including the project itself

    private WorkBreakdown() {}

    public enum Level { MILESTONE, DELIVERABLE, TASK, SUBTASK }

    /** Why a placement is rejected, or empty when it is allowed. */
    public static Optional<String> placementError(Level child, Level parent) {
        boolean ok = switch (child) {
            case MILESTONE -> parent == null;
            case DELIVERABLE -> parent == null || parent == Level.MILESTONE;
            case TASK -> parent == null || parent == Level.MILESTONE || parent == Level.DELIVERABLE;
            case SUBTASK -> parent == Level.TASK;
        };
        if (ok) return Optional.empty();
        String where = parent == null ? "directly under the project" : "under a " + label(parent);
        return Optional.of("A " + label(child) + " cannot be placed " + where + ".");
    }

    /** True when the level can carry points and an assignee (a TASK or SUBTASK). */
    public static boolean measurable(Level level) {
        return level == Level.TASK || level == Level.SUBTASK;
    }

    /**
     * Depth of an item counted from the project (project = 1, a direct child = 2), following {@code parentOf}.
     *
     * @throws IllegalStateException when the chain contains a cycle
     */
    public static int depth(String itemId, Map<String, String> parentOf) {
        Set<String> seen = new HashSet<>();
        int depth = 1;
        String current = itemId;
        while (current != null) {
            if (!seen.add(current)) throw new IllegalStateException("cycle");
            depth++;
            current = parentOf.get(current);
        }
        return depth;
    }

    /** True when moving {@code itemId} under {@code newParentId} would create a cycle. */
    public static boolean createsCycle(String itemId, String newParentId, Map<String, String> parentOf) {
        String current = newParentId;
        Set<String> seen = new HashSet<>();
        while (current != null) {
            if (current.equals(itemId) || !seen.add(current)) return true;
            current = parentOf.get(current);
        }
        return false;
    }

    /** Depth the item would have under {@code parentId} (project = 1). */
    public static int depthUnder(String parentId, Map<String, String> parentOf) {
        return parentId == null ? 2 : depth(parentId, parentOf) + 1;
    }

    public static boolean tooDeep(int depth) {
        return depth > MAX_LEVELS;
    }

    /** Points must be positive for a leaf; containers carry none. */
    public static boolean validPoints(Level level, java.math.BigDecimal points) {
        if (!measurable(level)) return points == null || points.signum() == 0;
        return points != null && points.signum() > 0 && points.scale() <= 2 && points.compareTo(java.math.BigDecimal.valueOf(100000)) < 0;
    }

    private static String label(Level level) {
        return switch (level) {
            case MILESTONE -> "phase";
            case DELIVERABLE -> "deliverable";
            case TASK -> "task";
            case SUBTASK -> "subtask";
        };
    }
}
