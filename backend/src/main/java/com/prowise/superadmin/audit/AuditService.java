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
        String safeCat = (category != null && !category.equals("ALL")) ? category : null;
        String safeSev = (severity != null && !severity.equals("ALL")) ? severity : null;
        String safeSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;

        List<AdminAuditLogEntity> list = repository.searchAuditLogs(safeCat, safeSev, safeSearch, fromDate, toDate);
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
