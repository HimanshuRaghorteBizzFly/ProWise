

package com.prowise.developer;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.developer.DeveloperAccess.Actor;

/**
 * Developer workspace. Task 1.3 rules apply to every method:
 * the organization comes from the caller's org-bound token ({@link Actor}), every lookup is org-scoped,
 * objects outside readable projects are 404, and actions need the key plus the object relationship.
 * Business behaviour is unchanged from the original panel; its domain rules belong to phases 2-5.
 */
@Service
@Transactional
public class DeveloperService {

    // Work-flow writes go through JDBC; refresh managed entities so responses show the stored row.
    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    private final ProjectRepository projectRepository;
    private final WorkItemRepository workItemRepository;
    private final SprintRepository sprintRepository;
    private final TaskCommentRepository taskCommentRepository;
    private final TaskBlockerRepository taskBlockerRepository;
    private final ProjectCheckInRepository projectCheckInRepository;
    private final BugRepository bugRepository;
    private final BugCommentRepository bugCommentRepository;
    private final CodeReviewRepository codeReviewRepository;
    private final CodeReviewCommentRepository codeReviewCommentRepository;
    private final GitHubActivityRepository gitHubActivityRepository;
    private final CalendarEventRepository calendarEventRepository;
    private final DiscussionRepository discussionRepository;
    private final DiscussionMessageRepository discussionMessageRepository;
    private final FileMetadataRepository fileMetadataRepository;
    private final DeveloperNotificationRepository developerNotificationRepository;
    private final DeveloperPreferenceRepository developerPreferenceRepository;
    private final DeveloperAccess access;
    private final com.prowise.work.WorkflowService workflow;
    private final com.prowise.work.BlockerService blockers;

    public DeveloperService(
            ProjectRepository projectRepository,
            WorkItemRepository workItemRepository,
            SprintRepository sprintRepository,
            TaskCommentRepository taskCommentRepository,
            TaskBlockerRepository taskBlockerRepository,
            ProjectCheckInRepository projectCheckInRepository,
            BugRepository bugRepository,
            BugCommentRepository bugCommentRepository,
            CodeReviewRepository codeReviewRepository,
            CodeReviewCommentRepository codeReviewCommentRepository,
            GitHubActivityRepository gitHubActivityRepository,
            CalendarEventRepository calendarEventRepository,
            DiscussionRepository discussionRepository,
            DiscussionMessageRepository discussionMessageRepository,
            FileMetadataRepository fileMetadataRepository,
            DeveloperNotificationRepository developerNotificationRepository,
            DeveloperPreferenceRepository developerPreferenceRepository,
            DeveloperAccess access,
            com.prowise.work.WorkflowService workflow,
            com.prowise.work.BlockerService blockers) {
        this.workflow = workflow;
        this.blockers = blockers;
        this.projectRepository = projectRepository;
        this.workItemRepository = workItemRepository;
        this.sprintRepository = sprintRepository;
        this.taskCommentRepository = taskCommentRepository;
        this.taskBlockerRepository = taskBlockerRepository;
        this.projectCheckInRepository = projectCheckInRepository;
        this.bugRepository = bugRepository;
        this.bugCommentRepository = bugCommentRepository;
        this.codeReviewRepository = codeReviewRepository;
        this.codeReviewCommentRepository = codeReviewCommentRepository;
        this.gitHubActivityRepository = gitHubActivityRepository;
        this.calendarEventRepository = calendarEventRepository;
        this.discussionRepository = discussionRepository;
        this.discussionMessageRepository = discussionMessageRepository;
        this.fileMetadataRepository = fileMetadataRepository;
        this.developerNotificationRepository = developerNotificationRepository;
        this.developerPreferenceRepository = developerPreferenceRepository;
        this.access = access;
    }

    // ==========================================
    // Access helpers
    // ==========================================

    /** Projects the actor is assigned to AND may read, in the actor's organization only. */
    private List<ProjectEntity> readableAssignedProjects(Actor actor) {
        return projectRepository.findAssignedProjectsInOrg(actor.orgId(), actor.userId()).stream()
                .filter(p -> access.canRead(actor, p.getId()))
                .toList();
    }

    private List<String> readableProjectIds(Actor actor) {
        return readableAssignedProjects(actor).stream().map(ProjectEntity::getId).toList();
    }

    private ProjectEntity visibleProject(Actor actor, String projectId) {
        ProjectEntity project = projectId == null ? null
                : projectRepository.findByIdAndOrgId(projectId, actor.orgId()).orElse(null);
        if (project == null) throw access.notFound(actor, "PROJECT", projectId);
        access.requireVisible(actor, "PROJECT", projectId, project.getId());
        return project;
    }

    private WorkItemEntity visibleTask(Actor actor, String taskId) {
        WorkItemEntity item = taskId == null ? null
                : workItemRepository.findByIdAndOrgId(taskId, actor.orgId()).orElse(null);
        if (item == null) throw access.notFound(actor, "TASK", taskId);
        access.requireVisible(actor, "TASK", taskId, item.getProjectId());
        return item;
    }

