package com.prowise.operator.console;

import static com.prowise.operator.console.ConsoleSql.instant;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

import jakarta.annotation.PreDestroy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.prowise.common.api.ApiException;
import com.prowise.identity.AuthPrincipal;

/**
 * Database backups with pg_dump. Runs only when PROWISE_BACKUP_DIR is set and pg_dump is found
 * (PROWISE_PG_DUMP_PATH, else PATH); otherwise the attempt is recorded as NOT_CONFIGURED and the caller gets
 * 503 BACKUP_NOT_CONFIGURED. At most one run at a time (409 BACKUP_RUNNING, also enforced by a unique index).
 * The dump runs on a background thread; the database password reaches the child only via PGPASSWORD and is
 * never logged, stored or put on the command line. Permission key: system.backups (view / execute).
 */
@Service
public class BackupService {

    static final String PERM = "system.backups";
    static final String NOT_CONFIGURED_MESSAGE =
            "Backups are not configured: set PROWISE_BACKUP_DIR and PROWISE_PG_DUMP_PATH (or put pg_dump on PATH).";
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");
    private static final Logger log = LoggerFactory.getLogger(BackupService.class);

    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final OperatorPermissionGuard guard;
    private final ConsoleAudit audit;
    private final String backupDir;
    private final String pgDumpPath;
    private final long timeoutMinutes;
    private final String datasourceUrl;
    private final String datasourceUser;
    private final String datasourcePassword;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "prowise-backup");
        t.setDaemon(true);
        return t;
    });
    private final AtomicReference<Process> current = new AtomicReference<>();

    public BackupService(JdbcTemplate jdbc, TransactionTemplate tx, OperatorPermissionGuard guard, ConsoleAudit audit,
            @Value("${PROWISE_BACKUP_DIR:}") String backupDir,
            @Value("${PROWISE_PG_DUMP_PATH:}") String pgDumpPath,
            @Value("${PROWISE_BACKUP_TIMEOUT_MINUTES:60}") long timeoutMinutes,
            @Value("${spring.datasource.url:}") String datasourceUrl,
            @Value("${spring.datasource.username:}") String datasourceUser,
            @Value("${spring.datasource.password:}") String datasourcePassword) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.guard = guard;
        this.audit = audit;
        this.backupDir = backupDir == null ? "" : backupDir.trim();
        this.pgDumpPath = pgDumpPath;
        this.timeoutMinutes = timeoutMinutes > 0 ? timeoutMinutes : 60;
        this.datasourceUrl = datasourceUrl;
        this.datasourceUser = datasourceUser;
        this.datasourcePassword = datasourcePassword;
    }

    /** A run left RUNNING by a stopped process can never finish: close it so new runs are possible. */
    @EventListener(ApplicationReadyEvent.class)
    public void closeInterruptedRuns(ApplicationReadyEvent event) {
        if (!(event.getApplicationContext() instanceof org.springframework.web.context.WebApplicationContext)) {
            return; // the worker never runs backups, so it must not close the API's run
        }
        try {
            jdbc.update("UPDATE backup_runs SET status = 'FAILED', finished_at = now(), "
                    + "error_message = 'Interrupted: the server stopped during the backup.' WHERE status = 'RUNNING'");
        } catch (RuntimeException e) {
            log.warn("Could not close interrupted backup runs ({})", e.getClass().getSimpleName());
        }
    }

    public BackupDTOs.BackupList list(AuthPrincipal principal, Integer page, Integer size) {
        guard.require(principal, PERM, "view");
        ConsoleSql.Paging paging = ConsoleSql.paging(page, size);
        Long total = jdbc.queryForObject("SELECT count(*) FROM backup_runs", Long.class);
        Boolean running = jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM backup_runs WHERE status = 'RUNNING')", Boolean.class);
        List<BackupDTOs.BackupRun> items = jdbc.query("SELECT * FROM backup_runs ORDER BY started_at DESC, id LIMIT ? OFFSET ?",
                (rs, i) -> map(rs), paging.size(), paging.offset());
        return new BackupDTOs.BackupList(resolveConfiguration() != null, Boolean.TRUE.equals(running), items,
                total == null ? 0 : total, paging.page(), paging.size());
    }

    public BackupDTOs.BackupRun start(AuthPrincipal principal, String ip) {
        guard.require(principal, PERM, "execute");
        String actor = principal.email() != null ? principal.email() : OperatorPermissionGuard.actorId(principal);
        Config config = resolveConfiguration();
        if (config == null) {
            UUID id = UUID.randomUUID();
            tx.executeWithoutResult(s -> {
                jdbc.update("""
                        INSERT INTO backup_runs (id, status, started_at, finished_at, triggered_by, error_message)
                        VALUES (?, 'NOT_CONFIGURED', now(), now(), ?, ?)
                        """, id, actor, NOT_CONFIGURED_MESSAGE);
                audit.record(principal, "SYSTEM", "BACKUP_NOT_CONFIGURED", "backup_runs", id.toString(),
                        "Backup requested but not configured", ip);
            });
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "BACKUP_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
        }
        UUID id = UUID.randomUUID();
        String fileName = "prowise-" + ZonedDateTime.now(ZoneOffset.UTC).format(STAMP) + "-"
                + id.toString().substring(0, 8) + ".dump";
        try {
            tx.executeWithoutResult(s -> {
                Boolean running = jdbc.queryForObject(
                        "SELECT EXISTS (SELECT 1 FROM backup_runs WHERE status = 'RUNNING')", Boolean.class);
                if (Boolean.TRUE.equals(running)) {
                    throw running();
                }
                jdbc.update("INSERT INTO backup_runs (id, status, started_at, file_name, triggered_by) VALUES (?, 'RUNNING', now(), ?, ?)",
                        id, fileName, actor);
                audit.record(principal, "SYSTEM", "BACKUP_STARTED", "backup_runs", id.toString(),
                        "Started database backup " + fileName, ip);
            });
        } catch (DuplicateKeyException e) {
            throw running();
        }
        executor.submit(() -> execute(id, config, fileName));
        return load(id);
    }

    private static ApiException running() {
        return new ApiException(HttpStatus.CONFLICT, "BACKUP_RUNNING", "A backup is already running. Wait for it to finish.");
    }

    private record Config(String pgDump, BackupCommand.Target target, Path dir) {}

    private Config resolveConfiguration() {
        if (backupDir.isEmpty()) return null;
        String pgDump = BackupCommand.resolvePgDump(pgDumpPath, System.getenv("PATH"));
        BackupCommand.Target target = BackupCommand.parse(datasourceUrl);
        if (pgDump == null || target == null || datasourceUser == null || datasourceUser.isBlank()) return null;
        return new Config(pgDump, target, Path.of(backupDir));
    }

    private void execute(UUID id, Config config, String fileName) {
        Path output = config.dir().resolve(fileName);
        Path stderr = null;
        try {
            Files.createDirectories(config.dir());
            stderr = Files.createTempFile("prowise-backup-", ".log");
            ProcessBuilder pb = new ProcessBuilder(BackupCommand.arguments(config.pgDump(), config.target(), datasourceUser, output));
            pb.environment().put("PGPASSWORD", datasourcePassword == null ? "" : datasourcePassword);
            pb.redirectOutput(ProcessBuilder.Redirect.DISCARD);
            pb.redirectError(stderr.toFile());
            Process process = pb.start();
            current.set(process);
            boolean finished = process.waitFor(timeoutMinutes, TimeUnit.MINUTES);
            if (!finished) {
                process.destroyForcibly();
                fail(id, output, "pg_dump did not finish within " + timeoutMinutes + " minutes.");
                return;
            }
            if (process.exitValue() != 0) {
                String message = Files.readString(stderr, StandardCharsets.UTF_8);
                fail(id, output, BackupCommand.safeError(message, datasourcePassword, config.dir().toString()));
                return;
            }
            long size = Files.size(output);
            jdbc.update("UPDATE backup_runs SET status = 'SUCCEEDED', finished_at = now(), size_bytes = ? WHERE id = ?", size, id);
            log.info("Backup {} succeeded ({} bytes)", fileName, size);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            fail(id, output, "The backup was interrupted.");
        } catch (Exception e) {
            fail(id, output, "The backup could not run (" + e.getClass().getSimpleName() + ").");
        } finally {
            current.set(null);
            if (stderr != null) {
                try { Files.deleteIfExists(stderr); } catch (Exception ignored) { }
            }
        }
    }

    private void fail(UUID id, Path output, String message) {
        try { Files.deleteIfExists(output); } catch (Exception ignored) { }
        try {
            jdbc.update("UPDATE backup_runs SET status = 'FAILED', finished_at = now(), error_message = ? WHERE id = ?",
                    message, id);
        } catch (RuntimeException e) {
            log.warn("Could not record backup failure ({})", e.getClass().getSimpleName());
        }
        log.warn("Backup {} failed: {}", id, message);
    }

    @PreDestroy
    void shutdown() {
        Process process = current.get();
        if (process != null) process.destroyForcibly();
        executor.shutdownNow();
    }

    private BackupDTOs.BackupRun load(UUID id) {
        return jdbc.queryForObject("SELECT * FROM backup_runs WHERE id = ?", (rs, i) -> map(rs), id);
    }

    private static BackupDTOs.BackupRun map(ResultSet rs) throws SQLException {
        long size = rs.getLong("size_bytes");
        Long sizeBytes = rs.wasNull() ? null : size;
        return new BackupDTOs.BackupRun(rs.getString("id"), rs.getString("status"), instant(rs, "started_at"),
                instant(rs, "finished_at"), sizeBytes, rs.getString("file_name"),
                rs.getString("triggered_by"), rs.getString("error_message"));
    }
}
