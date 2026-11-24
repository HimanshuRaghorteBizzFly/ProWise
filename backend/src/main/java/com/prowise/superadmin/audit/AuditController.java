package com.prowise.superadmin.audit;

import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping({"/v1/admin/audit-logs", "/api/v1/admin/audit-logs"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('audit.view')")
    public List<AuditDTOs.AuditLogResponse> listAuditLogs(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Instant fromDate,
            @RequestParam(required = false) Instant toDate
    ) {
        return auditService.listAuditLogs(category, severity, search, fromDate, toDate);
    }

    @PostMapping({"/v1/admin/audit-logs", "/api/v1/admin/audit-logs"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('audit.view')")
    public ResponseEntity<AuditDTOs.AuditLogResponse> recordAuditLog(
            jakarta.servlet.http.HttpServletRequest http, @RequestBody AuditDTOs.RecordAuditLogRequest request) {
        // The actor is always the signed-in caller; a client-supplied actor_email is ignored.
        AuditDTOs.AuditLogResponse response = auditService.recordAuditLog(request, com.prowise.superadmin.common.AdminRequests.actor(http));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