    /** task.update on the project, and the caller is the assignee or may assign work there. */
    private void requireTaskEdit(Actor actor, WorkItemEntity item) {
        if (workItemRepository.countBreakdownItems(item.getId()) > 0) {
            // Breakdown tasks change only through submit / review / reopen (task 3.3): no direct Done, no PR shortcut.
            throw new com.prowise.common.api.ApiException(org.springframework.http.HttpStatus.CONFLICT, "USE_TASK_REVIEW",
                    "This task follows the review flow: submit it for review instead.");
        }
        access.requireAction(actor, item.getProjectId(), PermissionKey.TASK_UPDATE);
        boolean assignee = actor.userId().equals(item.getPrimaryAssigneeId());
        if (!assignee && !access.can(actor, item.getProjectId(), PermissionKey.TASK_ASSIGN)) {
            throw PermissionService.forbidden();
        }
    }

    // ==========================================
    // 1. DASHBOARD SUMMARY
    // ==========================================
    @Transactional(readOnly = true)
    public DeveloperDTOs.DashboardSummaryDTO getDashboardSummary(Actor actor) {
        List<ProjectEntity> projects = readableAssignedProjects(actor);
        List<String> readable = projects.stream().map(ProjectEntity::getId).toList();

        long activeProjectsCount = projects.stream()
                .filter(p -> "ACTIVE".equalsIgnoreCase(p.getStatus()) || "IN_PROGRESS".equalsIgnoreCase(p.getStatus()))
                .count();

        List<WorkItemEntity> myWorkItems = myTasksIn(actor, readable);

        long completedTasks = myWorkItems.stream().filter(w -> "DONE".equalsIgnoreCase(w.getState())).count();
        long pendingTasks = myWorkItems.size() - completedTasks;

        Instant now = Instant.now();
        long overdueTasks = myWorkItems.stream()
                .filter(w -> !"DONE".equalsIgnoreCase(w.getState()) && w.getDueDate() != null && w.getDueDate().isBefore(now))
                .count();

        long openBugs = bugRepository.countOpenAssigned(actor.orgId(), actor.userId());
        long pendingReviews = codeReviewRepository.countByOrgIdAndReviewerIdAndStatus(actor.orgId(), actor.userId(), "PENDING");
        long unreadNotifications = developerNotificationRepository.countByOrgIdAndUserIdAndReadFalse(actor.orgId(), actor.userId());

        List<DeveloperDTOs.WorkItemDTO> todayTasks = myWorkItems.stream()
                .filter(w -> !"DONE".equalsIgnoreCase(w.getState()))
                .limit(5)
                .map(this::mapWorkItemToDTO)
                .toList();

        List<DeveloperDTOs.WorkItemDTO> priorityTasks = myWorkItems.stream()
                .filter(w -> ("HIGH".equalsIgnoreCase(w.getPriority()) || "CRITICAL".equalsIgnoreCase(w.getPriority())) && !"DONE".equalsIgnoreCase(w.getState()))
                .limit(5)
                .map(this::mapWorkItemToDTO)
                .toList();

        List<DeveloperDTOs.WorkItemDTO> blockedTasks = myWorkItems.stream()
                .filter(w -> w.isBlocked())
                .map(this::mapWorkItemToDTO)
                .toList();

        java.util.Map<String, String> projectKeys = new java.util.HashMap<>();
        projects.forEach(p -> projectKeys.put(p.getId(), p.getKey()));
        List<DeveloperDTOs.DeadlineItemDTO> upcomingDeadlines = myWorkItems.stream()
                .filter(w -> w.getDueDate() != null && !"DONE".equalsIgnoreCase(w.getState()))
                .sorted((a, b) -> a.getDueDate().compareTo(b.getDueDate()))
                .limit(6)
                .map(w -> new DeveloperDTOs.DeadlineItemDTO(
                        w.getId(), w.getTitle(), w.getKey(), projectKeys.get(w.getProjectId()), w.getProjectId(),
                        w.getDueDate(), w.getPriority(), w.getState()))
                .toList();

        List<GitHubActivityEntity> recentGit = access.canAtOrg(actor, PermissionKey.REPO_READ)
                ? gitHubActivityRepository.findByOrgIdOrderByCreatedAtDesc(actor.orgId()).stream().limit(8).toList()
                : List.of();

        return new DeveloperDTOs.DashboardSummaryDTO(
                projects.size(), activeProjectsCount, myWorkItems.size(), completedTasks, pendingTasks, overdueTasks,
                openBugs, pendingReviews, unreadNotifications, todayTasks, priorityTasks, blockedTasks,
                upcomingDeadlines, recentGit);
    }

    private List<WorkItemEntity> myTasksIn(Actor actor, List<String> readableProjectIds) {
        return workItemRepository.findByOrgIdAndPrimaryAssigneeId(actor.orgId(), actor.userId()).stream()
                .filter(t -> readableProjectIds.contains(t.getProjectId()))
                .toList();
    }

    // ==========================================
    // 2. ASSIGNED PROJECTS & PROGRESS TRACKER
    // ==========================================
    @Transactional(readOnly = true)
    public List<DeveloperDTOs.ProjectDTO> getAssignedProjects(Actor actor) {
        List<DeveloperDTOs.ProjectDTO> dtoList = new ArrayList<>();
        for (ProjectEntity p : readableAssignedProjects(actor)) {
            dtoList.add(toProjectDTO(actor, p));
        }
        return dtoList;
    }

