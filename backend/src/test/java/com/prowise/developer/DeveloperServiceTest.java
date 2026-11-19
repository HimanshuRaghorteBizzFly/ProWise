package com.prowise.developer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

public class DeveloperServiceTest {

    private ProjectRepository projectRepository;
    private WorkItemRepository workItemRepository;
    private SprintRepository sprintRepository;
    private TaskCommentRepository taskCommentRepository;
    private TaskBlockerRepository taskBlockerRepository;
    private ProjectCheckInRepository projectCheckInRepository;
    private BugRepository bugRepository;
    private BugCommentRepository bugCommentRepository;
    private CodeReviewRepository codeReviewRepository;
    private CodeReviewCommentRepository codeReviewCommentRepository;
    private GitHubActivityRepository gitHubActivityRepository;
    private CalendarEventRepository calendarEventRepository;
    private DiscussionRepository discussionRepository;
    private DiscussionMessageRepository discussionMessageRepository;
    private FileMetadataRepository fileMetadataRepository;
    private DeveloperNotificationRepository developerNotificationRepository;
    private DeveloperPreferenceRepository developerPreferenceRepository;

    private DeveloperService developerService;

    @BeforeEach
    void setUp() {
        projectRepository = mock(ProjectRepository.class);
        workItemRepository = mock(WorkItemRepository.class);
        sprintRepository = mock(SprintRepository.class);
        taskCommentRepository = mock(TaskCommentRepository.class);
        taskBlockerRepository = mock(TaskBlockerRepository.class);
        projectCheckInRepository = mock(ProjectCheckInRepository.class);
        bugRepository = mock(BugRepository.class);
        bugCommentRepository = mock(BugCommentRepository.class);
        codeReviewRepository = mock(CodeReviewRepository.class);
        codeReviewCommentRepository = mock(CodeReviewCommentRepository.class);
        gitHubActivityRepository = mock(GitHubActivityRepository.class);
        calendarEventRepository = mock(CalendarEventRepository.class);
        discussionRepository = mock(DiscussionRepository.class);
        discussionMessageRepository = mock(DiscussionMessageRepository.class);
        fileMetadataRepository = mock(FileMetadataRepository.class);
        developerNotificationRepository = mock(DeveloperNotificationRepository.class);
        developerPreferenceRepository = mock(DeveloperPreferenceRepository.class);

        developerService = new DeveloperService(
                projectRepository,
                workItemRepository,
                sprintRepository,
                taskCommentRepository,
                taskBlockerRepository,
                projectCheckInRepository,
                bugRepository,
                bugCommentRepository,
                codeReviewRepository,
                codeReviewCommentRepository,
                gitHubActivityRepository,
                calendarEventRepository,
                discussionRepository,
                discussionMessageRepository,
                fileMetadataRepository,
                developerNotificationRepository,
                developerPreferenceRepository
        );
    }

    @Test
    @DisplayName("Dashboard telemetry calculates assigned projects, tasks, bugs, and reviews correctly")
    void testDashboardTelemetry() {
        String userId = "usr-developer";
        UUID orgId = UUID.randomUUID();

        ProjectEntity proj = new ProjectEntity();
        proj.setId("proj-1");
        proj.setName("FHIR Patient Intake Service");
        proj.setKey("SOLO-10");
        proj.setMode("INDIVIDUAL");
        proj.setLifecycle("ACTIVE");
        proj.setAccountableOwnerId(userId);

        when(projectRepository.findAssignedProjectsByOrg(userId, orgId)).thenReturn(List.of(proj));

        WorkItemEntity task1 = new WorkItemEntity();
        task1.setId("task-1");
        task1.setTitle("Configure Security");
        task1.setPrimaryAssigneeId(userId);
        task1.setState("DONE");

        WorkItemEntity task2 = new WorkItemEntity();
        task2.setId("task-2");
        task2.setTitle("Build FHIR Ingestion Pipeline");
        task2.setPrimaryAssigneeId(userId);
        task2.setState("IN_PROGRESS");
        task2.setDueDate(Instant.now().plusSeconds(86400));

        when(workItemRepository.findByPrimaryAssigneeId(userId)).thenReturn(List.of(task1, task2));
        when(bugRepository.countByAssignedToAndStatusNot(userId, "RESOLVED")).thenReturn(1L);
        when(codeReviewRepository.countByReviewerIdAndStatus(userId, "PENDING")).thenReturn(2L);
        when(developerNotificationRepository.countByUserIdAndReadFalse(userId)).thenReturn(3L);
        when(gitHubActivityRepository.findAllByOrderByCreatedAtDesc()).thenReturn(List.of());

        DeveloperDTOs.DashboardSummaryDTO summary = developerService.getDashboardSummary(userId, orgId);

        assertEquals(1, summary.assignedProjectsCount());
        assertEquals(1, summary.activeProjectsCount());
        assertEquals(2, summary.assignedTasksCount());
        assertEquals(1, summary.completedTasksCount());
        assertEquals(1, summary.pendingTasksCount());
        assertEquals(1, summary.openBugsCount());
        assertEquals(2, summary.pendingReviewsCount());
        assertEquals(3, summary.unreadNotificationsCount());
        assertEquals(1, summary.upcomingDeadlines().size());
    }

