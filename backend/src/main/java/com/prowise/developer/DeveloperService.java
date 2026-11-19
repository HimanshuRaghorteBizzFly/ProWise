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

@Service
@Transactional
public class DeveloperService {

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
            DeveloperPreferenceRepository developerPreferenceRepository) {
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
    }

    // ==========================================
    // 1. DASHBOARD SUMMARY
    // ==========================================
    @Transactional(readOnly = true)
    public DeveloperDTOs.DashboardSummaryDTO getDashboardSummary(String userId, UUID orgId) {
        List<ProjectEntity> projects = projectRepository.findAssignedProjectsByOrg(userId, orgId);
        if (projects.isEmpty() && orgId != null) {
            projects = projectRepository.findAssignedProjects(userId);
        }

        long activeProjectsCount = projects.stream()
                .filter(p -> "ACTIVE".equalsIgnoreCase(p.getStatus()) || "IN_PROGRESS".equalsIgnoreCase(p.getStatus()))
                .count();

        List<WorkItemEntity> myWorkItems = workItemRepository.findByPrimaryAssigneeId(userId);

        long completedTasks = myWorkItems.stream().filter(w -> "DONE".equalsIgnoreCase(w.getState())).count();
        long pendingTasks = myWorkItems.size() - completedTasks;

        Instant now = Instant.now();
        long overdueTasks = myWorkItems.stream()
                .filter(w -> !"DONE".equalsIgnoreCase(w.getState()) && w.getDueDate() != null && w.getDueDate().isBefore(now))
                .count();

        long openBugs = bugRepository.countByAssignedToAndStatusNot(userId, "RESOLVED");
        long pendingReviews = codeReviewRepository.countByReviewerIdAndStatus(userId, "PENDING");
        long unreadNotifications = developerNotificationRepository.countByUserIdAndReadFalse(userId);

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
                .filter(w -> w.isBlocked() || "BLOCKED".equalsIgnoreCase(w.getState()))
                .map(this::mapWorkItemToDTO)
                .toList();

        List<DeveloperDTOs.DeadlineItemDTO> upcomingDeadlines = myWorkItems.stream()
                .filter(w -> w.getDueDate() != null && !"DONE".equalsIgnoreCase(w.getState()))
                .sorted((a, b) -> a.getDueDate().compareTo(b.getDueDate()))
                .limit(6)
                .map(w -> new DeveloperDTOs.DeadlineItemDTO(
                        w.getId(),
                        w.getTitle(),
                        w.getKey(),
                        w.getProjectId(),
                        w.getDueDate(),
                        w.getPriority(),
                        w.getState()
                ))
                .toList();

        List<GitHubActivityEntity> recentGit = gitHubActivityRepository.findAllByOrderByCreatedAtDesc().stream()
                .limit(8)
                .toList();

        return new DeveloperDTOs.DashboardSummaryDTO(
                projects.size(),
                activeProjectsCount,
                myWorkItems.size(),
                completedTasks,
                pendingTasks,
                overdueTasks,
                openBugs,
                pendingReviews,
                unreadNotifications,
                todayTasks,
                priorityTasks,
                blockedTasks,
                upcomingDeadlines,
                recentGit
        );
    }

    // ==========================================
    // 2. ASSIGNED PROJECTS & PROGRESS TRACKER
    // ==========================================
    @Transactional(readOnly = true)
    public List<DeveloperDTOs.ProjectDTO> getAssignedProjects(String userId, UUID orgId) {
        List<ProjectEntity> projects = projectRepository.findAssignedProjectsByOrg(userId, orgId);
        if (projects.isEmpty() && orgId != null) {
            projects = projectRepository.findAssignedProjects(userId);
        }

        List<DeveloperDTOs.ProjectDTO> dtoList = new ArrayList<>();
        Instant now = Instant.now();

        for (ProjectEntity p : projects) {
            List<WorkItemEntity> pTasks = workItemRepository.findByProjectId(p.getId());
            long blockedCount = pTasks.stream().filter(t -> t.isBlocked() || "BLOCKED".equalsIgnoreCase(t.getState())).count();
            long overdueCount = pTasks.stream().filter(t -> t.getDueDate() != null && t.getDueDate().isBefore(now) && !"DONE".equalsIgnoreCase(t.getState())).count();

            Optional<ProjectCheckInEntity> latestCheckIn = projectCheckInRepository.findTop1ByProjectIdOrderByCreatedAtDesc(p.getId());

            BigDecimal progressPercent = p.getLastProgressPercent();
            if ("STRUCTURED".equalsIgnoreCase(p.getMode())) {
                progressPercent = calculateStructuredProgress(p.getId());
            }

            dtoList.add(new DeveloperDTOs.ProjectDTO(
                    p.getId(),
                    p.getOrgId(),
                    p.getName(),
                    p.getCode(),
                    p.getDescription(),
                    p.getMode(),
                    p.getStatus(),
                    progressPercent != null ? progressPercent : BigDecimal.ZERO,
                    p.getTargetCompletionDate(),
                    p.getAccountableOwnerId(),
                    p.getMemberIds(),
                    p.getTotalWeight(),
                    p.getCompletedWeight(),
                    blockedCount,
                    overdueCount,
                    latestCheckIn.orElse(null)
            ));
        }

        return dtoList;
    }

    @Transactional(readOnly = true)
    public Optional<DeveloperDTOs.ProjectDTO> getProjectDetails(String projectId, String userId) {
        return projectRepository.findById(projectId).map(p -> {
            List<WorkItemEntity> pTasks = workItemRepository.findByProjectId(p.getId());
            long blockedCount = pTasks.stream().filter(t -> t.isBlocked() || "BLOCKED".equalsIgnoreCase(t.getState())).count();
            long overdueCount = pTasks.stream().filter(t -> t.getDueDate() != null && t.getDueDate().isBefore(Instant.now()) && !"DONE".equalsIgnoreCase(t.getState())).count();
            Optional<ProjectCheckInEntity> latestCheckIn = projectCheckInRepository.findTop1ByProjectIdOrderByCreatedAtDesc(p.getId());

            BigDecimal progressPercent = p.getLastProgressPercent();
            if ("STRUCTURED".equalsIgnoreCase(p.getMode())) {
                progressPercent = calculateStructuredProgress(p.getId());
            }

            return new DeveloperDTOs.ProjectDTO(
                    p.getId(),
                    p.getOrgId(),
                    p.getName(),
                    p.getCode(),
                    p.getDescription(),
                    p.getMode(),
                    p.getStatus(),
                    progressPercent != null ? progressPercent : BigDecimal.ZERO,
                    p.getTargetCompletionDate(),
                    p.getAccountableOwnerId(),
                    p.getMemberIds(),
                    p.getTotalWeight(),
                    p.getCompletedWeight(),
                    blockedCount,
                    overdueCount,
                    latestCheckIn.orElse(null)
            );
        });
    }

    public BigDecimal calculateStructuredProgress(String projectId) {
        List<WorkItemEntity> workItems = workItemRepository.findByProjectId(projectId);
        if (workItems.isEmpty()) {
            return BigDecimal.ZERO;
        }

        BigDecimal totalWeight = BigDecimal.ZERO;
        BigDecimal completedWeight = BigDecimal.ZERO;

        for (WorkItemEntity item : workItems) {
            BigDecimal w = item.getWeight() != null ? item.getWeight() : BigDecimal.ONE;
            totalWeight = totalWeight.add(w);
            if ("DONE".equalsIgnoreCase(item.getState())) {
                completedWeight = completedWeight.add(w);
            }
        }

        if (totalWeight.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }

        return completedWeight.multiply(BigDecimal.valueOf(100))
                .divide(totalWeight, 2, RoundingMode.HALF_UP);
    }

    // ==========================================
    // 3. TASKS & WORK ITEMS
    // ==========================================
    @Transactional(readOnly = true)
    public List<DeveloperDTOs.WorkItemDTO> getMyTasks(String userId, String status, String priority, String projectId) {
        List<WorkItemEntity> tasks = workItemRepository.findByPrimaryAssigneeId(userId);

        return tasks.stream()
                .filter(t -> status == null || status.isBlank() || status.equalsIgnoreCase("ALL") || status.equalsIgnoreCase(t.getState()))
                .filter(t -> priority == null || priority.isBlank() || priority.equalsIgnoreCase("ALL") || priority.equalsIgnoreCase(t.getPriority()))
                .filter(t -> projectId == null || projectId.isBlank() || projectId.equalsIgnoreCase("ALL") || projectId.equalsIgnoreCase(t.getProjectId()))
                .map(this::mapWorkItemToDTO)
                .toList();
    }

    public DeveloperDTOs.WorkItemDTO updateTaskStatus(String taskId, String userId, DeveloperDTOs.TaskStatusUpdateRequest req) {
        WorkItemEntity item = workItemRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));

        String oldState = item.getState();
        String newState = req.state().toUpperCase();
        item.setState(newState);

        if ("IN_REVIEW".equalsIgnoreCase(newState)) {
            item.setSubmittedRevision(item.getCurrentRevision());
        }

        if ("DONE".equalsIgnoreCase(newState)) {
            item.setBlocked(false);
        }

        item.setUpdatedAt(Instant.now());
        WorkItemEntity saved = workItemRepository.save(item);

        if (req.note() != null && !req.note().isBlank()) {
            TaskCommentEntity comment = new TaskCommentEntity();
            comment.setId("cm-" + UUID.randomUUID().toString().substring(0, 8));
            comment.setTaskId(taskId);
            comment.setAuthorId(userId);
            comment.setAuthorName("Developer");
            comment.setComment("Status changed from " + oldState + " to " + newState + ": " + req.note());
            comment.setCreatedAt(Instant.now());
            taskCommentRepository.save(comment);
        }

        // Recalculate Structured Project progress if applicable
        projectRepository.findById(item.getProjectId()).ifPresent(p -> {
            if ("STRUCTURED".equalsIgnoreCase(p.getMode())) {
                BigDecimal progress = calculateStructuredProgress(p.getId());
                p.setLastProgressPercent(progress);
                p.setUpdatedAt(Instant.now());
                projectRepository.save(p);
            }
        });

        return mapWorkItemToDTO(saved);
    }

    public TaskBlockerEntity submitTaskBlocker(String taskId, String userId, DeveloperDTOs.TaskBlockerRequest req) {
        WorkItemEntity item = workItemRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));

        item.setBlocked(true);
        item.setState("BLOCKED");
        item.setUpdatedAt(Instant.now());
        workItemRepository.save(item);

        TaskBlockerEntity blocker = new TaskBlockerEntity();
        blocker.setId("blk-" + UUID.randomUUID().toString().substring(0, 8));
        blocker.setTaskId(taskId);
        blocker.setReason(req.reason());
        blocker.setSeverity(req.severity() != null ? req.severity().toUpperCase() : "HIGH");
        blocker.setResolved(false);
        blocker.setCreatedAt(Instant.now());

        return taskBlockerRepository.save(blocker);
    }

    public TaskBlockerEntity resolveTaskBlocker(String blockerId, String userId) {
        TaskBlockerEntity blocker = taskBlockerRepository.findById(blockerId)
                .orElseThrow(() -> new IllegalArgumentException("Blocker not found: " + blockerId));

        blocker.setResolved(true);
        blocker.setResolvedAt(Instant.now());
        blocker.setResolvedBy(userId);
        TaskBlockerEntity saved = taskBlockerRepository.save(blocker);

        List<TaskBlockerEntity> unresolved = taskBlockerRepository.findByTaskIdAndResolvedFalse(blocker.getTaskId());
        if (unresolved.isEmpty()) {
            workItemRepository.findById(blocker.getTaskId()).ifPresent(item -> {
                item.setBlocked(false);
                if ("BLOCKED".equalsIgnoreCase(item.getState())) {
                    item.setState("IN_PROGRESS");
                }
                item.setUpdatedAt(Instant.now());
                workItemRepository.save(item);
            });
        }

        return saved;
    }

    public TaskCommentEntity addTaskComment(String taskId, String userId, String authorName, DeveloperDTOs.TaskCommentRequest req) {
        TaskCommentEntity comment = new TaskCommentEntity();
        comment.setId("cm-" + UUID.randomUUID().toString().substring(0, 8));
        comment.setTaskId(taskId);
        comment.setAuthorId(userId);
        comment.setAuthorName(authorName != null ? authorName : "Developer");
        comment.setComment(req.comment());
        comment.setCreatedAt(Instant.now());
        return taskCommentRepository.save(comment);
    }

    @Transactional(readOnly = true)
    public List<TaskCommentEntity> getTaskComments(String taskId) {
        return taskCommentRepository.findByTaskIdOrderByCreatedAtAsc(taskId);
    }

    @Transactional(readOnly = true)
    public List<TaskBlockerEntity> getTaskBlockers(String taskId) {
        return taskBlockerRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
    }

    // ==========================================
    // 4. CHECK-INS (INDIVIDUAL MODE)
    // ==========================================
    public ProjectCheckInEntity submitCheckIn(String userId, String authorName, DeveloperDTOs.CheckInSubmissionRequest req) {
        ProjectEntity project = projectRepository.findById(req.projectId())
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + req.projectId()));

        if ("STRUCTURED".equalsIgnoreCase(project.getMode())) {
            throw new IllegalStateException("Direct percentage check-ins are restricted for Structured Mode projects. Progress is calculated from work items.");
        }

        if (req.percent() == null || req.percent().compareTo(BigDecimal.ZERO) < 0 || req.percent().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new IllegalArgumentException("Completion percentage must be between 0 and 100.");
        }

        ProjectCheckInEntity checkIn = new ProjectCheckInEntity();
        checkIn.setId("chk-" + UUID.randomUUID().toString().substring(0, 8));
        checkIn.setProjectId(req.projectId());
        checkIn.setAuthorId(userId);
        checkIn.setAuthorName(authorName != null ? authorName : "Developer");
        checkIn.setPercent(req.percent().setScale(2, RoundingMode.HALF_UP));
        checkIn.setAccomplished(req.accomplished());
        checkIn.setNextSteps(req.nextSteps());
        checkIn.setBlockers(req.blockers());
        checkIn.setRisks(req.risks());
        checkIn.setCreatedAt(Instant.now());

        ProjectCheckInEntity saved = projectCheckInRepository.save(checkIn);

        project.setLastProgressPercent(checkIn.getPercent());
        project.setUpdatedAt(Instant.now());
        projectRepository.save(project);

        return saved;
    }

    @Transactional(readOnly = true)
    public List<ProjectCheckInEntity> getProjectCheckIns(String projectId) {
        return projectCheckInRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
    }

    // ==========================================
    // 5. SPRINTS & KANBAN
    // ==========================================
    @Transactional(readOnly = true)
    public List<DeveloperDTOs.SprintDTO> getSprints(String projectId) {
        List<SprintEntity> sprints = projectId != null && !projectId.isBlank()
                ? sprintRepository.findByProjectId(projectId)
                : sprintRepository.findAll();

        List<DeveloperDTOs.SprintDTO> result = new ArrayList<>();
        for (SprintEntity s : sprints) {
            List<WorkItemEntity> tasks = workItemRepository.findBySprintId(s.getId());
            result.add(new DeveloperDTOs.SprintDTO(
                    s.getId(),
                    s.getProjectId(),
                    s.getName(),
                    s.getGoal(),
                    s.getStatus(),
                    s.getStartDate(),
                    s.getEndDate(),
                    tasks.stream().map(this::mapWorkItemToDTO).toList()
            ));
        }
        return result;
    }

    // ==========================================
    // 6. BUGS & ISSUES
    // ==========================================
    @Transactional(readOnly = true)
    public List<BugEntity> getBugs(String userId, String projectId) {
        if (projectId != null && !projectId.isBlank()) {
            return bugRepository.findByProjectId(projectId);
        }
        return bugRepository.findByAssignedTo(userId);
    }

    public BugEntity createBug(String userId, DeveloperDTOs.CreateBugRequest req) {
        BugEntity bug = new BugEntity();
        bug.setId("bug-" + UUID.randomUUID().toString().substring(0, 8));
        bug.setProjectId(req.projectId());
        bug.setTitle(req.title());
        bug.setDescription(req.description());
        bug.setSeverity(req.severity() != null ? req.severity().toUpperCase() : "MEDIUM");
        bug.setStatus("OPEN");
        bug.setReportedBy(userId);
        bug.setAssignedTo(req.assignedTo() != null ? req.assignedTo() : userId);
        bug.setReproductionSteps(req.reproductionSteps());
        bug.setEnvironment(req.environment());
        bug.setCreatedAt(Instant.now());
        return bugRepository.save(bug);
    }

    public BugEntity updateBugStatus(String bugId, String userId, DeveloperDTOs.UpdateBugStatusRequest req) {
        BugEntity bug = bugRepository.findById(bugId)
                .orElseThrow(() -> new IllegalArgumentException("Bug not found: " + bugId));

        bug.setStatus(req.status().toUpperCase());
        if (req.resolution() != null) {
            bug.setResolution(req.resolution());
        }
        if ("RESOLVED".equalsIgnoreCase(req.status()) || "CLOSED".equalsIgnoreCase(req.status())) {
            bug.setResolvedAt(Instant.now());
        }
        return bugRepository.save(bug);
    }

    // ==========================================
    // 7. CODE REVIEWS
    // ==========================================
    @Transactional(readOnly = true)
    public List<CodeReviewEntity> getCodeReviews(String userId, String type) {
        if ("authored".equalsIgnoreCase(type)) {
            return codeReviewRepository.findByAuthorId(userId);
        } else if ("assigned".equalsIgnoreCase(type)) {
            return codeReviewRepository.findByReviewerId(userId);
        }
        List<CodeReviewEntity> combined = new ArrayList<>();
        combined.addAll(codeReviewRepository.findByReviewerId(userId));
        combined.addAll(codeReviewRepository.findByAuthorId(userId));
        return combined.stream().distinct().toList();
    }

    public CodeReviewEntity submitReviewDecision(String reviewId, String userId, DeveloperDTOs.CodeReviewDecisionRequest req) {
        CodeReviewEntity review = codeReviewRepository.findById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found: " + reviewId));

        review.setStatus(req.decision().toUpperCase());
        review.setUpdatedAt(Instant.now());

        if (req.feedback() != null && !req.feedback().isBlank()) {
            CodeReviewCommentEntity comment = new CodeReviewCommentEntity();
            comment.setId("crc-" + UUID.randomUUID().toString().substring(0, 8));
            comment.setReviewId(reviewId);
            comment.setAuthorId(userId);
            comment.setAuthorName("Reviewer");
            comment.setComment(req.feedback());
            comment.setCreatedAt(Instant.now());
            codeReviewCommentRepository.save(comment);
        }

        // If approved and linked task exists, transition work item to DONE
        if ("APPROVED".equalsIgnoreCase(req.decision()) && review.getWorkItemId() != null) {
            workItemRepository.findById(review.getWorkItemId()).ifPresent(item -> {
                item.setState("DONE");
                item.setUpdatedAt(Instant.now());
                workItemRepository.save(item);
            });
        }

        return codeReviewRepository.save(review);
    }

    // ==========================================
    // 8. GITHUB ACTIVITY
    // ==========================================
    @Transactional(readOnly = true)
    public List<GitHubActivityEntity> getGitHubActivity(String repo, String actor) {
        if (repo != null && !repo.isBlank()) {
            return gitHubActivityRepository.findByRepositoryNameOrderByCreatedAtDesc(repo);
        } else if (actor != null && !actor.isBlank()) {
            return gitHubActivityRepository.findByActorOrderByCreatedAtDesc(actor);
        }
        return gitHubActivityRepository.findAllByOrderByCreatedAtDesc();
    }

    // ==========================================
    // 9. CALENDAR & DEADLINES
    // ==========================================
    @Transactional(readOnly = true)
    public List<CalendarEventEntity> getCalendarEvents(String userId) {
        return calendarEventRepository.findByUserIdOrderByStartTimeAsc(userId);
    }

    public CalendarEventEntity createCalendarEvent(String userId, DeveloperDTOs.CalendarEventRequest req) {
        CalendarEventEntity event = new CalendarEventEntity();
        event.setId("evt-" + UUID.randomUUID().toString().substring(0, 8));
        event.setUserId(userId);
        event.setProjectId(req.projectId());
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
    public List<DiscussionEntity> getDiscussions(String projectId) {
        if (projectId != null && !projectId.isBlank()) {
            return discussionRepository.findByProjectIdOrderByUpdatedAtDesc(projectId);
        }
        return discussionRepository.findAllByOrderByUpdatedAtDesc();
    }

    public DiscussionEntity createDiscussion(String userId, String authorName, DeveloperDTOs.DiscussionPostRequest req) {
        DiscussionEntity disc = new DiscussionEntity();
        disc.setId("dsc-" + UUID.randomUUID().toString().substring(0, 8));
        disc.setProjectId(req.projectId());
        disc.setTitle(req.title());
        disc.setCategory(req.category() != null ? req.category() : "GENERAL");
        disc.setAuthorId(userId);
        disc.setCreatedAt(Instant.now());
        disc.setUpdatedAt(Instant.now());
        DiscussionEntity saved = discussionRepository.save(disc);

        if (req.initialMessage() != null && !req.initialMessage().isBlank()) {
            DiscussionMessageEntity msg = new DiscussionMessageEntity();
            msg.setId("msg-" + UUID.randomUUID().toString().substring(0, 8));
            msg.setDiscussionId(saved.getId());
            msg.setAuthorId(userId);
            msg.setAuthorName(authorName != null ? authorName : "Developer");
            msg.setMessage(req.initialMessage());
            msg.setCreatedAt(Instant.now());
            discussionMessageRepository.save(msg);
        }

        return saved;
    }

    @Transactional(readOnly = true)
    public List<DiscussionMessageEntity> getDiscussionMessages(String discussionId) {
        return discussionMessageRepository.findByDiscussionIdOrderByCreatedAtAsc(discussionId);
    }

    public DiscussionMessageEntity addDiscussionMessage(String discussionId, String userId, String authorName, String message) {
        DiscussionMessageEntity msg = new DiscussionMessageEntity();
        msg.setId("msg-" + UUID.randomUUID().toString().substring(0, 8));
        msg.setDiscussionId(discussionId);
        msg.setAuthorId(userId);
        msg.setAuthorName(authorName != null ? authorName : "Developer");
        msg.setMessage(message);
        msg.setCreatedAt(Instant.now());

        discussionRepository.findById(discussionId).ifPresent(d -> {
            d.setUpdatedAt(Instant.now());
            discussionRepository.save(d);
        });

        return discussionMessageRepository.save(msg);
    }

    // ==========================================
    // 11. FILES & DOCUMENTS
    // ==========================================
    @Transactional(readOnly = true)
    public List<FileMetadataEntity> getFiles(String projectId, String workItemId) {
        if (projectId != null && !projectId.isBlank()) {
            return fileMetadataRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
        } else if (workItemId != null && !workItemId.isBlank()) {
            return fileMetadataRepository.findByWorkItemIdOrderByCreatedAtDesc(workItemId);
        }
        return fileMetadataRepository.findAll();
    }

    public FileMetadataEntity saveFileRecord(String userId, DeveloperDTOs.FileUploadRecordRequest req) {
        FileMetadataEntity file = new FileMetadataEntity();
        file.setId("fil-" + UUID.randomUUID().toString().substring(0, 8));
        file.setProjectId(req.projectId());
        file.setWorkItemId(req.workItemId());
        file.setFileName(req.fileName());
        file.setFileUrl(req.fileUrl());
        file.setFileSize(req.fileSize() != null ? req.fileSize() : 1024L);
        file.setContentType(req.contentType() != null ? req.contentType() : "application/octet-stream");
        file.setUploadedBy(userId);
        file.setCreatedAt(Instant.now());
        return fileMetadataRepository.save(file);
    }

    // ==========================================
    // 12. NOTIFICATIONS
    // ==========================================
    @Transactional(readOnly = true)
    public List<DeveloperNotificationEntity> getNotifications(String userId, Boolean unreadOnly) {
        if (Boolean.TRUE.equals(unreadOnly)) {
            return developerNotificationRepository.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId);
        }
        return developerNotificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public void markNotificationRead(String notificationId, String userId) {
        developerNotificationRepository.findById(notificationId).ifPresent(n -> {
            if (userId.equals(n.getUserId())) {
                n.setRead(true);
                developerNotificationRepository.save(n);
            }
        });
    }

    public void markAllNotificationsRead(String userId) {
        List<DeveloperNotificationEntity> unread = developerNotificationRepository.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId);
        for (DeveloperNotificationEntity n : unread) {
            n.setRead(true);
        }
        developerNotificationRepository.saveAll(unread);
    }

    // ==========================================
    // 13. REPORTS & ANALYTICS
    // ==========================================
    @Transactional(readOnly = true)
    public DeveloperDTOs.DeveloperReportsSummaryDTO getReportsSummary(String userId, UUID orgId) {
        List<WorkItemEntity> tasks = workItemRepository.findByPrimaryAssigneeId(userId);

        long totalTasks = tasks.size();
        long completed = tasks.stream().filter(t -> "DONE".equalsIgnoreCase(t.getState())).count();
        long inProgress = tasks.stream().filter(t -> "IN_PROGRESS".equalsIgnoreCase(t.getState())).count();
        long inReview = tasks.stream().filter(t -> "IN_REVIEW".equalsIgnoreCase(t.getState())).count();
        long blocked = tasks.stream().filter(t -> t.isBlocked() || "BLOCKED".equalsIgnoreCase(t.getState())).count();

        BigDecimal actualHours = tasks.stream()
                .map(t -> t.getActualHours() != null ? t.getActualHours() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal estimatedHours = tasks.stream()
                .map(t -> t.getEstimatedHours() != null ? t.getEstimatedHours() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long openBugs = bugRepository.countByAssignedToAndStatusNot(userId, "RESOLVED");
        List<BugEntity> myBugs = bugRepository.findByAssignedTo(userId);
        long resolvedBugs = myBugs.stream().filter(b -> "RESOLVED".equalsIgnoreCase(b.getStatus())).count();

        List<CodeReviewEntity> reviewsAuthored = codeReviewRepository.findByAuthorId(userId);
        List<CodeReviewEntity> reviewsDone = codeReviewRepository.findByReviewerId(userId).stream()
                .filter(r -> "APPROVED".equalsIgnoreCase(r.getStatus()) || "MERGED".equalsIgnoreCase(r.getStatus()))
                .toList();

        List<ProjectEntity> projects = projectRepository.findAssignedProjectsByOrg(userId, orgId);
        if (projects.isEmpty() && orgId != null) {
            projects = projectRepository.findAssignedProjects(userId);
        }

        List<DeveloperDTOs.ProjectContributionDTO> contributions = new ArrayList<>();
        for (ProjectEntity p : projects) {
            List<WorkItemEntity> pTasks = tasks.stream().filter(t -> p.getId().equals(t.getProjectId())).toList();
            long pCompleted = pTasks.stream().filter(t -> "DONE".equalsIgnoreCase(t.getState())).count();
            BigDecimal prog = "STRUCTURED".equalsIgnoreCase(p.getMode())
                    ? calculateStructuredProgress(p.getId())
                    : (p.getLastProgressPercent() != null ? p.getLastProgressPercent() : BigDecimal.ZERO);

            contributions.add(new DeveloperDTOs.ProjectContributionDTO(
                    p.getId(),
                    p.getName(),
                    p.getCode(),
                    p.getMode(),
                    pTasks.size(),
                    pCompleted,
                    prog
            ));
        }

        return new DeveloperDTOs.DeveloperReportsSummaryDTO(
                totalTasks,
                completed,
                inProgress,
                inReview,
                blocked,
                actualHours,
                estimatedHours,
                openBugs,
                resolvedBugs,
                reviewsAuthored.size(),
                reviewsDone.size(),
                contributions
        );
    }

    // ==========================================
    // 14. SETTINGS & PREFERENCES
    // ==========================================
    @Transactional(readOnly = true)
    public DeveloperPreferenceEntity getPreferences(String userId) {
        return developerPreferenceRepository.findById(userId).orElseGet(() -> {
            DeveloperPreferenceEntity pref = new DeveloperPreferenceEntity();
            pref.setUserId(userId);
            pref.setEmailNotifications(true);
            pref.setSlackNotifications(false);
            pref.setTheme("system");
            pref.setTimezone("America/New_York");
            pref.setUpdatedAt(Instant.now());
            return pref;
        });
    }

    public DeveloperPreferenceEntity updatePreferences(String userId, DeveloperDTOs.PreferenceUpdateRequest req) {
        DeveloperPreferenceEntity pref = developerPreferenceRepository.findById(userId).orElseGet(() -> {
            DeveloperPreferenceEntity p = new DeveloperPreferenceEntity();
            p.setUserId(userId);
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
                item.getId(),
                item.getProjectId(),
                item.getOrgId(),
                item.getParentId(),
                item.getType(),
                item.getKey(),
                item.getTitle(),
                item.getDescription(),
                item.getPrimaryAssigneeId(),
                item.getReviewerId(),
                item.getState(),
                item.isBlocked(),
                item.getWeight(),
                item.getWeightUnit(),
                item.getCriteria(),
                item.getCurrentRevision(),
                item.getSubmittedRevision(),
                item.getDueDate(),
                item.getStartDate(),
                item.getEstimatedHours(),
                item.getActualHours(),
                item.getPriority(),
                item.getSprintId(),
                item.getCreatedAt(),
                item.getUpdatedAt()
        );
    }
}