    @Transactional(readOnly = true)
    public DeveloperDTOs.ProjectDTO getProjectDetails(Actor actor, String projectId) {
        return toProjectDTO(actor, visibleProject(actor, projectId));
    }

    private DeveloperDTOs.ProjectDTO toProjectDTO(Actor actor, ProjectEntity p) {
        Instant now = Instant.now();
        List<WorkItemEntity> pTasks = workItemRepository.findByOrgIdAndProjectId(actor.orgId(), p.getId());
        long blockedCount = pTasks.stream().filter(t -> t.isBlocked()).count();
        long overdueCount = pTasks.stream().filter(t -> t.getDueDate() != null && t.getDueDate().isBefore(now) && !"DONE".equalsIgnoreCase(t.getState())).count();
        Optional<ProjectCheckInEntity> latestCheckIn = projectCheckInRepository.findTop1ByOrgIdAndProjectIdOrderByCreatedAtDesc(actor.orgId(), p.getId());

        // Structured: the latest calculated snapshot (task 3.5); Individual: the latest approved check-in (task 2.2).
        BigDecimal progressPercent = p.getLastProgressPercent();
        return new DeveloperDTOs.ProjectDTO(
                p.getId(), p.getOrgId(), p.getName(), p.getCode(), p.getDescription(), p.getMode(), p.getStatus(),
                progressPercent, p.getTargetCompletionDate(), // null stays "Not reported", never 0 (rule 9)
                p.getAccountableOwnerId(), p.getMemberIds(), p.getTotalWeight(), p.getCompletedWeight(),
                blockedCount, overdueCount, latestCheckIn.orElse(null));
    }

    /**
     * Structured progress as last calculated from accepted work in the active baseline (task 3.5, written with every
     * material change). Never derived from task counts or unapproved weights here (rule 9); null = Not measurable.
     */
    public BigDecimal calculateStructuredProgress(UUID orgId, String projectId) {
        return projectRepository.findByIdAndOrgId(projectId, orgId).map(ProjectEntity::getLastProgressPercent).orElse(null);
    }

    // ==========================================
    // 3. TASKS & WORK ITEMS
    // ==========================================
    @Transactional(readOnly = true)
    public List<DeveloperDTOs.WorkItemDTO> getMyTasks(Actor actor, String status, String priority, String projectId) {
        return myTasksIn(actor, readableProjectIds(actor)).stream()
                .filter(t -> status == null || status.isBlank() || status.equalsIgnoreCase("ALL") || status.equalsIgnoreCase(t.getState()))
                .filter(t -> priority == null || priority.isBlank() || priority.equalsIgnoreCase("ALL") || priority.equalsIgnoreCase(t.getPriority()))
                .filter(t -> projectId == null || projectId.isBlank() || projectId.equalsIgnoreCase("ALL") || projectId.equalsIgnoreCase(t.getProjectId()))
                .map(this::mapWorkItemToDTO)
                .toList();
    }

    public DeveloperDTOs.WorkItemDTO updateTaskStatus(Actor actor, String taskId, DeveloperDTOs.TaskStatusUpdateRequest req) {
        WorkItemEntity item = visibleTask(actor, taskId);
        requireTaskEdit(actor, item);

        String oldState = item.getState();
        String newState = req.state() == null ? "" : req.state().toUpperCase();
        // Task 3.3: the same workflow rules as /v1/work-items (start and submit only; Done needs review or checks).
        workflow.legacyTransition(actor.authentication(), taskId, newState, req.note());
        WorkItemEntity saved = reload(item);

        if (req.note() != null && !req.note().isBlank()) {
            TaskCommentEntity comment = new TaskCommentEntity();
            comment.setId("cm-" + UUID.randomUUID().toString().substring(0, 8));
            comment.setOrgId(actor.orgId());
            comment.setTaskId(item.getId());
            comment.setAuthorId(actor.userId());
            comment.setAuthorName("Developer");
            comment.setComment("Status changed from " + oldState + " to " + newState + ": " + req.note());
            comment.setCreatedAt(Instant.now());
            taskCommentRepository.save(comment);
        }

        return mapWorkItemToDTO(saved);
    }

    private static final java.util.Set<String> BUG_SEVERITIES = java.util.Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL");
    private static final java.util.Set<String> BUG_STATUSES = java.util.Set.of("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED");

