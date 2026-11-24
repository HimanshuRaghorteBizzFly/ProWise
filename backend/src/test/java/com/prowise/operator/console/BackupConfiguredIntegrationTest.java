package com.prowise.operator.console;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.testsupport.ConsoleSessions;

/**
 * Backups with PROWISE_BACKUP_DIR set: one run at a time (409 BACKUP_RUNNING), and when pg_dump is installed a
 * real dump of the test database succeeds asynchronously (skipped where pg_dump is not available).
 */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Tag("NFR-06")
class BackupConfiguredIntegrationTest {

    private static final Path DIR = Path.of(System.getProperty("java.io.tmpdir"), "prowise-backup-test-" + UUID.randomUUID());
    private static final String PG_DUMP = locatePgDump();

    @DynamicPropertySource
    static void backupSettings(DynamicPropertyRegistry registry) {
        registry.add("PROWISE_BACKUP_DIR", DIR::toString);
        registry.add("PROWISE_PG_DUMP_PATH", () -> PG_DUMP == null ? "" : PG_DUMP);
    }

    private static String locatePgDump() {
        String found = BackupCommand.resolvePgDump(null, System.getenv("PATH"));
        if (found != null) return found;
        for (String candidate : new String[] {"C:/Program Files/PostgreSQL/18/bin/pg_dump.exe",
                "C:/Program Files/PostgreSQL/17/bin/pg_dump.exe", "C:/Program Files/PostgreSQL/16/bin/pg_dump.exe",
                "/usr/bin/pg_dump", "/usr/lib/postgresql/16/bin/pg_dump"}) {
            if (Files.isRegularFile(Path.of(candidate))) return candidate;
        }
        return null;
    }

    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder encoder;
    @Autowired private ObjectMapper mapper;

    private String admin;

    @BeforeEach
    void setUp() throws Exception {
        TestDatabase.clean(jdbc);
        ConsoleSessions.cleanup(jdbc);
        admin = ConsoleSessions.superAdmin(mvc, jdbc, encoder, mapper);
    }

    @AfterEach
    void tearDown() throws Exception {
        ConsoleSessions.cleanup(jdbc);
        if (Files.isDirectory(DIR)) {
            try (var files = Files.list(DIR)) {
                files.forEach(f -> f.toFile().delete());
            }
        }
    }

    @Test
    void aSecondRunWhileOneIsRunningIs409() throws Exception {
        assumeTrue(PG_DUMP != null, "pg_dump not installed");
        jdbc.update("INSERT INTO backup_runs (id, status, triggered_by) VALUES (?, 'RUNNING', 'someone')", UUID.randomUUID());
        mvc.perform(post("/v1/operator/backups").header("Authorization", "Bearer " + admin))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("BACKUP_RUNNING"));
        mvc.perform(get("/v1/operator/backups").header("Authorization", "Bearer " + admin))
                .andExpect(jsonPath("$.configured").value(true)).andExpect(jsonPath("$.running").value(true))
                .andExpect(jsonPath("$.total").value(1));
    }

    @Test
    void aRealRunSucceedsAsynchronouslyAndStoresOnlyTheFileName() throws Exception {
        assumeTrue(PG_DUMP != null, "pg_dump not installed");
        JsonNode run = mapper.readTree(mvc.perform(post("/v1/operator/backups").header("Authorization", "Bearer " + admin))
                .andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString());
        assertThat(run.path("status").asText()).isEqualTo("RUNNING");
        String id = run.path("id").asText();
        String fileName = run.path("file_name").asText();
        assertThat(fileName).matches("prowise-\\d{8}-\\d{6}-[0-9a-f]{8}\\.dump");

        Map<String, Object> row = Map.of();
        for (int i = 0; i < 240; i++) {
            row = jdbc.queryForMap("SELECT status, size_bytes, error_message FROM backup_runs WHERE id = ?::uuid", id);
            if (!"RUNNING".equals(row.get("status"))) break;
            Thread.sleep(250);
        }
        assertThat(row.get("status")).as("backup result %s", row).isEqualTo("SUCCEEDED");
        assertThat(((Number) row.get("size_bytes")).longValue()).isPositive();
        assertThat(Files.size(DIR.resolve(fileName))).isEqualTo(((Number) row.get("size_bytes")).longValue());
        String password = System.getProperty("DB_PASSWORD");
        if (password != null && !password.isEmpty()) {
            assertThat(String.valueOf(jdbc.queryForList("SELECT * FROM backup_runs"))).doesNotContain(password);
        }
        assertThat(jdbc.queryForList("SELECT action FROM operator_activity_logs", String.class)).contains("BACKUP_STARTED");
    }
}
