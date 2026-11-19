package com.prowise.developer;

import java.util.List;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.identity.AuthPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping
@Tag(name = "Developer Panel", description = "Endpoints for developer workspace, projects, tasks, reviews, and tracking")
public class DeveloperController {

    private final DeveloperService developerService;

    public DeveloperController(DeveloperService developerService) {
        this.developerService = developerService;
    }

    private String resolveUserId(HttpServletRequest request, Authentication auth) {
        AuthPrincipal principal = AuthPrincipal.current(request);
        if (principal != null && principal.userId() != null) {
            return principal.userId().toString();
        }
        if (auth != null && auth.getName() != null && !auth.getName().isBlank()) {
            return auth.getName();
        }
        return "usr-developer";
    }

    private UUID resolveOrgId(HttpServletRequest request, String orgIdParam) {
        if (orgIdParam != null && !orgIdParam.isBlank()) {
            try {
                return UUID.fromString(orgIdParam);
            } catch (IllegalArgumentException ignored) {}
        }
        AuthPrincipal principal = AuthPrincipal.current(request);
        if (principal != null) {
            return principal.organizationId();
        }
        return null;
    }

    // 1. Dashboard
    @GetMapping({"/v1/developer/dashboard", "/api/v1/developer/dashboard"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get developer dashboard telemetry and summary")
    public DeveloperDTOs.DashboardSummaryDTO getDashboard(
            @RequestParam(required = false) String orgId,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        UUID resolvedOrgId = resolveOrgId(request, orgId);
        return developerService.getDashboardSummary(userId, resolvedOrgId);
    }

    // 2. Assigned Projects
    @GetMapping({"/v1/developer/projects", "/api/v1/developer/projects"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "List projects assigned to the developer")
    public List<DeveloperDTOs.ProjectDTO> getProjects(
            @RequestParam(required = false) String orgId,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        UUID resolvedOrgId = resolveOrgId(request, orgId);
        return developerService.getAssignedProjects(userId, resolvedOrgId);
    }

    @GetMapping({"/v1/developer/projects/{projectId}", "/api/v1/developer/projects/{projectId}"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get single assigned project details")
    public ResponseEntity<DeveloperDTOs.ProjectDTO> getProject(
            @PathVariable String projectId,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        return developerService.getProjectDetails(projectId, userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 3. Tasks & Work Items
    @GetMapping({"/v1/developer/tasks", "/api/v1/developer/tasks"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get tasks assigned to developer")
    public List<DeveloperDTOs.WorkItemDTO> getMyTasks(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String projectId,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        return developerService.getMyTasks(userId, status, priority, projectId);
    }

    @PatchMapping({"/v1/developer/tasks/{taskId}/status", "/api/v1/developer/tasks/{taskId}/status"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Update task state and log note")
    public DeveloperDTOs.WorkItemDTO updateTaskStatus(
            @PathVariable String taskId,
            @RequestBody DeveloperDTOs.TaskStatusUpdateRequest req,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        return developerService.updateTaskStatus(taskId, userId, req);
    }

    @GetMapping({"/v1/developer/tasks/{taskId}/blockers", "/api/v1/developer/tasks/{taskId}/blockers"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get blockers for a specific task")
    public List<TaskBlockerEntity> getTaskBlockers(@PathVariable String taskId) {
        return developerService.getTaskBlockers(taskId);
    }

    @PostMapping({"/v1/developer/tasks/{taskId}/blockers", "/api/v1/developer/tasks/{taskId}/blockers"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Report a blocker on a task")
    public ResponseEntity<TaskBlockerEntity> submitBlocker(
            @PathVariable String taskId,
            @RequestBody DeveloperDTOs.TaskBlockerRequest req,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        TaskBlockerEntity blocker = developerService.submitTaskBlocker(taskId, userId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(blocker);
    }

    @PostMapping({"/v1/developer/blockers/{blockerId}/resolve", "/api/v1/developer/blockers/{blockerId}/resolve"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Resolve a task blocker")
    public TaskBlockerEntity resolveBlocker(
            @PathVariable String blockerId,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        return developerService.resolveTaskBlocker(blockerId, userId);
    }

    @GetMapping({"/v1/developer/tasks/{taskId}/comments", "/api/v1/developer/tasks/{taskId}/comments"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get comments on a task")
    public List<TaskCommentEntity> getTaskComments(@PathVariable String taskId) {
        return developerService.getTaskComments(taskId);
    }

    @PostMapping({"/v1/developer/tasks/{taskId}/comments", "/api/v1/developer/tasks/{taskId}/comments"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Add a comment to a task")
    public ResponseEntity<TaskCommentEntity> addTaskComment(
            @PathVariable String taskId,
            @RequestBody DeveloperDTOs.TaskCommentRequest req,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        TaskCommentEntity comment = developerService.addTaskComment(taskId, userId, "Developer", req);
        return ResponseEntity.status(HttpStatus.CREATED).body(comment);
    }

    // 4. Check-Ins (Individual Mode)
    @PostMapping({"/v1/developer/check-ins", "/api/v1/developer/check-ins"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Submit an authoritative percentage check-in for individual mode")
    public ResponseEntity<ProjectCheckInEntity> submitCheckIn(
            @RequestBody DeveloperDTOs.CheckInSubmissionRequest req,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        ProjectCheckInEntity checkIn = developerService.submitCheckIn(userId, "Developer", req);
        return ResponseEntity.status(HttpStatus.CREATED).body(checkIn);
    }

    @GetMapping({"/v1/developer/projects/{projectId}/check-ins", "/api/v1/developer/projects/{projectId}/check-ins"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get check-in history for a project")
    public List<ProjectCheckInEntity> getProjectCheckIns(@PathVariable String projectId) {
        return developerService.getProjectCheckIns(projectId);
    }

    // 5. Sprints & Kanban
    @GetMapping({"/v1/developer/sprints", "/api/v1/developer/sprints"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get sprints and sprint tasks for Kanban board")
    public List<DeveloperDTOs.SprintDTO> getSprints(@RequestParam(required = false) String projectId) {
        return developerService.getSprints(projectId);
    }

    // 6. Bugs & Issues
    @GetMapping({"/v1/developer/bugs", "/api/v1/developer/bugs"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "List bugs assigned or for project")
    public List<BugEntity> getBugs(
            @RequestParam(required = false) String projectId,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        return developerService.getBugs(userId, projectId);
    }

    @PostMapping({"/v1/developer/bugs", "/api/v1/developer/bugs"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Report a new bug")
    public ResponseEntity<BugEntity> createBug(
            @RequestBody DeveloperDTOs.CreateBugRequest req,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        BugEntity bug = developerService.createBug(userId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(bug);
    }

    @PatchMapping({"/v1/developer/bugs/{bugId}/status", "/api/v1/developer/bugs/{bugId}/status"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Update bug status")
    public BugEntity updateBugStatus(
            @PathVariable String bugId,
            @RequestBody DeveloperDTOs.UpdateBugStatusRequest req,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        return developerService.updateBugStatus(bugId, userId, req);
    }

    // 7. Code Reviews
    @GetMapping({"/v1/developer/reviews", "/api/v1/developer/reviews"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get code reviews assigned to or authored by developer")
    public List<CodeReviewEntity> getReviews(
            @RequestParam(required = false) String type,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        return developerService.getCodeReviews(userId, type);
    }

    @PostMapping({"/v1/developer/reviews/{reviewId}/decision", "/api/v1/developer/reviews/{reviewId}/decision"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Submit a decision on a code review")
    public CodeReviewEntity submitReviewDecision(
            @PathVariable String reviewId,
            @RequestBody DeveloperDTOs.CodeReviewDecisionRequest req,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        return developerService.submitReviewDecision(reviewId, userId, req);
    }

    // 8. GitHub Activity
    @GetMapping({"/v1/developer/github/activity", "/api/v1/developer/github/activity"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get GitHub repository commits, PRs, and events")
    public List<GitHubActivityEntity> getGitHubActivity(
            @RequestParam(required = false) String repo,
            @RequestParam(required = false) String actor
    ) {
        return developerService.getGitHubActivity(repo, actor);
    }

    // 9. Calendar & Deadlines
    @GetMapping({"/v1/developer/calendar", "/api/v1/developer/calendar"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get developer calendar events and deadlines")
    public List<CalendarEventEntity> getCalendar(
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        return developerService.getCalendarEvents(userId);
    }

    @PostMapping({"/v1/developer/calendar", "/api/v1/developer/calendar"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Add an event or milestone deadline to calendar")
    public ResponseEntity<CalendarEventEntity> createCalendarEvent(
            @RequestBody DeveloperDTOs.CalendarEventRequest req,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        CalendarEventEntity event = developerService.createCalendarEvent(userId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(event);
    }

    // 10. Team Collaboration / Discussions
    @GetMapping({"/v1/developer/discussions", "/api/v1/developer/discussions"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get discussions for project or team")
    public List<DiscussionEntity> getDiscussions(@RequestParam(required = false) String projectId) {
        return developerService.getDiscussions(projectId);
    }

    @PostMapping({"/v1/developer/discussions", "/api/v1/developer/discussions"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Start a new team discussion")
    public ResponseEntity<DiscussionEntity> createDiscussion(
            @RequestBody DeveloperDTOs.DiscussionPostRequest req,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        DiscussionEntity disc = developerService.createDiscussion(userId, "Developer", req);
        return ResponseEntity.status(HttpStatus.CREATED).body(disc);
    }

    @GetMapping({"/v1/developer/discussions/{discussionId}/messages", "/api/v1/developer/discussions/{discussionId}/messages"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get messages in a discussion")
    public List<DiscussionMessageEntity> getDiscussionMessages(@PathVariable String discussionId) {
        return developerService.getDiscussionMessages(discussionId);
    }

    @PostMapping({"/v1/developer/discussions/{discussionId}/messages", "/api/v1/developer/discussions/{discussionId}/messages"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Post a message in a discussion")
    public ResponseEntity<DiscussionMessageEntity> postDiscussionMessage(
            @PathVariable String discussionId,
            @RequestBody DeveloperDTOs.DiscussionMessageRequest req,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        DiscussionMessageEntity msg = developerService.addDiscussionMessage(discussionId, userId, "Developer", req.message());
        return ResponseEntity.status(HttpStatus.CREATED).body(msg);
    }

    // 11. Files & Documents
    @GetMapping({"/v1/developer/files", "/api/v1/developer/files"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get files and documents")
    public List<FileMetadataEntity> getFiles(
            @RequestParam(required = false) String projectId,
            @RequestParam(required = false) String workItemId
    ) {
        return developerService.getFiles(projectId, workItemId);
    }

    @PostMapping({"/v1/developer/files", "/api/v1/developer/files"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Save metadata of an uploaded file or document")
    public ResponseEntity<FileMetadataEntity> saveFileRecord(
            @RequestBody DeveloperDTOs.FileUploadRecordRequest req,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        FileMetadataEntity file = developerService.saveFileRecord(userId, req);
        return ResponseEntity.status(HttpStatus.CREATED).body(file);
    }

    // 12. Notifications
    @GetMapping({"/v1/developer/notifications", "/api/v1/developer/notifications"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get developer notifications")
    public List<DeveloperNotificationEntity> getNotifications(
            @RequestParam(required = false) Boolean unreadOnly,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        return developerService.getNotifications(userId, unreadOnly);
    }

    @PatchMapping({"/v1/developer/notifications/{id}/read", "/api/v1/developer/notifications/{id}/read"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Mark a notification as read")
    public ResponseEntity<Void> markNotificationRead(
            @PathVariable String id,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        developerService.markNotificationRead(id, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping({"/v1/developer/notifications/read-all", "/api/v1/developer/notifications/read-all"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Mark all notifications as read")
    public ResponseEntity<Void> markAllNotificationsRead(
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        developerService.markAllNotificationsRead(userId);
        return ResponseEntity.noContent().build();
    }

    // 13. Reports
    @GetMapping({"/v1/developer/reports/summary", "/api/v1/developer/reports/summary"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get developer metrics and performance reports summary")
    public DeveloperDTOs.DeveloperReportsSummaryDTO getReportsSummary(
            @RequestParam(required = false) String orgId,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        UUID resolvedOrgId = resolveOrgId(request, orgId);
        return developerService.getReportsSummary(userId, resolvedOrgId);
    }

    // 14. Preferences & Settings
    @GetMapping({"/v1/developer/preferences", "/api/v1/developer/preferences"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Get developer personal settings and notification preferences")
    public DeveloperPreferenceEntity getPreferences(
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        return developerService.getPreferences(userId);
    }

    @PutMapping({"/v1/developer/preferences", "/api/v1/developer/preferences"})
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Update developer personal settings and notification preferences")
    public DeveloperPreferenceEntity updatePreferences(
            @RequestBody DeveloperDTOs.PreferenceUpdateRequest req,
            HttpServletRequest request,
            Authentication auth
    ) {
        String userId = resolveUserId(request, auth);
        return developerService.updatePreferences(userId, req);
    }
}