    private static com.prowise.common.api.ApiException invalid(String field, String message) {
        return new com.prowise.common.api.ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "VALIDATION_FAILED",
                "The request has invalid fields.", List.of(new com.prowise.common.api.ApiError.FieldError(field, message)));
    }

    private <T> T reload(T entity) {
        if (entityManager != null && entityManager.contains(entity)) entityManager.refresh(entity);
        return entity;
    }

    public TaskBlockerEntity submitTaskBlocker(Actor actor, String taskId, DeveloperDTOs.TaskBlockerRequest req) {
        WorkItemEntity item = visibleTask(actor, taskId);
        requireTaskEdit(actor, item);

        // Task 3.4: the same rules as /v1/work-items/{id}/blockers (separate flag, owner, two severities, audit).
        String severity = "CRITICAL".equalsIgnoreCase(req.severity()) ? "CRITICAL" : "NORMAL";
        com.prowise.work.BlockerService.BlockerView raised = blockers.raise(actor.authentication(), item.getId(),
                new com.prowise.work.BlockerService.RaiseRequest(req.reason(), severity, null));
        return taskBlockerRepository.findByIdAndOrgId(raised.id(), actor.orgId()).orElseThrow();
    }

    public TaskBlockerEntity resolveTaskBlocker(Actor actor, String blockerId) {
        TaskBlockerEntity blocker = blockerId == null ? null
                : taskBlockerRepository.findByIdAndOrgId(blockerId, actor.orgId()).orElse(null);
        if (blocker == null) throw access.notFound(actor, "BLOCKER", blockerId);
        WorkItemEntity item = visibleTask(actor, blocker.getTaskId());
        requireTaskEdit(actor, item);
        blockers.resolve(actor.authentication(), blockerId, new com.prowise.work.BlockerService.ResolveRequest(null));
        return reload(blocker);
    }

    public TaskCommentEntity addTaskComment(Actor actor, String taskId, String authorName, DeveloperDTOs.TaskCommentRequest req) {
        WorkItemEntity item = visibleTask(actor, taskId);
        TaskCommentEntity comment = new TaskCommentEntity();
        comment.setId("cm-" + UUID.randomUUID().toString().substring(0, 8));
        comment.setOrgId(actor.orgId());
        comment.setTaskId(item.getId());
        comment.setAuthorId(actor.userId());
        comment.setAuthorName(authorName != null ? authorName : "Developer");
        comment.setComment(req.comment());
        comment.setCreatedAt(Instant.now());
        return taskCommentRepository.save(comment);
    }

    @Transactional(readOnly = true)
    public List<TaskCommentEntity> getTaskComments(Actor actor, String taskId) {
        WorkItemEntity item = visibleTask(actor, taskId);
        return taskCommentRepository.findByOrgIdAndTaskIdOrderByCreatedAtAsc(actor.orgId(), item.getId());
    }

    @Transactional(readOnly = true)
    public List<TaskBlockerEntity> getTaskBlockers(Actor actor, String taskId) {
        WorkItemEntity item = visibleTask(actor, taskId);
        return taskBlockerRepository.findByOrgIdAndTaskIdOrderByCreatedAtDesc(actor.orgId(), item.getId());
    }

    // ==========================================
    // 4. CHECK-INS (INDIVIDUAL MODE)
    // ==========================================
    // Submitting is task 2.2 ProgressService.submit (one write path, starts PENDING); this service only reads.
    @Transactional(readOnly = true)
    public List<ProjectCheckInEntity> getProjectCheckIns(Actor actor, String projectId) {
        ProjectEntity project = visibleProject(actor, projectId);
        return projectCheckInRepository.findByOrgIdAndProjectIdOrderByCreatedAtDesc(actor.orgId(), project.getId());
    }

    // ==========================================
    // 5. SPRINTS & KANBAN
    // ==========================================
    @Transactional(readOnly = true)
    public List<DeveloperDTOs.SprintDTO> getSprints(Actor actor, String projectId) {
        List<SprintEntity> sprints = projectId != null && !projectId.isBlank()
                ? sprintRepository.findByOrgIdAndProjectId(actor.orgId(), visibleProject(actor, projectId).getId())
                : sprintRepository.findByOrgIdAndProjectIdIn(actor.orgId(), readableProjectIds(actor));

        List<DeveloperDTOs.SprintDTO> result = new ArrayList<>();
        for (SprintEntity s : sprints) {
            List<WorkItemEntity> tasks = workItemRepository.findByOrgIdAndSprintId(actor.orgId(), s.getId());
            result.add(new DeveloperDTOs.SprintDTO(
                    s.getId(), s.getProjectId(), s.getName(), s.getGoal(), s.getStatus(), s.getStartDate(), s.getEndDate(),
                    tasks.stream().map(this::mapWorkItemToDTO).toList()));
        }
        return result;
    }

    // ==========================================
    // 6. BUGS & ISSUES
    // ==========================================
    @Transactional(readOnly = true)
    public List<BugEntity> getBugs(Actor actor, String projectId) {
        if (projectId != null && !projectId.isBlank()) {
            return bugRepository.findByOrgIdAndProjectId(actor.orgId(), visibleProject(actor, projectId).getId());
        }
        List<String> readable = readableProjectIds(actor);
        return bugRepository.findByOrgIdAndAssignedTo(actor.orgId(), actor.userId()).stream()
                .filter(b -> readable.contains(b.getProjectId()))
                .toList();
    }

    public BugEntity createBug(Actor actor, DeveloperDTOs.CreateBugRequest req) {
        ProjectEntity project = visibleProject(actor, req.projectId());
        if (!access.can(actor, project.getId(), PermissionKey.TASK_UPDATE)
                && !access.can(actor, project.getId(), PermissionKey.TASK_REVIEW)) {
            throw PermissionService.forbidden();
        }
        String title = req.title() == null ? "" : req.title().trim();
        if (title.isEmpty()) throw invalid("title", "is required");
        if (title.length() > 200) throw invalid("title", "is longer than 200 characters");
        String severity = req.severity() == null || req.severity().isBlank() ? "MEDIUM" : req.severity().trim().toUpperCase(java.util.Locale.ROOT);
        if (!BUG_SEVERITIES.contains(severity)) throw invalid("severity", "must be LOW, MEDIUM, HIGH or CRITICAL");
        BugEntity bug = new BugEntity();
        bug.setId("bug-" + UUID.randomUUID().toString().substring(0, 8));
        bug.setOrgId(actor.orgId());
        bug.setProjectId(project.getId());
        bug.setTitle(title);
        bug.setDescription(req.description());
        bug.setSeverity(severity);
        bug.setStatus("OPEN");
        bug.setReportedBy(actor.userId());
        // The reporter owns the issue: an assignee id from the request body is never trusted (it could name anyone).
        bug.setAssignedTo(actor.userId());
        bug.setReproductionSteps(req.reproductionSteps());
        bug.setEnvironment(req.environment());
        bug.setCreatedAt(Instant.now());
        return bugRepository.save(bug);
    }

    public BugEntity updateBugStatus(Actor actor, String bugId, DeveloperDTOs.UpdateBugStatusRequest req) {
        BugEntity bug = bugId == null ? null : bugRepository.findByIdAndOrgId(bugId, actor.orgId()).orElse(null);
        if (bug == null) throw access.notFound(actor, "BUG", bugId);
        access.requireVisible(actor, "BUG", bugId, bug.getProjectId());
        access.requireAction(actor, bug.getProjectId(), PermissionKey.TASK_UPDATE);
        if (!actor.userId().equals(bug.getAssignedTo()) && !access.can(actor, bug.getProjectId(), PermissionKey.TASK_ASSIGN)) {
            throw PermissionService.forbidden();
        }
        String status = req.status() == null ? "" : req.status().trim().toUpperCase(java.util.Locale.ROOT);
        if (!BUG_STATUSES.contains(status)) throw invalid("status", "must be OPEN, IN_PROGRESS, RESOLVED, CLOSED or REOPENED");
        bug.setStatus(status);
        if (req.resolution() != null) {
            bug.setResolution(req.resolution());
        }
        if ("RESOLVED".equals(status) || "CLOSED".equals(status)) {
            bug.setResolvedAt(Instant.now());
        }
        return bugRepository.save(bug);
    }

    // ==========================================
    // 7. CODE REVIEWS
    // ==========================================
    @Transactional(readOnly = true)
    public List<CodeReviewEntity> getCodeReviews(Actor actor, String type) {
        List<CodeReviewEntity> combined = new ArrayList<>();
        if (!"authored".equalsIgnoreCase(type)) {
            combined.addAll(codeReviewRepository.findByOrgIdAndReviewerId(actor.orgId(), actor.userId()));
        }
        if (!"assigned".equalsIgnoreCase(type)) {
            combined.addAll(codeReviewRepository.findByOrgIdAndAuthorId(actor.orgId(), actor.userId()));
        }
        return combined.stream().distinct().filter(r -> access.canRead(actor, r.getProjectId())).toList();
    }

    public CodeReviewEntity submitReviewDecision(Actor actor, String reviewId, DeveloperDTOs.CodeReviewDecisionRequest req) {
        CodeReviewEntity review = reviewId == null ? null
                : codeReviewRepository.findByIdAndOrgId(reviewId, actor.orgId()).orElse(null);
        if (review == null) throw access.notFound(actor, "REVIEW", reviewId);
        access.requireVisible(actor, "REVIEW", reviewId, review.getProjectId());
        access.requireAction(actor, review.getProjectId(), PermissionKey.TASK_REVIEW);
        if (!actor.userId().equals(review.getReviewerId())) {
            throw PermissionService.forbidden(); // only the assigned reviewer decides
        }

        review.setStatus(req.decision().toUpperCase());
        review.setUpdatedAt(Instant.now());

        if (req.feedback() != null && !req.feedback().isBlank()) {
            CodeReviewCommentEntity comment = new CodeReviewCommentEntity();
            comment.setId("crc-" + UUID.randomUUID().toString().substring(0, 8));
            comment.setOrgId(actor.orgId());
            comment.setReviewId(review.getId());
            comment.setAuthorId(actor.userId());
            comment.setAuthorName("Reviewer");
            comment.setComment(req.feedback());
            comment.setCreatedAt(Instant.now());
            codeReviewCommentRepository.save(comment);
        }

        if ("APPROVED".equalsIgnoreCase(req.decision()) && review.getWorkItemId() != null
                && workItemRepository.countBreakdownItems(review.getWorkItemId()) == 0) { // a merged PR never replaces review (AS-03)
            workItemRepository.findByIdAndOrgId(review.getWorkItemId(), actor.orgId()).ifPresent(item -> {
                item.setState("DONE");
                item.setUpdatedAt(Instant.now());
                workItemRepository.save(item);
            });
        }
        return codeReviewRepository.save(review);
    }

    // ==========================================
    // 8. GITHUB ACTIVITY (evidence only; requires repo.read in the organization)
    // ==========================================
    @Transactional(readOnly = true)
    public List<GitHubActivityEntity> getGitHubActivity(Actor actor, String repo, String gitActor) {
        access.requireAtOrg(actor, PermissionKey.REPO_READ);
        if (repo != null && !repo.isBlank()) {
            return gitHubActivityRepository.findByOrgIdAndRepositoryNameOrderByCreatedAtDesc(actor.orgId(), repo);
        } else if (gitActor != null && !gitActor.isBlank()) {
            return gitHubActivityRepository.findByOrgIdAndActorOrderByCreatedAtDesc(actor.orgId(), gitActor);
        }
        return gitHubActivityRepository.findByOrgIdOrderByCreatedAtDesc(actor.orgId());
    }

    // ==========================================
    // 9. CALENDAR & DEADLINES (own events in the selected organization)
    // ==========================================
    @Transactional(readOnly = true)
    public List<CalendarEventEntity> getCalendarEvents(Actor actor) {
        return calendarEventRepository.findByOrgIdAndUserIdOrderByStartTimeAsc(actor.orgId(), actor.userId());
    }

    public CalendarEventEntity createCalendarEvent(Actor actor, DeveloperDTOs.CalendarEventRequest req) {
        String projectId = req.projectId() == null || req.projectId().isBlank() ? null
                : visibleProject(actor, req.projectId()).getId();
        CalendarEventEntity event = new CalendarEventEntity();
        event.setId("evt-" + UUID.randomUUID().toString().substring(0, 8));
        event.setOrgId(actor.orgId());
        event.setUserId(actor.userId());
        event.setProjectId(projectId);
        event.setTitle(req.title());
        event.setDescription(req.description());
        event.setEventType(req.eventType() != null ? req.eventType().toUpperCase() : "TASK_DUE");
        event.setStartTime(req.startTime() != null ? req.startTime() : Instant.now());
        event.setEndTime(req.endTime());
        event.setAllDay(req.allDay());
        event.setUrl(req.url());
        event.setCreatedAt(Instant.now());
        return calendarEventRepository.save(event);
    }

    // ==========================================
    // 10. DISCUSSIONS & MESSAGES
    // ==========================================
    @Transactional(readOnly = true)
    public List<DiscussionEntity> getDiscussions(Actor actor, String projectId) {
        if (projectId != null && !projectId.isBlank()) {
            return discussionRepository.findByOrgIdAndProjectIdOrderByUpdatedAtDesc(actor.orgId(),
                    visibleProject(actor, projectId).getId());
        }
        return discussionRepository.findByOrgIdAndProjectIdInOrderByUpdatedAtDesc(actor.orgId(), readableProjectIds(actor));
    }

    public DiscussionEntity createDiscussion(Actor actor, String authorName, DeveloperDTOs.DiscussionPostRequest req) {
        ProjectEntity project = visibleProject(actor, req.projectId());
        DiscussionEntity disc = new DiscussionEntity();
        disc.setId("dsc-" + UUID.randomUUID().toString().substring(0, 8));
        disc.setOrgId(actor.orgId());
        disc.setProjectId(project.getId());
        disc.setTitle(req.title());
        disc.setCategory(req.category() != null ? req.category() : "GENERAL");
        disc.setAuthorId(actor.userId());
        disc.setCreatedAt(Instant.now());
        disc.setUpdatedAt(Instant.now());
        DiscussionEntity saved = discussionRepository.save(disc);

        if (req.initialMessage() != null && !req.initialMessage().isBlank()) {
            discussionMessageRepository.save(newMessage(actor, saved.getId(), authorName, req.initialMessage()));
        }
        return saved;
    }

    private DiscussionEntity visibleDiscussion(Actor actor, String discussionId) {
        DiscussionEntity discussion = discussionId == null ? null
                : discussionRepository.findByIdAndOrgId(discussionId, actor.orgId()).orElse(null);
        if (discussion == null) throw access.notFound(actor, "DISCUSSION", discussionId);
        access.requireVisible(actor, "DISCUSSION", discussionId, discussion.getProjectId());
        return discussion;
    }

    @Transactional(readOnly = true)
    public List<DiscussionMessageEntity> getDiscussionMessages(Actor actor, String discussionId) {
        DiscussionEntity discussion = visibleDiscussion(actor, discussionId);
        return discussionMessageRepository.findByOrgIdAndDiscussionIdOrderByCreatedAtAsc(actor.orgId(), discussion.getId());
    }

    public DiscussionMessageEntity addDiscussionMessage(Actor actor, String discussionId, String authorName, String message) {
        DiscussionEntity discussion = visibleDiscussion(actor, discussionId);
        discussion.setUpdatedAt(Instant.now());
        discussionRepository.save(discussion);
        return discussionMessageRepository.save(newMessage(actor, discussion.getId(), authorName, message));
    }

    private DiscussionMessageEntity newMessage(Actor actor, String discussionId, String authorName, String message) {
        DiscussionMessageEntity msg = new DiscussionMessageEntity();
        msg.setId("msg-" + UUID.randomUUID().toString().substring(0, 8));
        msg.setOrgId(actor.orgId());
        msg.setDiscussionId(discussionId);
        msg.setAuthorId(actor.userId());
        msg.setAuthorName(authorName != null ? authorName : "Developer");
        msg.setMessage(message);
        msg.setCreatedAt(Instant.now());
        return msg;
    }

    // ==========================================
    // 11. FILES & DOCUMENTS (metadata; TODO(4.4): scanning and signed, re-authorized downloads)
    // ==========================================
    @Transactional(readOnly = true)
    public List<FileMetadataEntity> getFiles(Actor actor, String projectId, String workItemId) {
        if (projectId != null && !projectId.isBlank()) {
            return fileMetadataRepository.findByOrgIdAndProjectIdOrderByCreatedAtDesc(actor.orgId(),
                    visibleProject(actor, projectId).getId());
        }
        if (workItemId != null && !workItemId.isBlank()) {
            WorkItemEntity item = visibleTask(actor, workItemId);
            return fileMetadataRepository.findByOrgIdAndProjectIdOrderByCreatedAtDesc(actor.orgId(), item.getProjectId())
                    .stream().filter(f -> item.getId().equals(f.getWorkItemId())).toList();
        }
        return fileMetadataRepository.findByOrgIdAndProjectIdInOrderByCreatedAtDesc(actor.orgId(), readableProjectIds(actor));
    }

    public FileMetadataEntity saveFileRecord(Actor actor, DeveloperDTOs.FileUploadRecordRequest req) {
        ProjectEntity project = visibleProject(actor, req.projectId());
        access.requireAction(actor, project.getId(), PermissionKey.TASK_UPDATE);
        String workItemId = null;
        if (req.workItemId() != null && !req.workItemId().isBlank()) {
            WorkItemEntity item = visibleTask(actor, req.workItemId());
            if (!project.getId().equals(item.getProjectId())) {
                throw access.notFound(actor, "TASK", req.workItemId());
            }
            workItemId = item.getId();
        }
        FileMetadataEntity file = new FileMetadataEntity();
        file.setId("fil-" + UUID.randomUUID().toString().substring(0, 8));
        file.setOrgId(actor.orgId());
        file.setProjectId(project.getId());
        file.setWorkItemId(workItemId);
        file.setFileName(req.fileName());
        file.setFileUrl(req.fileUrl());
        file.setFileSize(req.fileSize() != null ? req.fileSize() : 1024L);
        file.setContentType(req.contentType() != null ? req.contentType() : "application/octet-stream");
        file.setUploadedBy(actor.userId());
        file.setCreatedAt(Instant.now());
        return fileMetadataRepository.save(file);
    }

    // ==========================================
    // 12. NOTIFICATIONS (recipient + selected organization only)
    // ==========================================
    @Transactional(readOnly = true)
    public List<DeveloperNotificationEntity> getNotifications(Actor actor, Boolean unreadOnly) {
        if (Boolean.TRUE.equals(unreadOnly)) {
            return developerNotificationRepository.findByOrgIdAndUserIdAndReadFalseOrderByCreatedAtDesc(actor.orgId(), actor.userId());
        }
        return developerNotificationRepository.findByOrgIdAndUserIdOrderByCreatedAtDesc(actor.orgId(), actor.userId());
    }

    public void markNotificationRead(Actor actor, String notificationId) {
        DeveloperNotificationEntity notification = notificationId == null ? null
                : developerNotificationRepository.findByIdAndOrgIdAndUserId(notificationId, actor.orgId(), actor.userId())
                        .orElse(null);
        if (notification == null) throw access.notFound(actor, "NOTIFICATION", notificationId);
        notification.setRead(true);
        developerNotificationRepository.save(notification);
    }

    public void markAllNotificationsRead(Actor actor) {
        List<DeveloperNotificationEntity> unread =
                developerNotificationRepository.findByOrgIdAndUserIdAndReadFalseOrderByCreatedAtDesc(actor.orgId(), actor.userId());
        for (DeveloperNotificationEntity n : unread) {
            n.setRead(true);
        }
        developerNotificationRepository.saveAll(unread);
    }

    // ==========================================
    // 13. REPORTS & ANALYTICS (own work in readable projects)
    // ==========================================
    @Transactional(readOnly = true)
    public DeveloperDTOs.DeveloperReportsSummaryDTO getReportsSummary(Actor actor) {
        List<ProjectEntity> projects = readableAssignedProjects(actor);
        List<String> readable = projects.stream().map(ProjectEntity::getId).toList();
        List<WorkItemEntity> tasks = myTasksIn(actor, readable);

        long totalTasks = tasks.size();
        long completed = tasks.stream().filter(t -> "DONE".equalsIgnoreCase(t.getState())).count();
        long inProgress = tasks.stream().filter(t -> "IN_PROGRESS".equalsIgnoreCase(t.getState())).count();
        long inReview = tasks.stream().filter(t -> "IN_REVIEW".equalsIgnoreCase(t.getState())).count();
        long blocked = tasks.stream().filter(t -> t.isBlocked()).count();

        BigDecimal actualHours = tasks.stream()
                .map(t -> t.getActualHours() != null ? t.getActualHours() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal estimatedHours = tasks.stream()
                .map(t -> t.getEstimatedHours() != null ? t.getEstimatedHours() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<BugEntity> myBugs = bugRepository.findByOrgIdAndAssignedTo(actor.orgId(), actor.userId()).stream()
                .filter(b -> readable.contains(b.getProjectId())).toList();
        long openBugs = myBugs.stream().filter(b -> !"RESOLVED".equalsIgnoreCase(b.getStatus())).count();
        long resolvedBugs = myBugs.stream().filter(b -> "RESOLVED".equalsIgnoreCase(b.getStatus())).count();

        List<CodeReviewEntity> reviewsAuthored = codeReviewRepository.findByOrgIdAndAuthorId(actor.orgId(), actor.userId())
                .stream().filter(r -> readable.contains(r.getProjectId())).toList();
        List<CodeReviewEntity> reviewsDone = codeReviewRepository.findByOrgIdAndReviewerId(actor.orgId(), actor.userId()).stream()
                .filter(r -> readable.contains(r.getProjectId()))
                .filter(r -> "APPROVED".equalsIgnoreCase(r.getStatus()) || "MERGED".equalsIgnoreCase(r.getStatus()))
                .toList();

        List<DeveloperDTOs.ProjectContributionDTO> contributions = new ArrayList<>();
        for (ProjectEntity p : projects) {
            List<WorkItemEntity> pTasks = tasks.stream().filter(t -> p.getId().equals(t.getProjectId())).toList();
            long pCompleted = pTasks.stream().filter(t -> "DONE".equalsIgnoreCase(t.getState())).count();
            BigDecimal prog = "STRUCTURED".equalsIgnoreCase(p.getMode())
                    ? calculateStructuredProgress(actor.orgId(), p.getId())
                    : (p.getLastProgressPercent() != null ? p.getLastProgressPercent() : BigDecimal.ZERO);
            contributions.add(new DeveloperDTOs.ProjectContributionDTO(
                    p.getId(), p.getName(), p.getCode(), p.getMode(), pTasks.size(), pCompleted, prog));
        }

        return new DeveloperDTOs.DeveloperReportsSummaryDTO(
                totalTasks, completed, inProgress, inReview, blocked, actualHours, estimatedHours, openBugs,
                resolvedBugs, reviewsAuthored.size(), reviewsDone.size(), contributions);
    }

    // ==========================================
    // 14. SETTINGS & PREFERENCES (per person, not tenant data)
    // ==========================================
    @Transactional(readOnly = true)
    public DeveloperPreferenceEntity getPreferences(Actor actor) {
        return developerPreferenceRepository.findById(actor.userId()).orElseGet(() -> {
            DeveloperPreferenceEntity pref = new DeveloperPreferenceEntity();
            pref.setUserId(actor.userId());
            pref.setEmailNotifications(true);
            pref.setSlackNotifications(false);
            pref.setTheme("system");
            pref.setTimezone("America/New_York");
            pref.setUpdatedAt(Instant.now());
            return pref;
        });
    }

    public DeveloperPreferenceEntity updatePreferences(Actor actor, DeveloperDTOs.PreferenceUpdateRequest req) {
        DeveloperPreferenceEntity pref = developerPreferenceRepository.findById(actor.userId()).orElseGet(() -> {
            DeveloperPreferenceEntity p = new DeveloperPreferenceEntity();
            p.setUserId(actor.userId());
            return p;
        });
        pref.setEmailNotifications(req.emailNotifications());
        pref.setSlackNotifications(req.slackNotifications());
        pref.setTheme(req.theme() != null ? req.theme() : "system");
        pref.setGithubUsername(req.githubUsername());
        pref.setTimezone(req.timezone() != null ? req.timezone() : "America/New_York");
        pref.setUpdatedAt(Instant.now());
        return developerPreferenceRepository.save(pref);
    }

    // ==========================================
    // HELPER MAPPERS
    // ==========================================
    private DeveloperDTOs.WorkItemDTO mapWorkItemToDTO(WorkItemEntity item) {
        return new DeveloperDTOs.WorkItemDTO(
                item.getId(), item.getProjectId(), item.getOrgId(), item.getParentId(), item.getType(), item.getKey(),
                item.getTitle(), item.getDescription(), item.getPrimaryAssigneeId(), item.getReviewerId(), item.getState(),
                item.isBlocked(), item.getWeight(), item.getWeightUnit(), item.getCriteria(), item.getCurrentRevision(),
                item.getSubmittedRevision(), item.getDueDate(), item.getStartDate(), item.getEstimatedHours(),
                item.getActualHours(), item.getPriority(), item.getSprintId(), item.getCreatedAt(), item.getUpdatedAt());
    }

    /** Bug comments of a visible bug (kept org-scoped for when the bug detail API lands). */
    @Transactional(readOnly = true)
    public List<BugCommentEntity> getBugComments(Actor actor, String bugId) {
        BugEntity bug = bugId == null ? null : bugRepository.findByIdAndOrgId(bugId, actor.orgId()).orElse(null);
        if (bug == null) throw access.notFound(actor, "BUG", bugId);
        access.requireVisible(actor, "BUG", bugId, bug.getProjectId());
        return bugCommentRepository.findByOrgIdAndBugIdOrderByCreatedAtAsc(actor.orgId(), bug.getId());
    }
}
