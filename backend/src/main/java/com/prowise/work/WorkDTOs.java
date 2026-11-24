package com.prowise.work;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.prowise.project.ProjectService;

/** Task 3.1 request and response shapes (JSON is snake_case globally). */
public final class WorkDTOs {

    private WorkDTOs() {}

    public record PersonRef(UUID membershipId, String email) {}

    /** One task under a phase in the Create Project setup: title, points, and its reviewer. */
    public record SetupTask(String title, BigDecimal points, UUID reviewerMembershipId) {}

    public record SetupPhase(String title, List<SetupTask> tasks) {}

    /** Create a Structured project together with its documents, phases and tasks (one transaction). */
    public record ConfiguredProjectRequest(ProjectService.CreateProjectRequest project, List<String> documentIds,
            List<SetupPhase> phases) {}

    public record WorkItem(String id, String key, String type, String parentId, String title, String description,
            BigDecimal points, String unit, UUID workTypeId, String workTypeName, PersonRef assignee, PersonRef reviewer,
            List<PersonRef> collaborators, String state, int position, boolean leaf, long version, Instant createdAt) {}

    public record ConfiguredProject(ProjectService.ProjectResponse project, List<WorkItem> items, List<Document> documents) {}

    public record AddWorkItemRequest(String type, String parentId, String title, String description, BigDecimal points,
            UUID workTypeId, UUID reviewerMembershipId) {}

    public record UpdateWorkItemRequest(String title, String description, UUID workTypeId, String parentId,
            Boolean moveToProjectRoot, BigDecimal points, Long expectedVersion) {}

    public record AssignmentRequest(UUID assigneeMembershipId, UUID reviewerMembershipId,
            List<UUID> collaboratorMembershipIds, String reason, Long expectedVersion) {}

    public record AssignmentChange(PersonRef previousAssignee, PersonRef newAssignee, PersonRef previousReviewer,
            PersonRef newReviewer, String reason, String actorEmail, Instant occurredAt) {}

    /** A leaf a Team Lead or Project Manager can assign, with its project. */
    public record AssignableItem(String projectId, String projectKey, String projectName, WorkItem item) {}

    public record WorkType(UUID id, String name, String description, boolean retired, long version) {}

    public record WorkTypeRequest(String name, String description, Long expectedVersion) {}

    public record Document(String id, String projectId, String fileName, long fileSize, String fileType,
            String uploadedByEmail, Instant uploadedAt) {}
}
