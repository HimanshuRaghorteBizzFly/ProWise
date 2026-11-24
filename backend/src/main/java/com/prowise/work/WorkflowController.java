package com.prowise.work;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Task 3.3 workflow: start, submit, review, reopen and required checks. */
@RestController
@Tag(name = "Work workflow", description = "Start, submit for review, review decisions, reopen and required checks")
public class WorkflowController {

    private static final String MEMBER = "@permissionService.tokenOrgMember(authentication)";

    private final WorkflowService service;

    public WorkflowController(WorkflowService service) {
        this.service = service;
    }

    @PostMapping("/v1/work-items/{workItemId}/start")
    @PreAuthorize(MEMBER)
    @Operation(summary = "The primary assignee starts work (To Do -> In Progress)")
    public WorkItemService.WorkItemResponse start(@PathVariable String workItemId,
            @RequestBody WorkflowService.VersionRequest request, Authentication authentication) {
        return service.start(authentication, workItemId, request);
    }

    @PostMapping("/v1/work-items/{workItemId}/submissions")
    @PreAuthorize(MEMBER)
    @Operation(summary = "The primary assignee submits the current revision with evidence (In Review, or Done without required review)")
    public WorkItemService.WorkItemResponse submit(@PathVariable String workItemId,
            @RequestBody WorkflowService.SubmissionRequest request, Authentication authentication) {
        return service.submit(authentication, workItemId, request);
    }

    @PostMapping("/v1/work-items/{workItemId}/reviews")
    @PreAuthorize(MEMBER)
    @Operation(summary = "The assigned reviewer approves or requests changes on the submitted revision (409 STALE_REVIEW if outdated)")
    public WorkItemService.WorkItemResponse review(@PathVariable String workItemId,
            @RequestBody WorkflowService.ReviewRequest request, Authentication authentication) {
        return service.review(authentication, workItemId, request);
    }

    @GetMapping("/v1/work-items/{workItemId}/reviews")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Submissions, review decisions, required checks and reopen history")
    public WorkflowService.ReviewHistory history(@PathVariable String workItemId, Authentication authentication) {
        return service.history(authentication, workItemId);
    }

    @PostMapping("/v1/work-items/{workItemId}/reopen")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Reopen completed work with a reason (removes the credit, keeps history)")
    public WorkItemService.WorkItemResponse reopen(@PathVariable String workItemId,
            @RequestBody WorkflowService.ReopenRequest request, Authentication authentication) {
        return service.reopen(authentication, workItemId, request);
    }

    @PutMapping("/v1/work-items/{workItemId}/checks")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Define the required checks of a work item (planners)")
    public WorkItemService.WorkItemResponse defineChecks(@PathVariable String workItemId,
            @RequestBody WorkflowService.ChecksRequest request, Authentication authentication) {
        return service.defineChecks(authentication, workItemId, request);
    }

    @PostMapping("/v1/work-items/{workItemId}/checks/{checkKey}")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Mark a required check as satisfied or not (reviewer or planner, never the assignee)")
    public List<WorkflowService.CheckView> markCheck(@PathVariable String workItemId, @PathVariable String checkKey,
            @RequestBody WorkflowService.CheckMark request, Authentication authentication) {
        return service.markCheck(authentication, workItemId, checkKey, request);
    }
}
