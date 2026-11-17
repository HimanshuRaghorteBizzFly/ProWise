package com.prowise;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("NFR-11")
class EnvironmentContractTest {

    private static final Path MIGRATIONS = Path.of("..", "database", "migrations");

    @Test
    void bootstrapMigrationCreatesTenantSafeOperationalTables() throws Exception {
        String migration = Files.readString(MIGRATIONS.resolve("V1__bootstrap.sql"), StandardCharsets.UTF_8);

        assertThat(migration).contains("CREATE TABLE audit_log");
        assertThat(migration).contains("CREATE TABLE outbox_event");
        assertThat(migration).contains("org_id UUID NOT NULL");
        assertThat(migration).contains("CREATE INDEX idx_audit_log_org_id");
        assertThat(migration).contains("CREATE INDEX idx_outbox_event_org_id");
    }

    @Test
    void migrationsArePackagedOntoTheClasspath() {
        assertThat(getClass().getResource("/db/migration/V1__bootstrap.sql")).isNotNull();
    }

    @Test
    void migrationFileNamesFollowTheConvention() throws Exception {
        try (Stream<Path> files = Files.list(MIGRATIONS)) {
            List<String> names = files.map(path -> path.getFileName().toString())
                    .filter(name -> name.endsWith(".sql")).toList();
            assertThat(names).isNotEmpty().allMatch(name -> name.matches("V\\d+__[a-z0-9_]+\\.sql"));
        }
    }

    @Test
    void exampleEnvFilesHoldOnlyDummyValues() throws Exception {
        for (Path file : List.of(Path.of("..", ".env.example"), Path.of(".env.example"),
                Path.of("..", "frontend", ".env.example"))) {
            List<String> lines = Files.readAllLines(file, StandardCharsets.UTF_8).stream()
                    .filter(line -> !line.isBlank() && !line.startsWith("#")).toList();
            assertThat(lines).as(file.toString()).isNotEmpty()
                    .allSatisfy(line -> assertThat(line).as(file + ": every key has a value").matches("[A-Z0-9_]+=.+"));
            String text = String.join("\n", lines).toLowerCase();
            assertThat(text).as(file.toString()).doesNotContain("ghp_", "-----begin");
        }
    }

    @Test
    void realEnvFilesAreGitIgnored() throws Exception {
        List<String> gitignore = Files.readAllLines(Path.of("..", ".gitignore"), StandardCharsets.UTF_8)
                .stream().map(String::strip).toList();

        assertThat(gitignore).contains(".env", ".env.*", "!.env.example");
    }
}
