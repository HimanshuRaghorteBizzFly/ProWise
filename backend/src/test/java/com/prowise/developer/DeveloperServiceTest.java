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
        workflow = mock(com.prowise.work.WorkflowService.class);
        blockers = mock(com.prowise.work.BlockerService.class);

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
                developerPreferenceRepository, access, workflow, blockers);
    }

    private com.prowise.work.WorkflowService workflow;
    private com.prowise.work.BlockerService blockers;

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
        when(bugRepository.countOpenAssigned(ORG, USER)).thenReturn(1L);
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
    @DisplayName("Regression: a deadline's project_code is the project's key, the id stays in project_id")
    void deadlineProjectCodeIsTheProjectKey() {
        ProjectEntity proj = new ProjectEntity();
        proj.setId("proj-77");
        proj.setOrgId(ORG);
        proj.setKey("CRM");
        proj.setLifecycle("ACTIVE");
        when(projectRepository.findAssignedProjectsInOrg(ORG, USER)).thenReturn(List.of(proj));
        WorkItemEntity task = new WorkItemEntity();
        task.setId("task-9");
        task.setKey("CRM-9");
        task.setProjectId("proj-77");
        task.setPrimaryAssigneeId(USER);
        task.setState("IN_PROGRESS");
        task.setDueDate(Instant.now().plusSeconds(3600));
        when(workItemRepository.findByOrgIdAndPrimaryAssigneeId(ORG, USER)).thenReturn(List.of(task));

        DeveloperDTOs.DeadlineItemDTO deadline = developerService.getDashboardSummary(actor(USER)).upcomingDeadlines().get(0);

        assertEquals("CRM", deadline.projectCode());
        assertEquals("proj-77", deadline.projectId());
        assertEquals("CRM-9", deadline.key());
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
    @DisplayName("Structured progress shown to developers is the latest calculated snapshot, never task counts (rule 9)")
    void testStructuredProgressCalculation() {
        String projId = "proj-structured-cds";
        ProjectEntity project = new ProjectEntity();
        project.setId(projId);
        project.setMode("STRUCTURED");
        project.setLastProgressPercent(new BigDecimal("50"));
        when(projectRepository.findByIdAndOrgId(projId, ORG)).thenReturn(Optional.of(project));

        // The accepted-work math (fixtures 50%, 40%, 16%, Not measurable) is in StructuredProgressTest and
        // ProgressSnapshotIntegrationTest; this service only reads the stored, calculated figure.
        assertEquals(new BigDecimal("50"), developerService.calculateStructuredProgress(ORG, projId));
        verify(workItemRepository, never()).findByOrgIdAndProjectId(ORG, projId);
    }

    @Test
    @DisplayName("Task status update goes through the task 3.3 workflow rules and keeps the note as a comment")
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

        // The real transition (revision binding, review rules) is covered by ReviewWorkflowIntegrationTest.
        verify(workflow).legacyTransition(any(), eq(taskId), eq("IN_REVIEW"), eq("Ready for review"));
        assertEquals(taskId, updated.id());
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
    @DisplayName("Blocker lifecycle goes through the shared task 3.4 rules and never changes the workflow state")
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
        TaskBlockerEntity stored = new TaskBlockerEntity();
        stored.setId("blk-1");
        stored.setOrgId(ORG);
        stored.setTaskId(taskId);
        stored.setSeverity("CRITICAL");
        when(taskBlockerRepository.findByIdAndOrgId("blk-1", ORG)).thenReturn(Optional.of(stored));
        when(blockers.raise(any(), eq(taskId), any())).thenReturn(new com.prowise.work.BlockerService.BlockerView(
                "blk-1", taskId, "K-1", "Task", "Waiting", "CRITICAL", null, null, false, null, null, null, 0));

        DeveloperDTOs.TaskBlockerRequest req = new DeveloperDTOs.TaskBlockerRequest("Waiting on external API credentials", "CRITICAL");
        TaskBlockerEntity blocker = developerService.submitTaskBlocker(actor(USER), taskId, req);

        // Task 3.4: the shared blocker rules (separate flag, owner, audit) run in BlockerService; see
        // DependencyBlockerIntegrationTest. Domain rule (T21): the workflow state never changes here.
        verify(blockers).raise(any(), eq(taskId), eq(new com.prowise.work.BlockerService.RaiseRequest(
                "Waiting on external API credentials", "CRITICAL", null)));
        assertEquals("CRITICAL", blocker.getSeverity());
        assertEquals(ORG, blocker.getOrgId());
        assertEquals("IN_PROGRESS", item.getState());

        developerService.resolveTaskBlocker(actor(USER), "blk-1");
        verify(blockers).resolve(any(), eq("blk-1"), any());
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
    @DisplayName("Code review approval is evidence only: the linked task stays in review (AS-03, rule 9)")
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
        // A pull request review never replaces the required work-item review (docs/tasks/phase-3.md AS-03).
        assertEquals("IN_REVIEW", task.getState());
        verify(workItemRepository, never()).save(any());
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

    /* ------------------------------------------------------------------ issues (Blockers & Issues) */

    private ProjectEntity project(String id) {
        ProjectEntity p = new ProjectEntity();
        p.setId(id);
        p.setOrgId(ORG);
        when(projectRepository.findByIdAndOrgId(id, ORG)).thenReturn(Optional.of(p));
        return p;
    }

    @Test
    @DisplayName("A developer reports an issue for themselves; an assignee id from the request body is never trusted")
    void reportedIssueIsAssignedToTheReporter() {
        project("proj-1");
        when(bugRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        BugEntity bug = developerService.createBug(actor(USER), new DeveloperDTOs.CreateBugRequest(
                "proj-1", "Login fails", "Steps in description", "high", null, null, "someone-in-another-org"));

        assertEquals(USER, bug.getAssignedTo());
        assertEquals(USER, bug.getReportedBy());
        assertEquals("HIGH", bug.getSeverity());
        assertEquals("OPEN", bug.getStatus());
    }

    @Test
    @DisplayName("Issue title and severity are validated before anything is stored")
    void issueValidation() {
        project("proj-1");
        ApiException noTitle = assertThrows(ApiException.class, () -> developerService.createBug(actor(USER),
                new DeveloperDTOs.CreateBugRequest("proj-1", "  ", "d", "LOW", null, null, null)));
        assertEquals(HttpStatus.BAD_REQUEST, noTitle.status());
        ApiException badSeverity = assertThrows(ApiException.class, () -> developerService.createBug(actor(USER),
                new DeveloperDTOs.CreateBugRequest("proj-1", "Title", "d", "URGENT", null, null, null)));
        assertEquals(HttpStatus.BAD_REQUEST, badSeverity.status());
        verify(bugRepository, never()).save(any());
    }

    @Test
    @DisplayName("Issue status accepts only the known lifecycle values")
    void issueStatusIsValidated() {
        BugEntity bug = new BugEntity();
        bug.setId("bug-1");
        bug.setOrgId(ORG);
        bug.setProjectId("proj-1");
        bug.setAssignedTo(USER);
        when(bugRepository.findByIdAndOrgId("bug-1", ORG)).thenReturn(Optional.of(bug));
        when(bugRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ApiException invalid = assertThrows(ApiException.class, () -> developerService.updateBugStatus(actor(USER), "bug-1",
                new DeveloperDTOs.UpdateBugStatusRequest("DELETED", null)));
        assertEquals(HttpStatus.BAD_REQUEST, invalid.status());
        verify(bugRepository, never()).save(any());

        BugEntity resolved = developerService.updateBugStatus(actor(USER), "bug-1",
                new DeveloperDTOs.UpdateBugStatusRequest("resolved", "Fixed in PR 12"));
        assertEquals("RESOLVED", resolved.getStatus());
        assertNotNull(resolved.getResolvedAt());
    }
}
