package com.prowise.superadmin.audit;

import java.time.Instant;
import java.util.UUID;

public class AuditDTOs {

    public record AuditLogResponse(
            UUID id,
            String category,
            String action,
            String summary,
            String actorName,
            String actorEmail,
            String targetLabel,
            String severity,
            Instant timestamp
    ) {}

    public record RecordAuditLogRequest(
            String category,
            String action,
            String summary,
            String actorName,
            String actorEmail,
            String targetLabel,
            String severity
    ) {}
}
