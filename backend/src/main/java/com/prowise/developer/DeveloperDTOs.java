package com.prowise.developer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class DeveloperDTOs {

    public record DashboardSummaryDTO(
        long assignedProjectsCount,
        long activeProjectsCount,
        long assignedTasksCount,
        long completedTasksCount,
        long pendingTasksCount,
        long overdueTasksCount,
        long openBugsCount,
        long pendingReviewsCount,
        long unreadNotificationsCount,
        List<WorkItemDTO> todayTasks,
        List<WorkItemDTO> priorityTasks,
        List<WorkItemDTO> blockedTasks,
        List<DeadlineItemDTO> upcomingDeadlines,
        List<GitHubActivityEntity> recentGitEvents
    ) {}

    public record DeadlineItemDTO(
        String id,
        String title,
        String key,
        String projectCode,
        String projectId,
        Instant dueDate,
        String priority,
        String state
    ) {}

    public record ProjectDTO(
        String id,
        UUID orgId,
        String name,
        String code,
        String description,
        String mode,
        String status,
        BigDecimal completionPercent,
        Instant targetCompletionDate,
        String accountableOwnerId,
        String memberIds,
        BigDecimal totalWeight,
        BigDecimal completedWeight,
        long blockedTasksCount,
        long overdueTasksCount,
        ProjectCheckInEntity latestCheckIn
    ) {}

    public record WorkItemDTO(
        String id,
        String projectId,
        UUID orgId,
        String parentId,
        String type,
        String key,
        String title,
        String description,
        String primaryAssigneeId,
        String reviewerId,
        String state,
        boolean blocked,
        BigDecimal weight,
        String weightUnit,
        String criteria,
        int currentRevision,
        Integer submittedRevision,
        Instant dueDate,
        Instant startDate,
        BigDecimal estimatedHours,
        BigDecimal actualHours,
        String priority,
        String sprintId,
        Instant createdAt,
        Instant updatedAt
    ) {}

    public record TaskStatusUpdateRequest(
        String state,
        String note
    ) {}

    public record TaskBlockerRequest(
        String reason,
        String severity
    ) {}

    public record TaskCommentRequest(
        String comment
    ) {}

    public record TaskEvidenceRequest(
        String evidenceUrl,
        String notes
    ) {}

    public record CheckInSubmissionRequest(
        String projectId,
        BigDecimal percent,
        String accomplished,
        String nextSteps,
        String blockers,
        String risks
    ) {}

    public record SprintDTO(
        String id,
        String projectId,
        String name,
        String goal,
        String status,
        Instant startDate,
        Instant endDate,
        List<WorkItemDTO> tasks
    ) {}

    public record CreateBugRequest(
        String projectId,
        String title,
        String description,
        String severity,
        String reproductionSteps,
        String environment,
        String assignedTo
    ) {}

    public record UpdateBugStatusRequest(
        String status,
        String resolution
    ) {}

    public record CodeReviewDecisionRequest(
        String decision, // APPROVED, CHANGES_REQUESTED, MERGED
        String feedback
    ) {}

    public record CalendarEventRequest(
        String projectId,
        String title,
        String description,
        String eventType,
        Instant startTime,
        Instant endTime,
        boolean allDay,
        String url
    ) {}

    public record DiscussionPostRequest(
        String projectId,
        String title,
        String category,
        String initialMessage
    ) {}

    public record DiscussionMessageRequest(
        String message
    ) {}

    public record FileUploadRecordRequest(
        String projectId,
        String workItemId,
        String fileName,
        String fileUrl,
        Long fileSize,
        String contentType
    ) {}

    public record PreferenceUpdateRequest(
        boolean emailNotifications,
        boolean slackNotifications,
        String theme,
        String githubUsername,
        String timezone
    ) {}

    public record DeveloperReportsSummaryDTO(
        long totalAssignedTasks,
        long completedTasks,
        long inProgressTasks,
        long inReviewTasks,
        long blockedTasks,
        BigDecimal totalActualHours,
        BigDecimal totalEstimatedHours,
        long openBugs,
        long resolvedBugs,
        long codeReviewsSubmitted,
        long codeReviewsCompleted,
        List<ProjectContributionDTO> projectContributions
    ) {}

    public record ProjectContributionDTO(
        String projectId,
        String projectName,
        String projectCode,
        String mode,
        long tasksCount,
        long completedTasksCount,
        BigDecimal progressPercent
    ) {}
}
