package com.prowise.developer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
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
import org.springframework.http.HttpStatus;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.common.api.ApiException;
import com.prowise.developer.DeveloperAccess.Actor;

public class DeveloperServiceTest {

    private static final UUID ORG = UUID.randomUUID();
    private static final String USER = "usr-developer";

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
    private DeveloperAccess access;

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
        access = mock(DeveloperAccess.class);

        // Default: the caller may read and act on the projects used below; individual tests override.
        when(access.canRead(any(), anyString())).thenReturn(true);
        when(access.can(any(), anyString(), any())).thenReturn(true);
        when(access.canAtOrg(any(), any())).thenReturn(true);
        when(access.notFound(any(), anyString(), any())).thenReturn(PermissionService.notFound());

        developerService = new DeveloperService(
                projectRepository, workItemRepository, sprintRepository, taskCommentRepository, taskBlockerRepository,
                projectCheckInRepository, bugRepository, bugCommentRepository, codeReviewRepository,
                codeReviewCommentRepository, gitHubActivityRepository, calendarEventRepository, discussionRepository,
                discussionMessageRepository, fileMetadataRepository, developerNotificationRepository,
                developerPreferenceRepository, access);
    }

    private static Actor actor(String userId) {
        return new Actor(ORG, userId, null, null);
    }

    @Test
    @DisplayName("Dashboard telemetry calculates assigned projects, tasks, bugs, and reviews correctly")
    void testDashboardTelemetry() {
        ProjectEntity proj = new ProjectEntity();
        proj.setId("proj-1");
        proj.setOrgId(ORG);
        proj.setName("FHIR Patient Intake Service");
        proj.setKey("SOLO-10");
        proj.setMode("INDIVIDUAL");
        proj.setLifecycle("ACTIVE");
        proj.setAccountableOwnerId(USER);

        when(projectRepository.findAssignedProjectsInOrg(ORG, USER)).thenReturn(List.of(proj));

        WorkItemEntity task1 = new WorkItemEntity();
        task1.setId("task-1");
        task1.setProjectId("proj-1");
        task1.setTitle("Configure Security");
        task1.setPrimaryAssigneeId(USER);
        task1.setState("DONE");

        WorkItemEntity task2 = new WorkItemEntity();
        task2.setId("task-2");
        task2.setProjectId("proj-1");
        task2.setTitle("Build FHIR Ingestion Pipeline");
        task2.setPrimaryAssigneeId(USER);
        task2.setState("IN_PROGRESS");
        task2.setDueDate(Instant.now().plusSeconds(86400));

        when(workItemRepository.findByOrgIdAndPrimaryAssigneeId(ORG, USER)).thenReturn(List.of(task1, task2));
        when(bugRepository.countOpenAssigned(ORG, USER, "RESOLVED")).thenReturn(1L);
        when(codeReviewRepository.countByOrgIdAndReviewerIdAndStatus(ORG, USER, "PENDING")).thenReturn(2L);
        when(developerNotificationRepository.countByOrgIdAndUserIdAndReadFalse(ORG, USER)).thenReturn(3L);
        when(gitHubActivityRepository.findByOrgIdOrderByCreatedAtDesc(ORG)).thenReturn(List.of());

        DeveloperDTOs.DashboardSummaryDTO summary = developerService.getDashboardSummary(actor(USER));

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
    @DisplayName("Dashboard leaves out projects and tasks the caller cannot read (T04)")
    void testDashboardHidesUnreadableProjects() {
        ProjectEntity readable = new ProjectEntity();
        readable.setId("proj-a");
        readable.setLifecycle("ACTIVE");
        ProjectEntity privateProject = new ProjectEntity();
        privateProject.setId("proj-b");
        privateProject.setLifecycle("ACTIVE");
        when(projectRepository.findAssignedProjectsInOrg(ORG, USER)).thenReturn(List.of(readable, privateProject));
        when(access.canRead(any(), eq("proj-b"))).thenReturn(false);

        WorkItemEntity onA = new WorkItemEntity();
        onA.setId("t-a");
        onA.setProjectId("proj-a");
        onA.setState("TODO");
        WorkItemEntity onB = new WorkItemEntity();
        onB.setId("t-b");
        onB.setProjectId("proj-b");
        onB.setState("TODO");
        when(workItemRepository.findByOrgIdAndPrimaryAssigneeId(ORG, USER)).thenReturn(List.of(onA, onB));

        DeveloperDTOs.DashboardSummaryDTO summary = developerService.getDashboardSummary(actor(USER));

        assertEquals(1, summary.assignedProjectsCount());
        assertEquals(1, summary.assignedTasksCount());
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

        when(workItemRepository.findByOrgIdAndProjectId(ORG, projId)).thenReturn(List.of(leaf1, leaf2, leaf3));

        BigDecimal progress = developerService.calculateStructuredProgress(ORG, projId);

        // (30 + 20) / (30 + 20 + 50) * 100 = 50.00%
        assertEquals(new BigDecimal("50.00"), progress);
    }

    private ProjectEntity individualProject(String projId, String accountableOwner) {
        ProjectEntity proj = new ProjectEntity();
        proj.setId(projId);
        proj.setOrgId(ORG);
        proj.setMode("INDIVIDUAL");
        proj.setKey("SOLO-10");
        proj.setName("Solo Delivery");
        proj.setAccountableOwnerId(accountableOwner);
        when(projectRepository.findByIdAndOrgId(projId, ORG)).thenReturn(Optional.of(proj));
        return proj;
    }

    @Test
    @DisplayName("Individual mode check-in validates percentage and updates project state")
    void testSubmitCheckInIndividualMode() {
        ProjectEntity proj = individualProject("proj-solo", USER);
        when(projectCheckInRepository.save(any(ProjectCheckInEntity.class))).thenAnswer(i -> i.getArgument(0));

        DeveloperDTOs.CheckInSubmissionRequest req = new DeveloperDTOs.CheckInSubmissionRequest(
                "proj-solo", new BigDecimal("45.50"), "Completed initial DB mapping", "Hooking up auth filter",
                "None", "No major risks");

        ProjectCheckInEntity checkIn = developerService.submitCheckIn(actor(USER), "Alex Rivera", req);

        assertNotNull(checkIn.getId());
        assertEquals(ORG, checkIn.getOrgId());
        assertEquals(new BigDecimal("45.50"), checkIn.getPercent());
        assertEquals("Completed initial DB mapping", checkIn.getAccomplished());
        assertEquals(new BigDecimal("45.50"), proj.getLastProgressPercent());
        verify(projectRepository, times(1)).save(proj);
    }

    @Test
    @DisplayName("Only the accountable developer can report progress")
    void testCheckInRequiresAccountableOwner() {
        individualProject("proj-solo", "someone-else");
        DeveloperDTOs.CheckInSubmissionRequest req = new DeveloperDTOs.CheckInSubmissionRequest(
                "proj-solo", new BigDecimal("10.00"), "Done", "Next", "", "");

        ApiException denied = assertThrows(ApiException.class, () -> developerService.submitCheckIn(actor(USER), "Alex", req));
        assertEquals(HttpStatus.FORBIDDEN, denied.status());
        verify(projectCheckInRepository, never()).save(any());
    }

    @Test
    @DisplayName("Structured mode rejects direct percentage check-in")
    void testStructuredModeRejectsDirectCheckIn() {
        ProjectEntity proj = individualProject("proj-structured", USER);
        proj.setMode("STRUCTURED");
        proj.setKey("CRM-100");

        DeveloperDTOs.CheckInSubmissionRequest req = new DeveloperDTOs.CheckInSubmissionRequest(
                "proj-structured", new BigDecimal("60.00"), "Done", "Next", "", "");

        assertThrows(IllegalStateException.class, () -> developerService.submitCheckIn(actor(USER), "Alex", req));
    }

    @Test
    @DisplayName("Check-in percentage must be between 0 and 100")
    void testCheckInPercentageValidation() {
        individualProject("proj-solo", USER);

        DeveloperDTOs.CheckInSubmissionRequest reqInvalidHigh = new DeveloperDTOs.CheckInSubmissionRequest(
                "proj-solo", new BigDecimal("105.00"), "Done", "Next", "", "");
        assertThrows(IllegalArgumentException.class, () -> developerService.submitCheckIn(actor(USER), "Alex", reqInvalidHigh));

        DeveloperDTOs.CheckInSubmissionRequest reqInvalidLow = new DeveloperDTOs.CheckInSubmissionRequest(
                "proj-solo", new BigDecimal("-5.00"), "Done", "Next", "", "");
        assertThrows(IllegalArgumentException.class, () -> developerService.submitCheckIn(actor(USER), "Alex", reqInvalidLow));
    }

    @Test
    @DisplayName("Task status update to IN_REVIEW records submittedRevision and recalculates structured progress")
    void testTaskStatusUpdate() {
        String taskId = "task-10";
        String projId = "proj-struct";

        WorkItemEntity item = new WorkItemEntity();
        item.setId(taskId);
        item.setOrgId(ORG);
        item.setProjectId(projId);
        item.setPrimaryAssigneeId(USER);
        item.setCurrentRevision(3);
        item.setState("IN_PROGRESS");
        item.setWeight(BigDecimal.valueOf(50));

        ProjectEntity proj = new ProjectEntity();
        proj.setId(projId);
        proj.setMode("STRUCTURED");

        when(workItemRepository.findByIdAndOrgId(taskId, ORG)).thenReturn(Optional.of(item));
        when(workItemRepository.save(any(WorkItemEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(projectRepository.findByIdAndOrgId(projId, ORG)).thenReturn(Optional.of(proj));
        when(workItemRepository.findByOrgIdAndProjectId(ORG, projId)).thenReturn(List.of(item));

        DeveloperDTOs.TaskStatusUpdateRequest req = new DeveloperDTOs.TaskStatusUpdateRequest("IN_REVIEW", "Ready for review");

        DeveloperDTOs.WorkItemDTO updated = developerService.updateTaskStatus(actor(USER), taskId, req);

        assertEquals("IN_REVIEW", updated.state());
        assertEquals(3, updated.submittedRevision());
        verify(taskCommentRepository, times(1)).save(any(TaskCommentEntity.class));
    }

    @Test
    @DisplayName("A task outside the caller's organization is 404 and nothing is written (T05)")
    void testForeignTaskIsNotFound() {
        when(workItemRepository.findByIdAndOrgId("task-foreign", ORG)).thenReturn(Optional.empty());

        ApiException notFound = assertThrows(ApiException.class, () -> developerService.updateTaskStatus(
                actor(USER), "task-foreign", new DeveloperDTOs.TaskStatusUpdateRequest("DONE", null)));

        assertEquals(HttpStatus.NOT_FOUND, notFound.status());
        verify(workItemRepository, never()).save(any());
        verify(access).notFound(any(), eq("TASK"), eq("task-foreign"));
    }

    @Test
    @DisplayName("Someone else's task needs task.assign on its project")
    void testOtherPeoplesTaskNeedsAssignRight() {
        WorkItemEntity item = new WorkItemEntity();
        item.setId("task-11");
        item.setProjectId("proj-x");
        item.setPrimaryAssigneeId("another-dev");
        when(workItemRepository.findByIdAndOrgId("task-11", ORG)).thenReturn(Optional.of(item));
        when(access.can(any(), eq("proj-x"), eq(PermissionKey.TASK_ASSIGN))).thenReturn(false);

        ApiException denied = assertThrows(ApiException.class, () -> developerService.updateTaskStatus(
                actor(USER), "task-11", new DeveloperDTOs.TaskStatusUpdateRequest("DONE", null)));

        assertEquals(HttpStatus.FORBIDDEN, denied.status());
        verify(workItemRepository, never()).save(any());
    }

    @Test
    @DisplayName("Blocker lifecycle: reporting marks task blocked, resolving clears it")
    void testBlockerLifecycle() {
        String taskId = "task-50";

        WorkItemEntity item = new WorkItemEntity();
        item.setId(taskId);
        item.setProjectId("proj-1");
        item.setPrimaryAssigneeId(USER);
        item.setState("IN_PROGRESS");
        item.setBlocked(false);

        when(workItemRepository.findByIdAndOrgId(taskId, ORG)).thenReturn(Optional.of(item));
        when(workItemRepository.save(any(WorkItemEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(taskBlockerRepository.save(any(TaskBlockerEntity.class))).thenAnswer(i -> i.getArgument(0));

        DeveloperDTOs.TaskBlockerRequest req = new DeveloperDTOs.TaskBlockerRequest("Waiting on external API credentials", "CRITICAL");
        TaskBlockerEntity blocker = developerService.submitTaskBlocker(actor(USER), taskId, req);

        assertTrue(item.isBlocked());
        assertEquals("BLOCKED", item.getState());
        assertEquals("CRITICAL", blocker.getSeverity());
        assertEquals(ORG, blocker.getOrgId());

        when(taskBlockerRepository.findByIdAndOrgId(blocker.getId(), ORG)).thenReturn(Optional.of(blocker));
        when(taskBlockerRepository.findByOrgIdAndTaskIdAndResolvedFalse(ORG, taskId)).thenReturn(List.of());

        TaskBlockerEntity resolved = developerService.resolveTaskBlocker(actor(USER), blocker.getId());

        assertTrue(resolved.isResolved());
        assertNotNull(resolved.getResolvedAt());
        assertFalse(item.isBlocked());
        assertEquals("IN_PROGRESS", item.getState());
    }

    private CodeReviewEntity pendingReview(String reviewer) {
        CodeReviewEntity review = new CodeReviewEntity();
        review.setId("rev-1");
        review.setProjectId("proj-1");
        review.setWorkItemId("task-99");
        review.setReviewerId(reviewer);
        review.setStatus("PENDING");
        when(codeReviewRepository.findByIdAndOrgId("rev-1", ORG)).thenReturn(Optional.of(review));
        return review;
    }

    @Test
    @DisplayName("Code review approval completes linked task")
    void testCodeReviewApproval() {
        pendingReview("usr-reviewer");
        WorkItemEntity task = new WorkItemEntity();
        task.setId("task-99");
        task.setState("IN_REVIEW");

        when(codeReviewRepository.save(any(CodeReviewEntity.class))).thenAnswer(i -> i.getArgument(0));
        when(workItemRepository.findByIdAndOrgId("task-99", ORG)).thenReturn(Optional.of(task));

        DeveloperDTOs.CodeReviewDecisionRequest decisionReq =
                new DeveloperDTOs.CodeReviewDecisionRequest("APPROVED", "Looks solid! Tests passing.");

        CodeReviewEntity result = developerService.submitReviewDecision(actor("usr-reviewer"), "rev-1", decisionReq);

        assertEquals("APPROVED", result.getStatus());
        assertEquals("DONE", task.getState());
        verify(codeReviewCommentRepository, times(1)).save(any(CodeReviewCommentEntity.class));
    }

    @Test
    @DisplayName("Only the assigned reviewer can decide a review")
    void testReviewDecisionRequiresAssignedReviewer() {
        pendingReview("usr-reviewer");

        ApiException denied = assertThrows(ApiException.class, () -> developerService.submitReviewDecision(
                actor("usr-other-reviewer"), "rev-1", new DeveloperDTOs.CodeReviewDecisionRequest("APPROVED", null)));

        assertEquals(HttpStatus.FORBIDDEN, denied.status());
        verify(codeReviewRepository, never()).save(any());
    }
}
