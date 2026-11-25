package com.prowise.operator.console;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Path;
import java.util.List;
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
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.testsupport.ConsoleSessions;

/** Backups without configuration: 503 BACKUP_NOT_CONFIGURED, recorded, audited; permission enforced. */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Tag("NFR-06")
class BackupIntegrationTest {

    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder encoder;
    @Autowired private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        TestDatabase.clean(jdbc);
        ConsoleSessions.cleanup(jdbc);
    }

    @AfterEach
    void tearDown() {
        ConsoleSessions.cleanup(jdbc);
    }

    @Test
    void notConfiguredReturns503AndRecordsTheAttempt() throws Exception {
        String sre = ConsoleSessions.operator(mvc, jdbc, encoder, mapper, ConsoleSessions.operatorId("sre"),
                "DEPARTMENT_OPERATOR", "site-reliability");
        mvc.perform(post("/v1/operator/backups").header("Authorization", "Bearer " + sre))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("BACKUP_NOT_CONFIGURED"))
                .andExpect(jsonPath("$.message").value(BackupService.NOT_CONFIGURED_MESSAGE));
        mvc.perform(get("/v1/operator/backups").header("Authorization", "Bearer " + sre))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configured").value(false))
                .andExpect(jsonPath("$.running").value(false))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].status").value("NOT_CONFIGURED"))
                .andExpect(jsonPath("$.items[0].file_name").doesNotExist());
        assertThat(jdbc.queryForList("SELECT action FROM operator_activity_logs", String.class)).contains("BACKUP_NOT_CONFIGURED");
    }

    @Test
    void onlyOperatorsWithTheBackupPermissionOrTheSuperAdminMayRun() throws Exception {
        String finance = ConsoleSessions.operator(mvc, jdbc, encoder, mapper, ConsoleSessions.operatorId("fin"),
                "DEPARTMENT_OPERATOR", "finance-tax");
        mvc.perform(post("/v1/operator/backups").header("Authorization", "Bearer " + finance)).andExpect(status().isForbidden());
        mvc.perform(post("/v1/operator/backups")).andExpect(status().isUnauthorized());
        String admin = ConsoleSessions.superAdmin(mvc, jdbc, encoder, mapper);
        mvc.perform(post("/v1/operator/backups").header("Authorization", "Bearer " + admin))
                .andExpect(status().isServiceUnavailable());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM backup_runs", Integer.class)).isEqualTo(1);
    }

    @Test
    void commandNeverCarriesThePasswordAndErrorsAreScrubbed() {
        BackupCommand.Target target = BackupCommand.parse("jdbc:postgresql://db.internal:6543/prowise?sslmode=require");
        assertThat(target).isEqualTo(new BackupCommand.Target("db.internal", 6543, "prowise"));
        assertThat(BackupCommand.parse("jdbc:postgresql://localhost/prowise")).isEqualTo(new BackupCommand.Target("localhost", 5432, "prowise"));
        assertThat(BackupCommand.parse("jdbc:mysql://x/y")).isNull();
        List<String> args = BackupCommand.arguments("pg_dump", target, "prowise", Path.of("out.dump"));
        assertThat(String.join(" ", args)).doesNotContainIgnoringCase("password=").contains("--no-password", "--username=prowise");
        String secret = "S3cret-" + UUID.randomUUID();
        String scrubbed = BackupCommand.safeError("pg_dump: error: connection failed: password " + secret
                + " rejected for /srv/backups\nsecond line", secret, "/srv/backups");
        assertThat(scrubbed).doesNotContain(secret).doesNotContain("/srv/backups").doesNotContain("second line");
        assertThat(BackupCommand.resolvePgDump("Z:/definitely/not/here/pg_dump", null)).isNull();
    }

}