    @Test
    @DisplayName("Structured mode progress is computed from work items weight")
    void testStructuredProgressCalculation() {
        String projId = "proj-structured-cds";

        WorkItemEntity leaf1 = new WorkItemEntity();
        leaf1.setId("task-101");
        leaf1.setWeight(BigDecimal.valueOf(30));
        leaf1.setState("DONE");

        WorkItemEntity leaf2 = new WorkItemEntity();
        leaf2.setId("task-102");
        leaf2.setWeight(BigDecimal.valueOf(20));
        leaf2.setState("DONE");

        WorkItemEntity leaf3 = new WorkItemEntity();
        leaf3.setId("task-103");
        leaf3.setWeight(BigDecimal.valueOf(50));
        leaf3.setState("IN_PROGRESS");

        when(workItemRepository.findByProjectId(projId)).thenReturn(List.of(leaf1, leaf2, leaf3));

        BigDecimal progress = developerService.calculateStructuredProgress(projId);

        // (30 + 20) / (30 + 20 + 50) * 100 = 50.00%
        assertEquals(new BigDecimal("50.00"), progress);
    }

    @Test
    @DisplayName("Individual mode check-in validates percentage and updates project state")
    void testSubmitCheckInIndividualMode() {
        String userId = "usr-developer";
        String projId = "proj-solo";

        ProjectEntity proj = new ProjectEntity();
        proj.setId(projId);
        proj.setMode("INDIVIDUAL");
        proj.setKey("SOLO-10");
        proj.setName("Solo Delivery");

        when(projectRepository.findById(projId)).thenReturn(Optional.of(proj));
        when(projectCheckInRepository.save(any(ProjectCheckInEntity.class))).thenAnswer(i -> i.getArgument(0));

        DeveloperDTOs.CheckInSubmissionRequest req = new DeveloperDTOs.CheckInSubmissionRequest(
                projId,
                new BigDecimal("45.50"),
                "Completed initial DB mapping",
                "Hooking up auth filter",
                "None",
                "No major risks"
        );

        ProjectCheckInEntity checkIn = developerService.submitCheckIn(userId, "Alex Rivera", req);

        assertNotNull(checkIn.getId());
        assertEquals(new BigDecimal("45.50"), checkIn.getPercent());
        assertEquals("Completed initial DB mapping", checkIn.getAccomplished());
        assertEquals(new BigDecimal("45.50"), proj.getLastProgressPercent());

        verify(projectRepository, times(1)).save(proj);
    }

    @Test
    @DisplayName("Structured mode rejects direct percentage check-in")
    void testStructuredModeRejectsDirectCheckIn() {
        String userId = "usr-developer";
        String projId = "proj-structured";

        ProjectEntity proj = new ProjectEntity();
        proj.setId(projId);
        proj.setMode("STRUCTURED");
        proj.setKey("CRM-100");

        when(projectRepository.findById(projId)).thenReturn(Optional.of(proj));

        DeveloperDTOs.CheckInSubmissionRequest req = new DeveloperDTOs.CheckInSubmissionRequest(
                projId,
                new BigDecimal("60.00"),
                "Done",
                "Next",
                "",
                ""
        );

        assertThrows(IllegalStateException.class, () -> developerService.submitCheckIn(userId, "Alex", req));
    }

    @Test
    @DisplayName("Check-in percentage must be between 0 and 100")
    void testCheckInPercentageValidation() {
        String userId = "usr-developer";
        String projId = "proj-solo";

        ProjectEntity proj = new ProjectEntity();
        proj.setId(projId);
        proj.setMode("INDIVIDUAL");

        when(projectRepository.findById(projId)).thenReturn(Optional.of(proj));

        DeveloperDTOs.CheckInSubmissionRequest reqInvalidHigh = new DeveloperDTOs.CheckInSubmissionRequest(
                projId,
                new BigDecimal("105.00"),
                "Done",
                "Next",
                "",
                ""
        );

        assertThrows(IllegalArgumentException.class, () -> developerService.submitCheckIn(userId, "Alex", reqInvalidHigh));

        DeveloperDTOs.CheckInSubmissionRequest reqInvalidLow = new DeveloperDTOs.CheckInSubmissionRequest(
                projId,
                new BigDecimal("-5.00"),
                "Done",
                "Next",
                "",
                ""
        );

        assertThrows(IllegalArgumentException.class, () -> developerService.submitCheckIn(userId, "Alex", reqInvalidLow));
    }

