package com.prowise.common.db;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Applies every migration in database/migrations to a brand-new, empty schema on the real
 * PostgreSQL (docker compose locally, the service container in CI). Requires DB_URL,
 * DB_USERNAME and DB_PASSWORD (environment or backend/.env).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE, properties = "spring.flyway.enabled=false")
@Tag("integration")
@Tag("NFR-11")
class FlywayMigrationIntegrationTest {

    @Autowired
    private DataSource dataSource;

    @Test
    void migrationsApplyToAnEmptySchemaAndCreateTenantIndexes() {
        String schema = "it_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        try {
            Flyway flyway = Flyway.configure()
                    .dataSource(dataSource)
                    .schemas(schema)
                    .createSchemas(true)
                    .locations("classpath:db/migration")
                    .load();

            MigrateResult result = flyway.migrate();

            assertThat(result.success).isTrue();
            assertThat(result.migrationsExecuted).isGreaterThanOrEqualTo(1);
            assertThat(result.targetSchemaVersion).isNotNull();

            List<String> tables = jdbc.queryForList(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = ?", String.class, schema);
            assertThat(tables).contains("audit_log", "outbox_event", "shedlock", "flyway_schema_history");

            List<String> orgIdNullability = jdbc.queryForList(
                    "SELECT is_nullable FROM information_schema.columns WHERE table_schema = ? "
                            + "AND table_name IN ('audit_log','outbox_event') AND column_name = 'org_id'",
                    String.class, schema);
            assertThat(orgIdNullability).containsExactly("NO", "NO");

            List<String> indexes = jdbc.queryForList(
                    "SELECT indexname FROM pg_indexes WHERE schemaname = ?", String.class, schema);
            assertThat(indexes).contains("idx_audit_log_org_id", "idx_outbox_event_org_id");

            assertThat(flyway.migrate().migrationsExecuted).as("re-running is a no-op").isZero();
            assertThat(flyway.validateWithResult().validationSuccessful).isTrue();
        } finally {
            jdbc.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        }
    }
}
