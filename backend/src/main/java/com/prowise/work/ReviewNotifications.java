package com.prowise.work;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * In-app notifications for review events, written in the same transaction as the event (existing
 * {@code developer_notifications} table, read by every panel's notification list). Links point into the recipient's
 * own panel, because panels are role-specific. Messages carry titles and keys only, never evidence or secrets.
 */
@Component
public class ReviewNotifications {

    private static final Map<String, String> REVIEW_PANEL = Map.of(
            "PROJECT_MANAGER", "manager/reviews",
            "TEAM_LEAD", "lead/reviews",
            "QA_REVIEWER", "reviewer/reviews",
            "DEVELOPER", "developer/approvals",
            "VIEWER", "viewer/approvals");

    private final JdbcTemplate jdbc;

    public ReviewNotifications(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** "Review requested" to every approver of the project except the submitter. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void reviewRequested(UUID orgId, List<UUID> approvers, UUID submitter, String reviewRef, String title, String message) {
        for (UUID approver : approvers) {
            if (approver.equals(submitter)) continue;
            String panel = REVIEW_PANEL.get(roleOf(orgId, approver));
            String link = panel == null ? null : "/org/" + orgId + "/" + panel + "/" + reviewRef;
            insert(orgId, approver, "REVIEW_REQUESTED", title, message, link);
        }
    }

    /** "Approved" or "Changes requested" to the person who submitted the work. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void decided(UUID orgId, UUID recipient, boolean approved, String title, String message, String link) {
        insert(orgId, recipient, approved ? "REVIEW_APPROVED" : "CHANGES_REQUESTED", title, message, link);
    }

    private String roleOf(UUID orgId, UUID userId) {
        return jdbc.query("SELECT role_template FROM memberships WHERE org_id = ? AND user_id = ? AND status = 'ACTIVE'",
                (rs, n) -> rs.getString(1), orgId, userId).stream().findFirst().orElse(null);
    }

    private void insert(UUID orgId, UUID userId, String category, String title, String message, String link) {
        jdbc.update("""
                INSERT INTO developer_notifications (id, user_id, category, title, message, target_url, read, org_id)
                VALUES (?, ?, ?, ?, ?, ?, FALSE, ?)
                """, "ntf-" + UUID.randomUUID(), userId.toString(), category, clip(title, 255), clip(message, 2000),
                link == null ? null : clip(link, 300), orgId);
    }

    private static String clip(String value, int max) {
        if (value == null) return "";
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }
}
