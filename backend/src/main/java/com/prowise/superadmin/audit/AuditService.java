package com.prowise.superadmin.audit;

import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AuditService {

    private final AdminAuditLogRepository repository;

    public AuditService(AdminAuditLogRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<AuditDTOs.AuditLogResponse> listAuditLogs(
            String category,
            String severity,
            String search,
            Instant fromDate,
            Instant toDate
    ) {
        // Never null parameters: PostgreSQL cannot type a null bind in LOWER(...) or a comparison (500 before).
        String safeCat = (category != null && !category.equals("ALL")) ? category : "";
        String safeSev = (severity != null && !severity.equals("ALL")) ? severity : "";
        String safeSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : "";
        Instant from = fromDate != null ? fromDate : Instant.EPOCH;
        Instant to = toDate != null ? toDate : Instant.parse("9999-12-31T23:59:59Z");

        List<AdminAuditLogEntity> list = repository.searchAuditLogs(safeCat, safeSev, safeSearch, from, to);
        return list.stream().map(this::toResponse).toList();
    }

    public AuditDTOs.AuditLogResponse recordAuditLog(AuditDTOs.RecordAuditLogRequest request) {
        AdminAuditLogEntity entity = new AdminAuditLogEntity(
                request.category(),
                request.action(),
                request.summary(),
                request.actorName() != null ? request.actorName() : "Super Admin",
                request.actorEmail() != null ? request.actorEmail() : "superadmin@prowise.io",
                request.targetLabel(),
                request.severity() != null ? request.severity() : "INFO"
        );
        AdminAuditLogEntity saved = repository.save(entity);
        return toResponse(saved);
    }

    public void logActivity(String category, String action, String summary, String actorName, String actorEmail, String targetLabel, String severity) {
        AdminAuditLogEntity entity = new AdminAuditLogEntity(
                category, action, summary, actorName, actorEmail, targetLabel, severity
        );
        repository.save(entity);
    }

    private AuditDTOs.AuditLogResponse toResponse(AdminAuditLogEntity e) {
        return new AuditDTOs.AuditLogResponse(
                e.getId(),
                e.getCategory(),
                e.getAction(),
                e.getSummary(),
                e.getActorName(),
                e.getActorEmail(),
                e.getTargetLabel(),
                e.getSeverity(),
                e.getTimestamp()
        );
    }
}
