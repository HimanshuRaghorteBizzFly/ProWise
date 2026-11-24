package com.prowise.work;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * The caller's own structured work across the active organization (Developer workspace). Only the caller's own items
 * on projects they can still read; nothing here lists other people's work.
 */
@RestController
@Tag(name = "My work", description = "The signed-in member's own work items, blockers and review feedback")
public class MyWorkController {

    private static final String MEMBER = "@permissionService.tokenOrgMember(authentication)";

    private final WorkItemService workItems;
    private final BlockerService blockers;
    private final WorkflowService workflow;

    public MyWorkController(WorkItemService workItems, BlockerService blockers, WorkflowService workflow) {
        this.workItems = workItems;
        this.blockers = blockers;
        this.workflow = workflow;
    }

    @GetMapping("/v1/me/work-items")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Work where I am the primary assignee or a collaborator")
    public List<WorkItemService.WorkItemResponse> workItems(Authentication authentication) {
        return workItems.mine(authentication);
    }

    @GetMapping("/v1/me/blockers")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Blockers on my work or owned by me")
    public List<BlockerService.BlockerView> blockers(Authentication authentication) {
        return blockers.mine(authentication);
    }

    @GetMapping("/v1/me/review-feedback")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Review decisions on my submissions")
    public List<WorkflowService.FeedbackView> reviewFeedback(Authentication authentication) {
        return workflow.myFeedback(authentication);
    }
}