    @Test
    @DisplayName("Task status update to IN_REVIEW records submittedRevision and recalculates structured progress")
    void testTaskStatusUpdate() {
        String taskId = "task-10";
        String projId = "proj-struct";

        WorkItemEntity item = new WorkItemEntity();
        item.setId(taskId);
        item.setProjectId(projId);
        item.setCurrentRevision(3);
        item.setState("IN_PROGRESS");
        item.setWeight(BigDecimal.valueOf(50));

        ProjectEntity proj = new ProjectEntity();
        proj.setId(projId);
        proj.setMode("STRUCTURED");

        when(workItemRepository.findById(taskId)).thenReturn(Optional.of(item));
        when(workItemRepository.save(any(WorkItemEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(projectRepository.findById(projId)).thenReturn(Optional.of(proj));
        when(workItemRepository.findByProjectId(projId)).thenReturn(List.of(item));

        DeveloperDTOs.TaskStatusUpdateRequest req = new DeveloperDTOs.TaskStatusUpdateRequest("IN_REVIEW", "Ready for review");

        DeveloperDTOs.WorkItemDTO updated = developerService.updateTaskStatus(taskId, "usr-developer", req);

        assertEquals("IN_REVIEW", updated.state());
        assertEquals(3, updated.submittedRevision());
        verify(taskCommentRepository, times(1)).save(any(TaskCommentEntity.class));
    }

    @Test
    @DisplayName("Blocker lifecycle: reporting marks task blocked, resolving clears it")
    void testBlockerLifecycle() {
        String taskId = "task-50";

        WorkItemEntity item = new WorkItemEntity();
        item.setId(taskId);
        item.setState("IN_PROGRESS");
        item.setBlocked(false);

        when(workItemRepository.findById(taskId)).thenReturn(Optional.of(item));
        when(workItemRepository.save(any(WorkItemEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(taskBlockerRepository.save(any(TaskBlockerEntity.class))).thenAnswer(i -> i.getArgument(0));

        DeveloperDTOs.TaskBlockerRequest req = new DeveloperDTOs.TaskBlockerRequest("Waiting on external API credentials", "CRITICAL");
        TaskBlockerEntity blocker = developerService.submitTaskBlocker(taskId, "usr-developer", req);

        assertTrue(item.isBlocked());
        assertEquals("BLOCKED", item.getState());
        assertEquals("CRITICAL", blocker.getSeverity());

        // Now resolve the blocker
        when(taskBlockerRepository.findById(blocker.getId())).thenReturn(Optional.of(blocker));
        when(taskBlockerRepository.findByTaskIdAndResolvedFalse(taskId)).thenReturn(List.of());

        TaskBlockerEntity resolved = developerService.resolveTaskBlocker(blocker.getId(), "usr-developer");

        assertTrue(resolved.isResolved());
        assertNotNull(resolved.getResolvedAt());
        assertFalse(item.isBlocked());
        assertEquals("IN_PROGRESS", item.getState());
    }

    @Test
    @DisplayName("Code review approval completes linked task")
    void testCodeReviewApproval() {
        String reviewId = "rev-1";
        String taskId = "task-99";

        CodeReviewEntity review = new CodeReviewEntity();
        review.setId(reviewId);
        review.setWorkItemId(taskId);
        review.setStatus("PENDING");

        WorkItemEntity task = new WorkItemEntity();
        task.setId(taskId);
        task.setState("IN_REVIEW");

        when(codeReviewRepository.findById(reviewId)).thenReturn(Optional.of(review));
        when(codeReviewRepository.save(any(CodeReviewEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(workItemRepository.findById(taskId)).thenReturn(Optional.of(task));

        DeveloperDTOs.CodeReviewDecisionRequest decisionReq = new DeveloperDTOs.CodeReviewDecisionRequest("APPROVED", "Looks solid! Tests passing.");

        CodeReviewEntity result = developerService.submitReviewDecision(reviewId, "usr-reviewer", decisionReq);

        assertEquals("APPROVED", result.getStatus());
        assertEquals("DONE", task.getState());
        verify(codeReviewCommentRepository, times(1)).save(any(CodeReviewCommentEntity.class));
    }
}
