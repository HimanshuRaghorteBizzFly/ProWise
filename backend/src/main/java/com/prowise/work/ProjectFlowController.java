package com.prowise.work;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Guided project setup, project approvers, the approver's review queue, task activity and the progress overview. */
@RestController
@Tag(name = "Project delivery flow", description = "Setup wizard, approvers, review queue, task history, progress overview")
public class ProjectFlowController {

    private static final String MEMBER = "@permissionService.tokenOrgMember(authentication)";

    private final ProjectSetupService setup;
    private final ProjectFlowService flow;

    public ProjectFlowController(ProjectSetupService setup, ProjectFlowService flow) {
        this.setup = setup;
        this.flow = flow;
    }

    @GetMapping("/v1/organizations/{orgId}/project-setup/options")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'project.create')")
    @Operation(summary = "People who can be assigned or chosen as approvers (never Owner/Admin), with role and workload")
    public ProjectSetupService.SetupOptions options(@PathVariable UUID orgId, Authentication authentication) {
        return setup.options(orgId, authentication);
    }

    @PostMapping("/v1/organizations/{orgId}/project-setup")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'project.create')")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a Solo or Team project with documents, phases, tasks (points total at most 100), people and approvers in one transaction")
    public ProjectSetupService.SetupResult create(@PathVariable UUID orgId,
            @RequestBody ProjectSetupService.SetupRequest request, Authentication authentication) {
        return setup.create(orgId, authentication, request);
    }

    @GetMapping("/v1/projects/{projectId}/approvers")
    @PreAuthorize(MEMBER)
    @Operation(summary = "The project's chosen approvers and whether the caller is one")
    public ProjectFlowService.ApproversView approvers(@PathVariable String projectId, Authentication authentication) {
        return flow.approvers(authentication, projectId);
    }

    @PutMapping("/v1/projects/{projectId}/approvers")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Replace the project's approvers (project.edit; expected_version of the project)")
    public ProjectFlowService.ApproversView replaceApprovers(@PathVariable String projectId,
            @RequestBody ProjectFlowService.ApproversRequest request, Authentication authentication) {
        return flow.replaceApprovers(authentication, projectId, request);
    }

    @GetMapping("/v1/me/review-queue")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Tasks and Solo submissions waiting for the caller's decision (only projects where they approve)")
    public List<ProjectFlowService.QueueItem> reviewQueue(Authentication authentication) {
        return flow.reviewQueue(authentication);
    }

    @GetMapping("/v1/work-items/{workItemId}/activity")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Append-only history of a task (who, what, when, why)")
    public List<ProjectFlowService.ActivityEntry> activity(@PathVariable String workItemId, Authentication authentication) {
        return flow.activity(authentication, workItemId);
    }

    @GetMapping("/v1/organizations/{orgId}/progress/projects")
    @PreAuthorize("@permissionService.member(authentication, #orgId)")
    @Operation(summary = "Paginated progress per readable project (search, mode, status, sort name|progress|target|updated)")
    public com.prowise.common.api.CursorPage<ProjectFlowService.ProgressRow> progressProjects(@PathVariable UUID orgId,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String q,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String mode,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String status,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String sort,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String cursor,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Integer limit,
            Authentication authentication) {
        return flow.progressPage(orgId, authentication, q, mode, status, sort, cursor, limit);
    }

    @GetMapping("/v1/organizations/{orgId}/progress-overview")
    @PreAuthorize("@permissionService.member(authentication, #orgId)")
    @Operation(summary = "Progress of every readable project with its method label; Solo pending figures shown separately")
    public List<ProjectFlowService.ProgressRow> progressOverview(@PathVariable UUID orgId, Authentication authentication) {
        return flow.progressOverview(orgId, authentication);
    }
}
