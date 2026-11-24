package com.prowise.operator.operations;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;
import com.prowise.identity.AuthPrincipal;
import com.prowise.operator.OperatorDTOs;
import com.prowise.operator.OperatorDepartment;
import com.prowise.operator.PlatformOperatorEntity;
import com.prowise.operator.PlatformOperatorRepository;

@Service
@Transactional
public class OperatorOperationsService {

    private final IncidentRepository incidentRepository;
    private final IncidentAssignmentRepository assignmentRepository;
    private final SupportTicketRepository ticketRepository;
    private final SupportAccessRequestRepository accessRequestRepository;
    private final IntegrationInstallationRepository integrationRepository;
    private final GitHubRepositoryLinkRepository githubRepoRepository;
    private final WebhookReceiptRepository webhookRepository;
    private final BackgroundJobRepository jobRepository;
    private final MaintenanceWindowRepository maintenanceRepository;
    private final EmailDeliveryLogRepository emailLogRepository;
    private final OperationalAlertRepository alertRepository;
    private final OperatorActivityLogRecordRepository activityLogRepository;
    private final PlatformOperatorRepository operatorRepository;

    public OperatorOperationsService(
            IncidentRepository incidentRepository,
            IncidentAssignmentRepository assignmentRepository,
            SupportTicketRepository ticketRepository,
            SupportAccessRequestRepository accessRequestRepository,
            IntegrationInstallationRepository integrationRepository,
            GitHubRepositoryLinkRepository githubRepoRepository,
            WebhookReceiptRepository webhookRepository,
            BackgroundJobRepository jobRepository,
            MaintenanceWindowRepository maintenanceRepository,
            EmailDeliveryLogRepository emailLogRepository,
            OperationalAlertRepository alertRepository,
            OperatorActivityLogRecordRepository activityLogRepository,
            PlatformOperatorRepository operatorRepository
    ) {
        this.incidentRepository = incidentRepository;
        this.assignmentRepository = assignmentRepository;
        this.ticketRepository = ticketRepository;
        this.accessRequestRepository = accessRequestRepository;
        this.integrationRepository = integrationRepository;
        this.githubRepoRepository = githubRepoRepository;
        this.webhookRepository = webhookRepository;
        this.jobRepository = jobRepository;
        this.maintenanceRepository = maintenanceRepository;
        this.emailLogRepository = emailLogRepository;
        this.alertRepository = alertRepository;
        this.activityLogRepository = activityLogRepository;
        this.operatorRepository = operatorRepository;
    }

