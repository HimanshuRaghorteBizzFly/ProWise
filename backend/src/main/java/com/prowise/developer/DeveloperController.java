package com.prowise.developer;

import java.util.List;

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

import com.prowise.developer.DeveloperAccess.Actor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Developer workspace API. Every route needs an org-bound token with an ACTIVE membership
 * ({@code tokenOrgMember}); the organization is taken from that token only, never from a parameter.
 * Object, scope and action checks happen in {@link DeveloperService} through {@link DeveloperAccess}.
 */
@RestController
@RequestMapping
@Tag(name = "Developer Panel", description = "Endpoints for developer workspace, projects, tasks, reviews, and tracking")
public class DeveloperController {

    private static final String MEMBER = "@permissionService.tokenOrgMember(authentication)";

    private final DeveloperService developerService;
    private final DeveloperAccess access;
    private final com.prowise.project.ProgressService progressService;

    public DeveloperController(DeveloperService developerService, DeveloperAccess access,
            com.prowise.project.ProgressService progressService) {
        this.developerService = developerService;
        this.access = access;
        this.progressService = progressService;
    }

    private Actor actor(Authentication auth) {
        return access.actor(auth);
    }

    // 1. Dashboard
    @GetMapping({"/v1/developer/dashboard", "/api/v1/developer/dashboard"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get developer dashboard telemetry and summary")
    public DeveloperDTOs.DashboardSummaryDTO getDashboard(Authentication auth) {
        return developerService.getDashboardSummary(actor(auth));
    }

    // 2. Assigned Projects
    @GetMapping({"/v1/developer/projects", "/api/v1/developer/projects"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "List readable projects assigned to the developer in the selected organization")
    public List<DeveloperDTOs.ProjectDTO> getProjects(Authentication auth) {
        return developerService.getAssignedProjects(actor(auth));
    }

    @GetMapping({"/v1/developer/projects/{projectId}", "/api/v1/developer/projects/{projectId}"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get single project details (404 for foreign, unknown or unreadable projects)")
    public DeveloperDTOs.ProjectDTO getProject(@PathVariable String projectId, Authentication auth) {
        return developerService.getProjectDetails(actor(auth), projectId);
    }

    // 3. Tasks & Work Items
    @GetMapping({"/v1/developer/tasks", "/api/v1/developer/tasks"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get tasks assigned to developer")
    public List<DeveloperDTOs.WorkItemDTO> getMyTasks(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String projectId,
            Authentication auth) {
        return developerService.getMyTasks(actor(auth), status, priority, projectId);
    }

    @PatchMapping({"/v1/developer/tasks/{taskId}/status", "/api/v1/developer/tasks/{taskId}/status"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Update task state and log note")
    public DeveloperDTOs.WorkItemDTO updateTaskStatus(
            @PathVariable String taskId,
            @RequestBody DeveloperDTOs.TaskStatusUpdateRequest req,
            Authentication auth) {
        return developerService.updateTaskStatus(actor(auth), taskId, req);
    }

    @GetMapping({"/v1/developer/tasks/{taskId}/blockers", "/api/v1/developer/tasks/{taskId}/blockers"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get blockers for a specific task")
    public List<TaskBlockerEntity> getTaskBlockers(@PathVariable String taskId, Authentication auth) {
        return developerService.getTaskBlockers(actor(auth), taskId);
    }

    @PostMapping({"/v1/developer/tasks/{taskId}/blockers", "/api/v1/developer/tasks/{taskId}/blockers"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Report a blocker on a task")
    public ResponseEntity<TaskBlockerEntity> submitBlocker(
            @PathVariable String taskId,
            @RequestBody DeveloperDTOs.TaskBlockerRequest req,
            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(developerService.submitTaskBlocker(actor(auth), taskId, req));
    }

    @PostMapping({"/v1/developer/blockers/{blockerId}/resolve", "/api/v1/developer/blockers/{blockerId}/resolve"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Resolve a task blocker")
    public TaskBlockerEntity resolveBlocker(@PathVariable String blockerId, Authentication auth) {
        return developerService.resolveTaskBlocker(actor(auth), blockerId);
    }

    @GetMapping({"/v1/developer/tasks/{taskId}/comments", "/api/v1/developer/tasks/{taskId}/comments"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get comments on a task")
    public List<TaskCommentEntity> getTaskComments(@PathVariable String taskId, Authentication auth) {
        return developerService.getTaskComments(actor(auth), taskId);
    }

    @PostMapping({"/v1/developer/tasks/{taskId}/comments", "/api/v1/developer/tasks/{taskId}/comments"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Add a comment to a task")
    public ResponseEntity<TaskCommentEntity> addTaskComment(
            @PathVariable String taskId,
            @RequestBody DeveloperDTOs.TaskCommentRequest req,
            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(developerService.addTaskComment(actor(auth), taskId, "Developer", req));
    }

    // 4. Check-Ins (Individual Mode)
    @PostMapping({"/v1/developer/check-ins", "/api/v1/developer/check-ins"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Submit an Individual check-in (same rules as POST /v1/projects/{id}/checkins: starts PENDING)")
    public ResponseEntity<com.prowise.project.ProgressDTOs.CheckIn> submitCheckIn(
            @RequestBody DeveloperDTOs.CheckInSubmissionRequest req,
            @org.springframework.web.bind.annotation.RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            Authentication auth) {
        // Task 2.2: one write path. The project's figure changes only when the Team Lead approves.
        return ResponseEntity.status(HttpStatus.CREATED).body(progressService.submit(auth, req.projectId(),
                new com.prowise.project.ProgressDTOs.CheckInRequest(req.percent(), req.accomplished(), req.nextSteps(),
                        req.blockers(), null, null, null, null), idempotencyKey));
    }

    @GetMapping({"/v1/developer/projects/{projectId}/check-ins", "/api/v1/developer/projects/{projectId}/check-ins"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get check-in history for a project")
    public List<ProjectCheckInEntity> getProjectCheckIns(@PathVariable String projectId, Authentication auth) {
        return developerService.getProjectCheckIns(actor(auth), projectId);
    }

    // 5. Sprints & Kanban
    @GetMapping({"/v1/developer/sprints", "/api/v1/developer/sprints"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get sprints and sprint tasks for Kanban board")
    public List<DeveloperDTOs.SprintDTO> getSprints(@RequestParam(required = false) String projectId, Authentication auth) {
        return developerService.getSprints(actor(auth), projectId);
    }

    // 6. Bugs & Issues
    @GetMapping({"/v1/developer/bugs", "/api/v1/developer/bugs"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "List bugs assigned or for project")
    public List<BugEntity> getBugs(@RequestParam(required = false) String projectId, Authentication auth) {
        return developerService.getBugs(actor(auth), projectId);
    }

    @PostMapping({"/v1/developer/bugs", "/api/v1/developer/bugs"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Report a new bug")
    public ResponseEntity<BugEntity> createBug(@RequestBody DeveloperDTOs.CreateBugRequest req, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(developerService.createBug(actor(auth), req));
    }

    @PatchMapping({"/v1/developer/bugs/{bugId}/status", "/api/v1/developer/bugs/{bugId}/status"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Update bug status")
    public BugEntity updateBugStatus(
            @PathVariable String bugId,
            @RequestBody DeveloperDTOs.UpdateBugStatusRequest req,
            Authentication auth) {
        return developerService.updateBugStatus(actor(auth), bugId, req);
    }

    // 7. Code Reviews
    @GetMapping({"/v1/developer/reviews", "/api/v1/developer/reviews"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get code reviews assigned to or authored by developer")
    public List<CodeReviewEntity> getReviews(@RequestParam(required = false) String type, Authentication auth) {
        return developerService.getCodeReviews(actor(auth), type);
    }

    @PostMapping({"/v1/developer/reviews/{reviewId}/decision", "/api/v1/developer/reviews/{reviewId}/decision"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Submit a decision on a code review (assigned reviewer only)")
    public CodeReviewEntity submitReviewDecision(
            @PathVariable String reviewId,
            @RequestBody DeveloperDTOs.CodeReviewDecisionRequest req,
            Authentication auth) {
        return developerService.submitReviewDecision(actor(auth), reviewId, req);
    }

    // 8. GitHub Activity
    @GetMapping({"/v1/developer/github/activity", "/api/v1/developer/github/activity"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get GitHub repository commits, PRs, and events (repo.read)")
    public List<GitHubActivityEntity> getGitHubActivity(
            @RequestParam(required = false) String repo,
            @RequestParam(required = false) String actor,
            Authentication auth) {
        return developerService.getGitHubActivity(actor(auth), repo, actor);
    }

    // 9. Calendar & Deadlines
    @GetMapping({"/v1/developer/calendar", "/api/v1/developer/calendar"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get developer calendar events and deadlines")
    public List<CalendarEventEntity> getCalendar(Authentication auth) {
        return developerService.getCalendarEvents(actor(auth));
    }

    @PostMapping({"/v1/developer/calendar", "/api/v1/developer/calendar"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Add an event or milestone deadline to calendar")
    public ResponseEntity<CalendarEventEntity> createCalendarEvent(
            @RequestBody DeveloperDTOs.CalendarEventRequest req,
            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(developerService.createCalendarEvent(actor(auth), req));
    }

    // 10. Team Collaboration / Discussions
    @GetMapping({"/v1/developer/discussions", "/api/v1/developer/discussions"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get discussions for readable projects")
    public List<DiscussionEntity> getDiscussions(@RequestParam(required = false) String projectId, Authentication auth) {
        return developerService.getDiscussions(actor(auth), projectId);
    }

    @PostMapping({"/v1/developer/discussions", "/api/v1/developer/discussions"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Start a new team discussion")
    public ResponseEntity<DiscussionEntity> createDiscussion(
            @RequestBody DeveloperDTOs.DiscussionPostRequest req,
            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(developerService.createDiscussion(actor(auth), "Developer", req));
    }

    @GetMapping({"/v1/developer/discussions/{discussionId}/messages", "/api/v1/developer/discussions/{discussionId}/messages"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get messages in a discussion")
    public List<DiscussionMessageEntity> getDiscussionMessages(@PathVariable String discussionId, Authentication auth) {
        return developerService.getDiscussionMessages(actor(auth), discussionId);
    }

    @PostMapping({"/v1/developer/discussions/{discussionId}/messages", "/api/v1/developer/discussions/{discussionId}/messages"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Post a message in a discussion")
    public ResponseEntity<DiscussionMessageEntity> postDiscussionMessage(
            @PathVariable String discussionId,
            @RequestBody DeveloperDTOs.DiscussionMessageRequest req,
            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(developerService.addDiscussionMessage(actor(auth), discussionId, "Developer", req.message()));
    }

    // 11. Files & Documents
    @GetMapping({"/v1/developer/files", "/api/v1/developer/files"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get file metadata in readable projects")
    public List<FileMetadataEntity> getFiles(
            @RequestParam(required = false) String projectId,
            @RequestParam(required = false) String workItemId,
            Authentication auth) {
        return developerService.getFiles(actor(auth), projectId, workItemId);
    }

    @PostMapping({"/v1/developer/files", "/api/v1/developer/files"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Save metadata of an uploaded file or document")
    public ResponseEntity<FileMetadataEntity> saveFileRecord(
            @RequestBody DeveloperDTOs.FileUploadRecordRequest req,
            Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(developerService.saveFileRecord(actor(auth), req));
    }

    // 12. Notifications
    @GetMapping({"/v1/developer/notifications", "/api/v1/developer/notifications"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get the caller's notifications in the selected organization")
    public List<DeveloperNotificationEntity> getNotifications(
            @RequestParam(required = false) Boolean unreadOnly,
            Authentication auth) {
        return developerService.getNotifications(actor(auth), unreadOnly);
    }

    @PatchMapping({"/v1/developer/notifications/{id}/read", "/api/v1/developer/notifications/{id}/read"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Mark one of the caller's notifications as read")
    public ResponseEntity<Void> markNotificationRead(@PathVariable String id, Authentication auth) {
        developerService.markNotificationRead(actor(auth), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping({"/v1/developer/notifications/read-all", "/api/v1/developer/notifications/read-all"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Mark all of the caller's notifications as read")
    public ResponseEntity<Void> markAllNotificationsRead(Authentication auth) {
        developerService.markAllNotificationsRead(actor(auth));
        return ResponseEntity.noContent().build();
    }

    // 13. Reports
    @GetMapping({"/v1/developer/reports/summary", "/api/v1/developer/reports/summary"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get developer metrics for readable projects in the selected organization")
    public DeveloperDTOs.DeveloperReportsSummaryDTO getReportsSummary(Authentication auth) {
        return developerService.getReportsSummary(actor(auth));
    }

    // 14. Preferences & Settings
    @GetMapping({"/v1/developer/preferences", "/api/v1/developer/preferences"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get developer personal settings and notification preferences")
    public DeveloperPreferenceEntity getPreferences(Authentication auth) {
        return developerService.getPreferences(actor(auth));
    }

    @PutMapping({"/v1/developer/preferences", "/api/v1/developer/preferences"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Update developer personal settings and notification preferences")
    public DeveloperPreferenceEntity updatePreferences(
            @RequestBody DeveloperDTOs.PreferenceUpdateRequest req,
            Authentication auth) {
        return developerService.updatePreferences(actor(auth), req);
    }
}
