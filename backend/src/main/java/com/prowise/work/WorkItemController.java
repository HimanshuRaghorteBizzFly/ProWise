package com.prowise.work;

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
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Task 3.1 work breakdown. The organization comes from the org-bound token; every handler re-checks the active
 * membership ({@code tokenOrgMember}) and the service checks the scoped permission, the project relationship and the
 * allowed state. Writes accept {@code Idempotency-Key} (task 1.4 filter) and {@code expected_version}.
 */
@RestController
@Tag(name = "Work items", description = "Structured breakdown: milestones, deliverables, tasks, subtasks and assignment")
public class WorkItemController {

    private static final String MEMBER = "@permissionService.tokenOrgMember(authentication)";

    private final WorkItemService service;

    public WorkItemController(WorkItemService service) {
        this.service = service;
    }

    @GetMapping("/v1/projects/{projectId}/work-items")
    @PreAuthorize(MEMBER)
    @Operation(summary = "List the work breakdown of a readable project (flat, with parent ids and depth)")
    public List<WorkItemService.WorkItemResponse> list(@PathVariable String projectId, Authentication authentication) {
        return service.list(authentication, projectId);
    }

    @PostMapping("/v1/projects/{projectId}/work-items")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Create a milestone, deliverable, task or subtask (task.create); starts as a draft without weight")
    public ResponseEntity<WorkItemService.WorkItemResponse> create(@PathVariable String projectId,
            @RequestBody WorkItemService.CreateWorkItemRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(authentication, projectId, request));
    }

    @GetMapping("/v1/work-items/{workItemId}")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Read one work item")
    public WorkItemService.WorkItemResponse get(@PathVariable String workItemId, Authentication authentication) {
        return service.get(authentication, workItemId);
    }

    @PatchMapping("/v1/work-items/{workItemId}")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Edit a work item (planners: all fields; the assignee: description only); expected_version required")
    public WorkItemService.WorkItemResponse update(@PathVariable String workItemId,
            @RequestBody WorkItemService.UpdateWorkItemRequest request, Authentication authentication) {
        return service.update(authentication, workItemId, request);
    }

    @PutMapping("/v1/work-items/{workItemId}/assignment")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Set the primary assignee, reviewer and collaborators (task.assign); history is kept")
    public WorkItemService.WorkItemResponse assign(@PathVariable String workItemId,
            @RequestBody WorkItemService.AssignmentRequest request, Authentication authentication) {
        return service.assign(authentication, workItemId, request);
    }

    @GetMapping("/v1/work-items/{workItemId}/assignment-history")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Who held this work before (append-only)")
    public List<WorkItemService.AssignmentChange> assignmentHistory(@PathVariable String workItemId,
            Authentication authentication) {
        return service.assignmentHistory(authentication, workItemId);
    }

    @PostMapping("/v1/work-items/{workItemId}/retire")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Retire draft work with a reason (approved work needs a scope change)")
    public WorkItemService.WorkItemResponse retire(@PathVariable String workItemId,
            @RequestBody WorkItemService.RetireRequest request, Authentication authentication) {
        return service.retire(authentication, workItemId, request);
    }
}
