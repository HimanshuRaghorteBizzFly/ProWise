package db.migration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import com.prowise.identity.PublishedSeedCredentials;

/**
 * Approved decision D4 (Phase 2): disable seeded logins that still use a password published in this repository.
 *
 * <p>Data-safe by construction:
 * <ul>
 *   <li>Only rows whose stored BCrypt hash verifies against a published password are touched. A seeded address
 *       whose owner chose another password is left exactly as it is.</li>
 *   <li>Nothing is deleted and no password hash is changed. Users become {@code DISABLED}; platform operators
 *       become {@code SUSPENDED} with {@code password_setup_completed = false}, so the published password can
 *       never sign in again even if the status is later changed. Both statuses are already allowed values.</li>
 *   <li>Every open session of an affected account is revoked, and each change writes an audit row.</li>
 *   <li>Rows already disabled or suspended are skipped, so the migration is idempotent.</li>
 * </ul>
 * BCrypt cannot be evaluated in plain SQL here, which is why this is a Java migration. Run
 * {@code database/scripts/preview_v18_seed_credentials.sql} (read-only) to see the candidate rows first.
 */
public class V22__task_1_1_disable_published_seed_credentials extends BaseJavaMigration {

    static final String ACTOR = "system:migration-V22";

    @Override
    public void migrate(Context context) throws Exception {
        disablePublishedSeedCredentials(context.getConnection());
    }

    /** Result counts, exposed for tests. */
    public record Result(List<String> disabledUsers, List<String> suspendedOperators) {}

    public static Result disablePublishedSeedCredentials(Connection connection) throws SQLException {
        List<String> disabledUsers = new ArrayList<>();
        List<String> suspendedOperators = new ArrayList<>();

        // 1. users: only the seeded addresses, and only while their hash still verifies against a published password.
        List<Object[]> userCandidates = new ArrayList<>();
        try (PreparedStatement select = connection.prepareStatement(
                "SELECT id, lower(email), password_hash FROM users WHERE lower(email) = ANY (?) AND status <> 'DISABLED'")) {
            select.setArray(1, connection.createArrayOf("varchar",
                    PublishedSeedCredentials.USER_ACCOUNTS.keySet().toArray()));
            try (ResultSet rs = select.executeQuery()) {
                while (rs.next()) {
                    userCandidates.add(new Object[] {rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3)});
                }
            }
        }
        for (Object[] row : userCandidates) {
            UUID id = (UUID) row[0];
            String email = (String) row[1];
            if (!PublishedSeedCredentials.matchesPublishedPassword(email, (String) row[2])) {
                continue;
            }
            update(connection, "UPDATE users SET status = 'DISABLED', updated_at = now() WHERE id = ?", id);
            update(connection, "UPDATE sessions SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL", id);
            try (PreparedStatement audit = connection.prepareStatement("""
                    INSERT INTO auth_audit_logs (id, action, actor_id, actor_email, target_user_id, details, ip_address)
                    VALUES (?, 'SEED_CREDENTIAL_DISABLED', NULL, ?, ?, CAST(? AS jsonb), NULL)
                    """)) {
                audit.setObject(1, UUID.randomUUID());
                audit.setString(2, ACTOR);
                audit.setObject(3, id);
                audit.setString(4, "{\"reason\":\"published_seed_credential\",\"migration\":\"V22\"}");
                audit.executeUpdate();
            }
            disabledUsers.add(email);
        }

        // 2. platform_operators: V7 gave every operator row that had no password the published operator hash,
        //    so every row is checked (the table is small); only verified matches are suspended.
        List<String[]> operatorCandidates = new ArrayList<>();
        try (PreparedStatement select = connection.prepareStatement(
                "SELECT id, lower(email), password_hash FROM platform_operators WHERE status <> 'SUSPENDED' OR password_setup_completed")) {
            try (ResultSet rs = select.executeQuery()) {
                while (rs.next()) {
                    operatorCandidates.add(new String[] {rs.getString(1), rs.getString(2), rs.getString(3)});
                }
            }
        }
        for (String[] row : operatorCandidates) {
            String id = row[0];
            if (!PublishedSeedCredentials.matchesPublishedPassword(row[1], row[2])) {
                continue;
            }
            update(connection, "UPDATE platform_operators SET status = 'SUSPENDED', password_setup_completed = false, "
                    + "updated_at = now() WHERE id = ?", id);
            update(connection, "UPDATE operator_sessions SET revoked = true, revoked_at = now(), revoked_by = '" + ACTOR
                    + "' WHERE operator_id = ? AND revoked = false", id);
            try (PreparedStatement audit = connection.prepareStatement("""
                    INSERT INTO operator_audit_logs (id, operator_id, actor_name, action, module_key, details)
                    VALUES (?, ?, ?, 'SEED_CREDENTIAL_SUSPENDED', 'operators', ?)
                    """)) {
                audit.setObject(1, UUID.randomUUID());
                audit.setString(2, id);
                audit.setString(3, ACTOR);
                audit.setString(4, "Suspended: the account still used a password published in the repository (V22).");
                audit.executeUpdate();
            }
            suspendedOperators.add(id.toLowerCase(Locale.ROOT));
        }
        return new Result(List.copyOf(disabledUsers), List.copyOf(suspendedOperators));
    }

    private static void update(Connection connection, String sql, Object id) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setObject(1, id);
            statement.executeUpdate();
        }
    }
}
