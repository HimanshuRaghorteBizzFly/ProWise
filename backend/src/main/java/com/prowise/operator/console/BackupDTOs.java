package com.prowise.operator.console;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

public final class BackupDTOs {

    private BackupDTOs() {}

    @Schema(name = "BackupRun")
    public record BackupRun(
            String id,
            @Schema(description = "RUNNING, SUCCEEDED, FAILED, NOT_CONFIGURED") String status,
            Instant startedAt,
            Instant finishedAt,
            Long sizeBytes,
            @Schema(description = "File name only (no directory)") String fileName,
            String triggeredBy,
            String errorMessage
    ) {}

    @Schema(name = "BackupRunList")
    public record BackupList(
            @Schema(description = "PROWISE_BACKUP_DIR is set and pg_dump was found") boolean configured,
            boolean running,
            List<BackupRun> items,
            long total,
            int page,
            int size
    ) {}
}