    private void enforceDepartmentAccess(String resourceDepartment, AuthPrincipal principal, String resourceName) {
        if (principal == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED, "Authentication required.");
        }
        // Super Admin or Main Platform Operator has global access
        if (principal.isMainPlatformOperator() || "role-super-admin".equalsIgnoreCase(principal.role()) || "SUPER_ADMIN".equalsIgnoreCase(principal.role())) {
            return;
        }
        // Department operator is constrained to their department
        if (resourceDepartment != null && !resourceDepartment.isBlank()) {
            String principalDept = principal.departmentId();
            if (principalDept == null || !principalDept.equalsIgnoreCase(resourceDepartment)) {
                throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN,
                        "Access denied: Operator is not authorized for department " + resourceDepartment + " " + resourceName);
            }
        }
    }

    private void logActivity(AuthPrincipal principal, String action, String resourceType, String resourceId, String details, String ipAddress) {
        try {
            String opId = principal != null && principal.operatorId() != null ? principal.operatorId() : "system";
            String deptId = principal != null ? principal.departmentId() : null;
            activityLogRepository.save(new OperatorActivityLogRecordEntity(
                    opId, deptId, action, resourceType, resourceId, details, ipAddress
            ));
        } catch (Exception ignored) {
            // Non-blocking telemetry
        }
    }

    // ==================== INCIDENTS & COORDINATION ====================

    @Transactional(readOnly = true)
    public List<OperatorDTOs.IncidentResponse> listIncidents(String dept, String status, String severity, AuthPrincipal principal) {
        String effectiveDept = dept;
        if (!principal.isMainPlatformOperator() && !"role-super-admin".equalsIgnoreCase(principal.role()) && !"SUPER_ADMIN".equalsIgnoreCase(principal.role())) {
            effectiveDept = principal.departmentId();
        }
        List<IncidentEntity> list = incidentRepository.searchIncidents(
                (effectiveDept != null && !effectiveDept.equals("ALL")) ? effectiveDept : null,
                (status != null && !status.equals("ALL")) ? status : null,
                (severity != null && !severity.equals("ALL")) ? severity : null
        );
        return list.stream().map(this::toIncidentResponse).toList();
    }

    @Transactional(readOnly = true)
    public OperatorDTOs.IncidentResponse getIncident(String id, AuthPrincipal principal) {
        IncidentEntity inc = incidentRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Incident not found: " + id));
        enforceDepartmentAccess(inc.getDepartmentId(), principal, "incident");
        return toIncidentResponse(inc);
    }

    public OperatorDTOs.IncidentResponse createIncident(OperatorDTOs.CreateIncidentRequest req, AuthPrincipal principal, String ip) {
        String dept = req.departmentId();
        if (dept == null || dept.isBlank()) {
            dept = principal.departmentId() != null ? principal.departmentId() : "platform-operations";
        }
        enforceDepartmentAccess(dept, principal, "incident");

        String id = "inc-" + UUID.randomUUID().toString().substring(0, 8);
        IncidentEntity inc = new IncidentEntity(id, req.title(), req.severity(), "INVESTIGATING", dept, req.description());
        inc.setAssignedOperatorId(req.assignedOperatorId());
        IncidentEntity saved = incidentRepository.save(inc);

        logActivity(principal, "INCIDENT_CREATED", "incidents", saved.getId(), "Created incident: " + saved.getTitle(), ip);
        return toIncidentResponse(saved);
    }

    public OperatorDTOs.IncidentResponse updateIncident(String id, OperatorDTOs.UpdateIncidentRequest req, AuthPrincipal principal, String ip) {
        IncidentEntity inc = incidentRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Incident not found: " + id));
        enforceDepartmentAccess(inc.getDepartmentId(), principal, "incident");

        if (req.title() != null) inc.setTitle(req.title());
        if (req.severity() != null) inc.setSeverity(req.severity());
        if (req.status() != null) inc.setStatus(req.status());
        if (req.departmentId() != null) inc.setDepartmentId(req.departmentId());
        if (req.assignedOperatorId() != null) inc.setAssignedOperatorId(req.assignedOperatorId());
        if (req.description() != null) inc.setDescription(req.description());
        if (req.rootCause() != null) inc.setRootCause(req.rootCause());
        if (req.mitigationSteps() != null) inc.setMitigationSteps(req.mitigationSteps());
        inc.setUpdatedAt(Instant.now());

        IncidentEntity saved = incidentRepository.save(inc);
        logActivity(principal, "INCIDENT_UPDATED", "incidents", saved.getId(), "Updated incident: " + saved.getTitle(), ip);
        return toIncidentResponse(saved);
    }

    public OperatorDTOs.IncidentResponse assignIncident(String id, OperatorDTOs.AssignIncidentRequest req, AuthPrincipal principal, String ip) {
        IncidentEntity inc = incidentRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Incident not found: " + id));

        // Coordination: Main Platform Operator can assign any incident to any department operator
        if (!principal.isMainPlatformOperator() && !"role-super-admin".equalsIgnoreCase(principal.role()) && !"SUPER_ADMIN".equalsIgnoreCase(principal.role())) {
            enforceDepartmentAccess(inc.getDepartmentId(), principal, "incident");
        }

        PlatformOperatorEntity targetOp = operatorRepository.findById(req.assignedToOperatorId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Target operator not found: " + req.assignedToOperatorId()));

        inc.setAssignedOperatorId(targetOp.getId());
        inc.setUpdatedAt(Instant.now());
        IncidentEntity saved = incidentRepository.save(inc);

        String actorId = principal.operatorId() != null ? principal.operatorId() : principal.email();
        assignmentRepository.save(new IncidentAssignmentEntity(id, actorId, targetOp.getId(), req.notes()));

        logActivity(principal, "INCIDENT_ASSIGNED", "incidents", id, "Assigned incident to " + targetOp.getName(), ip);
        return toIncidentResponse(saved);
    }

    public OperatorDTOs.IncidentResponse resolveIncident(String id, OperatorDTOs.ResolveIncidentRequest req, AuthPrincipal principal, String ip) {
        IncidentEntity inc = incidentRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Incident not found: " + id));
        enforceDepartmentAccess(inc.getDepartmentId(), principal, "incident");

        inc.setStatus("RESOLVED");
        if (req.rootCause() != null) inc.setRootCause(req.rootCause());
        if (req.mitigationSteps() != null) inc.setMitigationSteps(req.mitigationSteps());
        inc.setResolvedAt(Instant.now());
        inc.setUpdatedAt(Instant.now());
        IncidentEntity saved = incidentRepository.save(inc);

        logActivity(principal, "INCIDENT_RESOLVED", "incidents", id, "Resolved incident " + saved.getTitle(), ip);
        return toIncidentResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<OperatorDTOs.IncidentAssignmentResponse> listIncidentAssignments(String incidentId, AuthPrincipal principal) {
        IncidentEntity inc = incidentRepository.findById(incidentId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Incident not found: " + incidentId));
        enforceDepartmentAccess(inc.getDepartmentId(), principal, "incident");

        List<IncidentAssignmentEntity> list = assignmentRepository.findByIncidentIdOrderByCreatedAtDesc(incidentId);
        return list.stream().map(a -> {
            String opName = operatorRepository.findById(a.getAssignedTo()).map(PlatformOperatorEntity::getName).orElse(a.getAssignedTo());
            return new OperatorDTOs.IncidentAssignmentResponse(
                    a.getId().toString(), a.getIncidentId(), a.getAssignedBy(),
                    a.getAssignedTo(), opName, a.getNotes(), a.getCreatedAt()
            );
        }).toList();
    }

    // ==================== SUPPORT OPERATIONS ====================

    @Transactional(readOnly = true)
    public List<OperatorDTOs.SupportTicketResponse> listSupportTickets(String dept, String status, String priority, AuthPrincipal principal) {
        String effectiveDept = dept;
        if (!principal.isMainPlatformOperator() && !"role-super-admin".equalsIgnoreCase(principal.role()) && !"SUPER_ADMIN".equalsIgnoreCase(principal.role())) {
            effectiveDept = principal.departmentId();
        }
        List<SupportTicketEntity> list = ticketRepository.searchTickets(
                (effectiveDept != null && !effectiveDept.equals("ALL")) ? effectiveDept : null,
                (status != null && !status.equals("ALL")) ? status : null,
                (priority != null && !priority.equals("ALL")) ? priority : null
        );
        return list.stream().map(this::toTicketResponse).toList();
    }

    @Transactional(readOnly = true)
    public OperatorDTOs.SupportTicketResponse getSupportTicket(String id, AuthPrincipal principal) {
        SupportTicketEntity tkt = ticketRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Support ticket not found: " + id));
        enforceDepartmentAccess(tkt.getDepartmentId(), principal, "support ticket");
        return toTicketResponse(tkt);
    }

    public OperatorDTOs.SupportTicketResponse assignSupportTicket(String id, OperatorDTOs.AssignSupportTicketRequest req, AuthPrincipal principal, String ip) {
        SupportTicketEntity tkt = ticketRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Support ticket not found: " + id));

        if (!principal.isMainPlatformOperator() && !"role-super-admin".equalsIgnoreCase(principal.role()) && !"SUPER_ADMIN".equalsIgnoreCase(principal.role())) {
            enforceDepartmentAccess(tkt.getDepartmentId(), principal, "support ticket");
        }

        tkt.setAssignedOperatorId(req.assignedOperatorId());
        tkt.setStatus("IN_PROGRESS");
        tkt.setUpdatedAt(Instant.now());
        SupportTicketEntity saved = ticketRepository.save(tkt);

        logActivity(principal, "TICKET_ASSIGNED", "support_tickets", id, "Assigned ticket to " + req.assignedOperatorId(), ip);
        return toTicketResponse(saved);
    }

    public OperatorDTOs.SupportTicketResponse updateSupportTicket(String id, OperatorDTOs.UpdateSupportTicketRequest req, AuthPrincipal principal, String ip) {
        SupportTicketEntity tkt = ticketRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Support ticket not found: " + id));
        enforceDepartmentAccess(tkt.getDepartmentId(), principal, "support ticket");

        if (req.priority() != null) tkt.setPriority(req.priority());
        if (req.status() != null) tkt.setStatus(req.status());
        if (req.assignedOperatorId() != null) tkt.setAssignedOperatorId(req.assignedOperatorId());
        tkt.setUpdatedAt(Instant.now());

        SupportTicketEntity saved = ticketRepository.save(tkt);
        logActivity(principal, "TICKET_UPDATED", "support_tickets", id, "Updated ticket status: " + saved.getStatus(), ip);
        return toTicketResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<OperatorDTOs.SupportAccessRequestResponse> listSupportAccessRequests(String status, AuthPrincipal principal) {
        List<SupportAccessRequestEntity> list = (status != null && !status.equals("ALL"))
                ? accessRequestRepository.findByStatusOrderByCreatedAtDesc(status)
                : accessRequestRepository.findAllByOrderByCreatedAtDesc();
        return list.stream().map(this::toAccessRequestResponse).toList();
    }

    public OperatorDTOs.SupportAccessRequestResponse approveSupportAccessRequest(String id, AuthPrincipal principal, String ip) {
        SupportAccessRequestEntity req = accessRequestRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Access request not found: " + id));

        req.setStatus("APPROVED");
        req.setApprovedBy(principal.operatorId() != null ? principal.operatorId() : principal.email());
        req.setApprovedAt(Instant.now());
        req.setExpiresAt(Instant.now().plus(4, java.time.temporal.ChronoUnit.HOURS));
        SupportAccessRequestEntity saved = accessRequestRepository.save(req);

        logActivity(principal, "ACCESS_REQUEST_APPROVED", "support_access", id, "Approved tenant support access for " + req.getRequesterEmail(), ip);
        return toAccessRequestResponse(saved);
    }

    public OperatorDTOs.SupportAccessRequestResponse rejectSupportAccessRequest(String id, AuthPrincipal principal, String ip) {
        SupportAccessRequestEntity req = accessRequestRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Access request not found: " + id));

        req.setStatus("REJECTED");
        req.setApprovedBy(principal.operatorId() != null ? principal.operatorId() : principal.email());
        SupportAccessRequestEntity saved = accessRequestRepository.save(req);

        logActivity(principal, "ACCESS_REQUEST_REJECTED", "support_access", id, "Rejected support access request", ip);
        return toAccessRequestResponse(saved);
    }

    // ==================== INTEGRATIONS, GITHUB & WEBHOOKS ====================

    @Transactional(readOnly = true)
    public List<OperatorDTOs.IntegrationInstallationResponse> listIntegrations(AuthPrincipal principal) {
        return integrationRepository.findAllByOrderByCreatedAtDesc().stream().map(this::toIntegrationResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<OperatorDTOs.GitHubRepositoryLinkResponse> listGitHubRepositories(String installationId, AuthPrincipal principal) {
        List<GitHubRepositoryLinkEntity> list = (installationId != null && !installationId.isBlank())
                ? githubRepoRepository.findByInstallationId(installationId)
                : githubRepoRepository.findAllByOrderByCreatedAtDesc();
        return list.stream().map(this::toGitHubRepoResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<OperatorDTOs.WebhookReceiptResponse> listWebhooks(String source, String status, AuthPrincipal principal) {
        List<WebhookReceiptEntity> list;
        if (source != null && !source.equals("ALL")) {
            list = webhookRepository.findBySourceOrderByReceivedAtDesc(source);
        } else if (status != null && !status.equals("ALL")) {
            list = webhookRepository.findByStatusOrderByReceivedAtDesc(status);
        } else {
            list = webhookRepository.findAllByOrderByReceivedAtDesc();
        }
        return list.stream().map(this::toWebhookResponse).toList();
    }

    public OperatorDTOs.WebhookReceiptResponse retryWebhook(String id, AuthPrincipal principal, String ip) {
        WebhookReceiptEntity wh = webhookRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Webhook record not found: " + id));

        wh.setAttempts(wh.getAttempts() + 1);
        wh.setStatus("PROCESSED");
        wh.setErrorMessage(null);
        wh.setLastRetryAt(Instant.now());
        WebhookReceiptEntity saved = webhookRepository.save(wh);

        logActivity(principal, "WEBHOOK_RETRY", "webhooks", id, "Triggered manual retry for webhook event " + wh.getEventType(), ip);
        return toWebhookResponse(saved);
    }

    // ==================== BACKGROUND JOBS ====================

    @Transactional(readOnly = true)
    public List<OperatorDTOs.BackgroundJobResponse> listJobs(String queue, String status, AuthPrincipal principal) {
        List<BackgroundJobEntity> list;
        if (queue != null && !queue.equals("ALL")) {
            list = jobRepository.findByQueueNameOrderByCreatedAtDesc(queue);
        } else if (status != null && !status.equals("ALL")) {
            list = jobRepository.findByStatusOrderByCreatedAtDesc(status);
        } else {
            list = jobRepository.findAllByOrderByCreatedAtDesc();
        }
        return list.stream().map(this::toJobResponse).toList();
    }

    public OperatorDTOs.BackgroundJobResponse retryJob(String id, AuthPrincipal principal, String ip) {
        BackgroundJobEntity job = jobRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Background job not found: " + id));

        job.setAttempts(job.getAttempts() + 1);
        job.setStatus("QUEUED");
        job.setErrorDetails(null);
        job.setScheduledAt(Instant.now());
        BackgroundJobEntity saved = jobRepository.save(job);

        logActivity(principal, "JOB_RETRY", "jobs", id, "Retried background job: " + job.getJobName(), ip);
        return toJobResponse(saved);
    }

    // ==================== MAINTENANCE WINDOWS ====================

    @Transactional(readOnly = true)
    public List<OperatorDTOs.MaintenanceWindowResponse> listMaintenanceWindows(String dept, String status, AuthPrincipal principal) {
        List<MaintenanceWindowEntity> list;
        if (dept != null && !dept.equals("ALL")) {
            list = maintenanceRepository.findByDepartmentIdOrderByScheduledStartDesc(dept);
        } else if (status != null && !status.equals("ALL")) {
            list = maintenanceRepository.findByStatusOrderByScheduledStartDesc(status);
        } else {
            list = maintenanceRepository.findAllByOrderByScheduledStartDesc();
        }
        return list.stream().map(this::toMaintenanceResponse).toList();
    }

    public OperatorDTOs.MaintenanceWindowResponse createMaintenanceWindow(OperatorDTOs.CreateMaintenanceWindowRequest req, AuthPrincipal principal, String ip) {
        String dept = req.departmentId() != null ? req.departmentId() : principal.departmentId();
        enforceDepartmentAccess(dept, principal, "maintenance window");

        String id = "maint-" + UUID.randomUUID().toString().substring(0, 8);
        MaintenanceWindowEntity m = new MaintenanceWindowEntity();
        m.setId(id);
        m.setTitle(req.title());
        m.setDescription(req.description());
        m.setDepartmentId(dept);
        m.setStatus("SCHEDULED");
        m.setScheduledStart(req.scheduledStart() != null ? req.scheduledStart() : Instant.now().plus(2, java.time.temporal.ChronoUnit.HOURS));
        m.setScheduledEnd(req.scheduledEnd() != null ? req.scheduledEnd() : Instant.now().plus(4, java.time.temporal.ChronoUnit.HOURS));
        m.setCreatedBy(principal.operatorId() != null ? principal.operatorId() : principal.email());
        MaintenanceWindowEntity saved = maintenanceRepository.save(m);

        logActivity(principal, "MAINTENANCE_SCHEDULED", "maintenance", id, "Scheduled maintenance: " + req.title(), ip);
        return toMaintenanceResponse(saved);
    }

    public OperatorDTOs.MaintenanceWindowResponse updateMaintenanceWindow(String id, OperatorDTOs.UpdateMaintenanceWindowRequest req, AuthPrincipal principal, String ip) {
        MaintenanceWindowEntity m = maintenanceRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Maintenance window not found: " + id));
        enforceDepartmentAccess(m.getDepartmentId(), principal, "maintenance window");

        if (req.title() != null) m.setTitle(req.title());
        if (req.description() != null) m.setDescription(req.description());
        if (req.status() != null) {
            m.setStatus(req.status());
            if ("IN_PROGRESS".equalsIgnoreCase(req.status())) m.setActualStart(Instant.now());
            if ("COMPLETED".equalsIgnoreCase(req.status())) m.setActualEnd(Instant.now());
        }
        if (req.scheduledStart() != null) m.setScheduledStart(req.scheduledStart());
        if (req.scheduledEnd() != null) m.setScheduledEnd(req.scheduledEnd());
        m.setUpdatedAt(Instant.now());

        MaintenanceWindowEntity saved = maintenanceRepository.save(m);
        logActivity(principal, "MAINTENANCE_UPDATED", "maintenance", id, "Updated maintenance status to " + saved.getStatus(), ip);
        return toMaintenanceResponse(saved);
    }

    // ==================== EMAIL & COMMUNICATIONS ====================

    @Transactional(readOnly = true)
    public List<OperatorDTOs.EmailDeliveryLogResponse> listEmailDeliveryLogs(String status, AuthPrincipal principal) {
        List<EmailDeliveryLogEntity> list = (status != null && !status.equals("ALL"))
                ? emailLogRepository.findByStatusOrderByCreatedAtDesc(status)
                : emailLogRepository.findAllByOrderByCreatedAtDesc();
        return list.stream().map(this::toEmailResponse).toList();
    }

    /**
     * A logged email cannot be re-sent from the log: account emails carry single-use links whose raw token is never
     * stored, so a "retry" could only pretend. The log is left unchanged; the sender of the original email (for
     * example "Resend setup email" on the user) issues a fresh link and a real new delivery attempt.
     */
    public OperatorDTOs.EmailDeliveryLogResponse retryEmailDelivery(String id, AuthPrincipal principal, String ip) {
        emailLogRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Not found."));
        throw new ApiException(HttpStatus.CONFLICT, "EMAIL_RETRY_UNAVAILABLE",
                "Logged emails cannot be re-sent. Use the original action (for example Resend setup email) to send a new one.");
    }

    // ==================== OPERATIONAL ALERTS ====================

    @Transactional(readOnly = true)
    public List<OperatorDTOs.OperationalAlertResponse> listAlerts(Boolean acknowledged, AuthPrincipal principal) {
        List<OperationalAlertEntity> list = (acknowledged != null)
                ? alertRepository.findByAcknowledgedOrderByCreatedAtDesc(acknowledged)
                : alertRepository.findAllByOrderByCreatedAtDesc();
        return list.stream().map(this::toAlertResponse).toList();
    }

    public OperatorDTOs.OperationalAlertResponse acknowledgeAlert(String id, AuthPrincipal principal, String ip) {
        OperationalAlertEntity alert = alertRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Alert not found: " + id));

        alert.setAcknowledged(true);
        alert.setAcknowledgedBy(principal.operatorId() != null ? principal.operatorId() : principal.email());
        OperationalAlertEntity saved = alertRepository.save(alert);

        logActivity(principal, "ALERT_ACKNOWLEDGED", "operational_alerts", id, "Acknowledged alert: " + alert.getTitle(), ip);
        return toAlertResponse(saved);
    }

    // ==================== TEAM WORKLOAD & COORDINATION ====================

    @Transactional(readOnly = true)
    public List<OperatorDTOs.OperatorWorkloadResponse> getTeamWorkload(AuthPrincipal principal) {
        List<PlatformOperatorEntity> ops = operatorRepository.findAll();
        List<OperatorDTOs.OperatorWorkloadResponse> workload = new ArrayList<>();

        for (PlatformOperatorEntity op : ops) {
            long openIncidents = incidentRepository.countByAssignedOperatorIdAndStatusNot(op.getId(), "RESOLVED");
            long openTickets = ticketRepository.countByAssignedOperatorIdAndStatusIn(op.getId(), List.of("OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"));

            workload.add(new OperatorDTOs.OperatorWorkloadResponse(
                    op.getId(),
                    op.getName(),
                    op.getDepartmentId() != null ? op.getDepartmentId() : "all",
                    op.getAccessLevel() != null ? op.getAccessLevel().name() : "DEPARTMENT_OPERATOR",
                    op.isOnCall(),
                    op.getShiftName(),
                    (int) openIncidents,
                    (int) openTickets,
                    op.getLastActiveAt()
            ));
        }
        return workload;
    }

    // ==================== AGGREGATED STATS ====================

    @Transactional(readOnly = true)
    public Map<String, Object> getDashboardStats(AuthPrincipal principal) {
        long openIncidents = incidentRepository.countByStatusNot("RESOLVED");
        long openTickets = ticketRepository.countByStatusIn(List.of("OPEN", "IN_PROGRESS"));
        long pendingWebhooks = webhookRepository.countByStatus("RETRYING");
        long failedJobs = jobRepository.countByStatus("FAILED");
        long unackAlerts = alertRepository.countByAcknowledgedFalse();

        return Map.of(
                "openIncidents", openIncidents,
                "openTickets", openTickets,
                "pendingWebhooks", pendingWebhooks,
                "failedJobs", failedJobs,
                "unacknowledgedAlerts", unackAlerts,

                "operationalStatus", openIncidents > 0 ? "DEGRADED" : "OPERATIONAL"
        );
    }

    // ==================== RESPONSE MAPPERS ====================

    private OperatorDTOs.IncidentResponse toIncidentResponse(IncidentEntity i) {
        String deptName = i.getDepartmentId() != null ? OperatorDepartment.fromId(i.getDepartmentId()).getDisplayName() : "Global";
        String opName = i.getAssignedOperatorId() != null
                ? operatorRepository.findById(i.getAssignedOperatorId()).map(PlatformOperatorEntity::getName).orElse(i.getAssignedOperatorId())
                : "Unassigned";

        return new OperatorDTOs.IncidentResponse(
                i.getId(), i.getTitle(), i.getSeverity(), i.getStatus(),
                i.getDepartmentId(), deptName, i.getAssignedOperatorId(), opName,
                i.getDescription(), i.getRootCause(), i.getMitigationSteps(),
                i.getResolvedAt(), i.getCreatedAt(), i.getUpdatedAt()
        );
    }

    private OperatorDTOs.SupportTicketResponse toTicketResponse(SupportTicketEntity t) {
        String deptName = t.getDepartmentId() != null ? OperatorDepartment.fromId(t.getDepartmentId()).getDisplayName() : "General Support";
        String opName = t.getAssignedOperatorId() != null
                ? operatorRepository.findById(t.getAssignedOperatorId()).map(PlatformOperatorEntity::getName).orElse(t.getAssignedOperatorId())
                : "Unassigned";

        return new OperatorDTOs.SupportTicketResponse(
                t.getId(), t.getSubject(), t.getCustomerName(), t.getCustomerEmail(),
                t.getDepartmentId(), deptName, t.getAssignedOperatorId(), opName,
                t.getPriority(), t.getStatus(), t.getDescription(),
                t.getCreatedAt(), t.getUpdatedAt()
        );
    }

    private OperatorDTOs.SupportAccessRequestResponse toAccessRequestResponse(SupportAccessRequestEntity r) {
        return new OperatorDTOs.SupportAccessRequestResponse(
                r.getId(), r.getTicketId(), r.getRequesterEmail(), r.getOrgId(),
                r.getReason(), r.getStatus(), r.getApprovedBy(),
                r.getApprovedAt(), r.getExpiresAt(), r.getCreatedAt()
        );
    }

    private OperatorDTOs.IntegrationInstallationResponse toIntegrationResponse(IntegrationInstallationEntity i) {
        return new OperatorDTOs.IntegrationInstallationResponse(
                i.getId(), i.getName(), i.getType(), i.getStatus(), i.getHealth(),
                i.getLastSyncedAt(), i.getErrorCount(), i.getConfigJson(),
                i.getCreatedAt(), i.getUpdatedAt()
        );
    }

    private OperatorDTOs.GitHubRepositoryLinkResponse toGitHubRepoResponse(GitHubRepositoryLinkEntity g) {
        return new OperatorDTOs.GitHubRepositoryLinkResponse(
                g.getId(), g.getRepoFullName(), g.getInstallationId(),
                g.getDefaultBranch(), g.isWebhookActive(), g.getLastEventAt(), g.getCreatedAt()
        );
    }

    private OperatorDTOs.WebhookReceiptResponse toWebhookResponse(WebhookReceiptEntity w) {
        return new OperatorDTOs.WebhookReceiptResponse(
                w.getId(), w.getWebhookId(), w.getSource(), w.getEventType(),
                w.getStatus(), w.getAttempts(), w.getErrorMessage(),
                w.getPayload(), w.getReceivedAt(), w.getLastRetryAt()
        );
    }

    private OperatorDTOs.BackgroundJobResponse toJobResponse(BackgroundJobEntity j) {
        return new OperatorDTOs.BackgroundJobResponse(
                j.getId(), j.getJobName(), j.getQueueName(), j.getStatus(),
                j.getAttempts(), j.getMaxAttempts(), j.getErrorDetails(),
                j.getScheduledAt(), j.getStartedAt(), j.getCompletedAt(), j.getCreatedAt()
        );
    }

    private OperatorDTOs.MaintenanceWindowResponse toMaintenanceResponse(MaintenanceWindowEntity m) {
        return new OperatorDTOs.MaintenanceWindowResponse(
                m.getId(), m.getTitle(), m.getDescription(), m.getDepartmentId(),
                m.getStatus(), m.getScheduledStart(), m.getScheduledEnd(),
                m.getActualStart(), m.getActualEnd(), m.getCreatedBy(),
                m.getCreatedAt(), m.getUpdatedAt()
        );
    }

    private OperatorDTOs.EmailDeliveryLogResponse toEmailResponse(EmailDeliveryLogEntity e) {
        return new OperatorDTOs.EmailDeliveryLogResponse(
                e.getId(), e.getRecipient(), e.getSubject(), e.getProvider(),
                e.getStatus(), e.getAttempts(), e.getErrorCode(),
                e.getErrorMessage(), e.getSentAt(), e.getCreatedAt()
        );
    }

    private OperatorDTOs.OperationalAlertResponse toAlertResponse(OperationalAlertEntity a) {
        return new OperatorDTOs.OperationalAlertResponse(
                a.getId(), a.getSeverity(), a.getTitle(), a.getMessage(),
                a.getSourceModule(), a.getDepartmentId(), a.isAcknowledged(),
                a.getAcknowledgedBy(), a.getCreatedAt()
        );
    }
}
