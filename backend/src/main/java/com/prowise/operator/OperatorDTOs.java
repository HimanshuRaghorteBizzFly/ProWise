package com.prowise.operator;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class OperatorDTOs {

    public record OperatorResponse(
            String id,
            String name,
            String email,
            String roleId,
            String accessLevel,
            String department,
            String status,
            boolean mfaEnabled,
            boolean onCall,
            String shiftName,
            int activeSessionsCount,
            int totalPermissionsCount,
            Instant lastActiveAt,
            Instant createdAt,
            long version
    ) {}

    public record CreateOperatorRequest(
            String name,
            String email,
            String roleId,
            String accessLevel,
            String department,
            String status,
            Boolean mfaEnabled,
            Boolean onCall,
            String shiftName
    ) {}

    public record UpdateOperatorRequest(
            String name,
            String email,
            String roleId,
            String accessLevel,
            String department,
            String status,
            Boolean mfaEnabled,
            Boolean onCall,
            String shiftName,
            Long expectedVersion
    ) {}

    public record UpdateAccessLevelRequest(
            String accessLevel,
            Long expectedVersion
    ) {}

    public record UpdateDepartmentRequest(
            String departmentId,
            Long expectedVersion
    ) {}

    public record PermissionItem(
            String moduleKey,
            String action,
            String state, // "DEPARTMENT_DEFAULT", "INDIVIDUAL_GRANT", "INDIVIDUAL_DENY"
            boolean effectiveAllowed
    ) {}

    public record EffectivePermissionsResponse(
            String operatorId,
            String operatorName,
            String department,
            List<PermissionItem> permissions,
            int totalAllowedCount,
            int totalDeniedCount,
            int totalGrantsCount
    ) {}

    public record PermissionOverrideRequest(
            String moduleKey,
            String action,
            String overrideType, // "GRANT" or "DENY" or "RESET"
            String reason
    ) {}

    public record UpdatePermissionsPayload(
            List<PermissionOverrideRequest> overrides,
            boolean resetToDefaults,
            Long expectedVersion
    ) {}

    public record NavigationModuleItem(
            String id,
            String label,
            String href,
            String icon,
            boolean authorized
    ) {}

    public record NavigationSection(
            String title,
            List<NavigationModuleItem> items
    ) {}

    public record OperatorNavigationResponse(
            String operatorId,
            String department,
            List<NavigationSection> sections
    ) {}

    public record DashboardMetric(
            String label,
            String value,
            String change,
            String tone
    ) {}

    public record OperatorDashboardResponse(
            String department,
            String departmentName,
            List<DashboardMetric> kpis,
            List<String> authorizedModules,
            Map<String, Object> departmentData
    ) {}

    public record DepartmentResponse(
            String id,
            String name,
            String description,
            int defaultPermissionsCount
    ) {}

    public record StatusUpdateRequest(
            String status,
            Long expectedVersion
    ) {}

    public record RoleResponse(
            String id,
            String name,
            String description
    ) {}

    public record PermissionCatalogItem(
            String key,
            String name,
            String category,
            String route,
            List<String> actions,
            String description
    ) {}

    // Operational Models & DTOs
    public record IncidentResponse(
            String id,
            String title,
            String severity,
            String status,
            String departmentId,
            String departmentName,
            String assignedOperatorId,
            String assignedOperatorName,
            String description,
            String rootCause,
            String mitigationSteps,
            Instant resolvedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {}

    public record CreateIncidentRequest(
            String title,
            String severity,
            String departmentId,
            String assignedOperatorId,
            String description
    ) {}

    public record UpdateIncidentRequest(
            String title,
            String severity,
            String status,
            String departmentId,
            String assignedOperatorId,
            String description,
            String rootCause,
            String mitigationSteps,
            Long expectedVersion
    ) {}

    public record AssignIncidentRequest(
            String assignedToOperatorId,
            String notes,
            Long expectedVersion
    ) {}

    public record ResolveIncidentRequest(
            String rootCause,
            String mitigationSteps,
            Long expectedVersion
    ) {}

    public record IncidentAssignmentResponse(
            String id,
            String incidentId,
            String assignedBy,
            String assignedTo,
            String assignedToName,
            String notes,
            Instant createdAt
    ) {}

    public record SupportTicketResponse(
            String id,
            String subject,
            String customerName,
            String customerEmail,
            String departmentId,
            String departmentName,
            String assignedOperatorId,
            String assignedOperatorName,
            String priority,
            String status,
            String description,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {}

    public record CreateSupportTicketRequest(
            String subject,
            String customerName,
            String customerEmail,
            String departmentId,
            String priority,
            String description
    ) {}

    public record UpdateSupportTicketRequest(
            String priority,
            String status,
            String assignedOperatorId,
            Long expectedVersion
    ) {}

    public record AssignSupportTicketRequest(
            String assignedOperatorId,
            String notes,
            Long expectedVersion
    ) {}

    public record SupportAccessRequestResponse(
            String id,
            String ticketId,
            String requesterEmail,
            UUID orgId,
            String reason,
            String status,
            String approvedBy,
            Instant approvedAt,
            Instant expiresAt,
            Instant createdAt,
            long version
    ) {}

    public record CreateAccessRequestRequest(
            String ticketId,
            String requesterEmail,
            UUID orgId,
            String reason,
            Integer durationHours
    ) {}

    public record IntegrationInstallationResponse(
            String id,
            String name,
            String type,
            String status,
            String health,
            Instant lastSyncedAt,
            int errorCount,
            String configJson,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record GitHubRepositoryLinkResponse(
            String id,
            String repoFullName,
            String installationId,
            String defaultBranch,
            boolean webhookActive,
            Instant lastEventAt,
            Instant createdAt
    ) {}

    public record WebhookReceiptResponse(
            String id,
            String webhookId,
            String source,
            String eventType,
            String status,
            int attempts,
            String errorMessage,
            String payload,
            Instant receivedAt,
            Instant lastRetryAt
    ) {}

    public record BackgroundJobResponse(
            String id,
            String jobName,
            String queueName,
            String status,
            int attempts,
            int maxAttempts,
            String errorDetails,
            Instant scheduledAt,
            Instant startedAt,
            Instant completedAt,
            Instant createdAt
    ) {}

    public record MaintenanceWindowResponse(
            String id,
            String title,
            String description,
            String departmentId,
            String status,
            Instant scheduledStart,
            Instant scheduledEnd,
            Instant actualStart,
            Instant actualEnd,
            String createdBy,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {}

    public record CreateMaintenanceWindowRequest(
            String title,
            String description,
            String departmentId,
            Instant scheduledStart,
            Instant scheduledEnd
    ) {}

    public record UpdateMaintenanceWindowRequest(
            String title,
            String description,
            String status,
            Instant scheduledStart,
            Instant scheduledEnd,
            Long expectedVersion
    ) {}

    public record EmailDeliveryLogResponse(
            String id,
            String recipient,
            String subject,
            String provider,
            String status,
            int attempts,
            String errorCode,
            String errorMessage,
            Instant sentAt,
            Instant createdAt
    ) {}

    public record OperationalAlertResponse(
            String id,
            String severity,
            String title,
            String message,
            String sourceModule,
            String departmentId,
            boolean acknowledged,
            String acknowledgedBy,
            Instant createdAt
    ) {}

    public record OperatorActivityLogResponse(
            String id,
            String operatorId,
            String operatorName,
            String departmentId,
            String action,
            String resourceType,
            String resourceId,
            String details,
            String ipAddress,
            Instant createdAt
    ) {}

    public record OperatorWorkloadResponse(
            String operatorId,
            String operatorName,
            String departmentId,
            String accessLevel,
            boolean onCall,
            String shiftName,
            int openIncidentsCount,
            int openTicketsCount,
            Instant lastActiveAt
    ) {}
}
