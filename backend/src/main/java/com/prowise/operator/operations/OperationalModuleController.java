package com.prowise.operator.operations;

import java.util.List;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.prowise.identity.AuthPrincipal;
import com.prowise.operator.OperatorDTOs;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping
@Tag(name = "Platform Operator Operational Modules", description = "Operational module management, incidents, SRE, and team coordination")
public class OperationalModuleController {

    private final OperatorOperationsService operationsService;
    private final com.prowise.operator.console.OperatorDashboardService dashboardService;

    public OperationalModuleController(OperatorOperationsService operationsService,
            com.prowise.operator.console.OperatorDashboardService dashboardService) {
        this.operationsService = operationsService;
        this.dashboardService = dashboardService;
    }

    private String getClientIp(HttpServletRequest request) {
        return com.prowise.common.api.ClientAddress.of(request);
    }

    // ==================== DASHBOARD STATS ====================

    @GetMapping({"/v1/operator/dashboard/stats", "/api/v1/operator/dashboard/stats"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Real operational counters (camelCase keys); systemHealthScore and operationalStatus are null: not measured")
    public Map<String, Object> getDashboardStats(HttpServletRequest request) {
        AuthPrincipal.require(request);
        return dashboardService.stats();
    }

    // ==================== INCIDENTS & COORDINATION ====================

    @GetMapping({"/v1/operator/incidents", "/api/v1/operator/incidents"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List incidents scoped by operator access profile or department filter")
    public List<OperatorDTOs.IncidentResponse> listIncidents(
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String severity,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.listIncidents(department, status, severity, principal);
    }

    @GetMapping({"/v1/operator/incidents/{id}", "/api/v1/operator/incidents/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Get single incident detail")
    public OperatorDTOs.IncidentResponse getIncident(@PathVariable String id, HttpServletRequest request) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.getIncident(id, principal);
    }

    @PostMapping({"/v1/operator/incidents", "/api/v1/operator/incidents"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Create a platform incident")
    public ResponseEntity<OperatorDTOs.IncidentResponse> createIncident(
            @RequestBody OperatorDTOs.CreateIncidentRequest req,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        OperatorDTOs.IncidentResponse created = operationsService.createIncident(req, principal, getClientIp(request));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping({"/v1/operator/incidents/{id}", "/api/v1/operator/incidents/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Update incident details or severity (expected_version required)")
    public OperatorDTOs.IncidentResponse updateIncident(
            @PathVariable String id,
            @RequestBody OperatorDTOs.UpdateIncidentRequest req,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.updateIncident(id, req, principal, getClientIp(request));
    }

    @PostMapping({"/v1/operator/incidents/{id}/assign", "/api/v1/operator/incidents/{id}/assign"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Assign incident to a department operator (Coordination action); body: assigned_to_operator_id, notes, expected_version")
    public OperatorDTOs.IncidentResponse assignIncident(
            @PathVariable String id,
            @RequestBody OperatorDTOs.AssignIncidentRequest req,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.assignIncident(id, req, principal, getClientIp(request));
    }

    @PostMapping({"/v1/operator/incidents/{id}/resolve", "/api/v1/operator/incidents/{id}/resolve"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Resolve platform incident with root cause & mitigation (expected_version required)")
    public OperatorDTOs.IncidentResponse resolveIncident(
            @PathVariable String id,
            @RequestBody OperatorDTOs.ResolveIncidentRequest req,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.resolveIncident(id, req, principal, getClientIp(request));
    }

    @GetMapping({"/v1/operator/incidents/{id}/assignments", "/api/v1/operator/incidents/{id}/assignments"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List assignment coordination history for an incident")
    public List<OperatorDTOs.IncidentAssignmentResponse> listIncidentAssignments(
            @PathVariable String id,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.listIncidentAssignments(id, principal);
    }

    // ==================== SUPPORT OPERATIONS ====================

    @GetMapping({"/v1/operator/support/tickets", "/api/v1/operator/support/tickets"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List customer support tickets")
    public List<OperatorDTOs.SupportTicketResponse> listSupportTickets(
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.listSupportTickets(department, status, priority, principal);
    }

    @GetMapping({"/v1/operator/support/tickets/{id}", "/api/v1/operator/support/tickets/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Get single support ticket")
    public OperatorDTOs.SupportTicketResponse getSupportTicket(@PathVariable String id, HttpServletRequest request) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.getSupportTicket(id, principal);
    }

    @PostMapping({"/v1/operator/support/tickets/{id}/assign", "/api/v1/operator/support/tickets/{id}/assign"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Assign support ticket to a department operator (expected_version required)")
    public OperatorDTOs.SupportTicketResponse assignSupportTicket(
            @PathVariable String id,
            @RequestBody OperatorDTOs.AssignSupportTicketRequest req,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.assignSupportTicket(id, req, principal, getClientIp(request));
    }

    @PatchMapping({"/v1/operator/support/tickets/{id}", "/api/v1/operator/support/tickets/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Update support ticket priority or state (expected_version required)")
    public OperatorDTOs.SupportTicketResponse updateSupportTicket(
            @PathVariable String id,
            @RequestBody OperatorDTOs.UpdateSupportTicketRequest req,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.updateSupportTicket(id, req, principal, getClientIp(request));
    }

    @GetMapping({"/v1/operator/support/access-requests", "/api/v1/operator/support/access-requests"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List tenant diagnostic support access requests")
    public List<OperatorDTOs.SupportAccessRequestResponse> listSupportAccessRequests(
            @RequestParam(required = false) String status,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.listSupportAccessRequests(status, principal);
    }

    @PostMapping({"/v1/operator/support/access-requests/{id}/approve", "/api/v1/operator/support/access-requests/{id}/approve"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Approve break-glass support access request (body: expected_version)")
    public OperatorDTOs.SupportAccessRequestResponse approveAccessRequest(
            @PathVariable String id,
            @RequestBody(required = false) com.prowise.superadmin.common.AdminRequests.VersionRequest body,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.approveSupportAccessRequest(id, com.prowise.superadmin.common.AdminRequests.expected(body), principal, getClientIp(request));
    }

    @PostMapping({"/v1/operator/support/access-requests/{id}/reject", "/api/v1/operator/support/access-requests/{id}/reject"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Reject support access request (body: expected_version)")
    public OperatorDTOs.SupportAccessRequestResponse rejectAccessRequest(
            @PathVariable String id,
            @RequestBody(required = false) com.prowise.superadmin.common.AdminRequests.VersionRequest body,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.rejectSupportAccessRequest(id, com.prowise.superadmin.common.AdminRequests.expected(body), principal, getClientIp(request));
    }

    // ==================== INTEGRATIONS, GITHUB & WEBHOOKS ====================

    @GetMapping({"/v1/operator/integrations", "/api/v1/operator/integrations"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List external service integration installations")
    public List<OperatorDTOs.IntegrationInstallationResponse> listIntegrations(HttpServletRequest request) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.listIntegrations(principal);
    }

    @GetMapping({"/v1/operator/github/repositories", "/api/v1/operator/github/repositories"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List GitHub repositories linked to platform sync")
    public List<OperatorDTOs.GitHubRepositoryLinkResponse> listGitHubRepositories(
            @RequestParam(required = false) String installationId,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.listGitHubRepositories(installationId, principal);
    }

    @GetMapping({"/v1/operator/webhooks", "/api/v1/operator/webhooks"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List incoming webhook receipt log")
    public List<OperatorDTOs.WebhookReceiptResponse> listWebhooks(
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String status,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.listWebhooks(source, status, principal);
    }

    @PostMapping({"/v1/operator/webhooks/{id}/retry", "/api/v1/operator/webhooks/{id}/retry"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Trigger manual retry for a failed webhook event (idempotent re-queue; no expected_version)")
    public OperatorDTOs.WebhookReceiptResponse retryWebhook(@PathVariable String id, HttpServletRequest request) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.retryWebhook(id, principal, getClientIp(request));
    }

    // ==================== BACKGROUND JOBS ====================

    @GetMapping({"/v1/operator/jobs", "/api/v1/operator/jobs"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List queued and executing background jobs")
    public List<OperatorDTOs.BackgroundJobResponse> listJobs(
            @RequestParam(required = false) String queue,
            @RequestParam(required = false) String status,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.listJobs(queue, status, principal);
    }

    @PostMapping({"/v1/operator/jobs/{id}/retry", "/api/v1/operator/jobs/{id}/retry"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Requeue a failed background worker job (idempotent re-queue; no expected_version)")
    public OperatorDTOs.BackgroundJobResponse retryJob(@PathVariable String id, HttpServletRequest request) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.retryJob(id, principal, getClientIp(request));
    }

    // ==================== MAINTENANCE ====================

    @GetMapping({"/v1/operator/maintenance", "/api/v1/operator/maintenance"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List scheduled and active maintenance windows")
    public List<OperatorDTOs.MaintenanceWindowResponse> listMaintenanceWindows(
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String status,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.listMaintenanceWindows(department, status, principal);
    }

    @PostMapping({"/v1/operator/maintenance", "/api/v1/operator/maintenance"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Schedule a new platform maintenance window")
    public ResponseEntity<OperatorDTOs.MaintenanceWindowResponse> createMaintenance(
            @RequestBody OperatorDTOs.CreateMaintenanceWindowRequest req,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        OperatorDTOs.MaintenanceWindowResponse created = operationsService.createMaintenanceWindow(req, principal, getClientIp(request));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping({"/v1/operator/maintenance/{id}", "/api/v1/operator/maintenance/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Update maintenance window schedule or completion status (expected_version required)")
    public OperatorDTOs.MaintenanceWindowResponse updateMaintenance(
            @PathVariable String id,
            @RequestBody OperatorDTOs.UpdateMaintenanceWindowRequest req,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.updateMaintenanceWindow(id, req, principal, getClientIp(request));
    }

    // ==================== EMAIL & COMMUNICATIONS ====================

    @GetMapping({"/v1/operator/email/delivery", "/api/v1/operator/email/delivery"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List email delivery and bounce telemetry logs")
    public List<OperatorDTOs.EmailDeliveryLogResponse> listEmailLogs(
            @RequestParam(required = false) String status,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.listEmailDeliveryLogs(status, principal);
    }

    @PostMapping({"/v1/operator/email/{id}/retry", "/api/v1/operator/email/{id}/retry"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Retry dropped or bounced email delivery (idempotent re-queue; no expected_version)")
    public OperatorDTOs.EmailDeliveryLogResponse retryEmail(@PathVariable String id, HttpServletRequest request) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.retryEmailDelivery(id, principal, getClientIp(request));
    }

    // ==================== ALERTS ====================

    @GetMapping({"/v1/operator/monitoring/alerts", "/api/v1/operator/monitoring/alerts"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "List active operational alarms")
    public List<OperatorDTOs.OperationalAlertResponse> listAlerts(
            @RequestParam(required = false) Boolean acknowledged,
            HttpServletRequest request
    ) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.listAlerts(acknowledged, principal);
    }

    @PostMapping({"/v1/operator/monitoring/alerts/{id}/ack", "/api/v1/operator/monitoring/alerts/{id}/ack"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Acknowledge active operational alert (idempotent; no expected_version)")
    public OperatorDTOs.OperationalAlertResponse acknowledgeAlert(@PathVariable String id, HttpServletRequest request) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.acknowledgeAlert(id, principal, getClientIp(request));
    }

    // ==================== TEAM WORKLOAD & COORDINATION ====================

    @GetMapping({"/v1/operator/team/workload", "/api/v1/operator/team/workload"})
    @PreAuthorize("hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Get operational workload and shift balance across operators")
    public List<OperatorDTOs.OperatorWorkloadResponse> getTeamWorkload(HttpServletRequest request) {
        AuthPrincipal principal = AuthPrincipal.require(request);
        return operationsService.getTeamWorkload(principal);
    }
}
