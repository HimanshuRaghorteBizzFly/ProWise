package com.prowise.work;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Task 3.4: dependencies and blockers. */
@RestController
@Tag(name = "Dependencies and blockers", description = "Finish-to-Start links and blockers (a separate flag, not a state)")
public class DependencyController {

    private static final String MEMBER = "@permissionService.tokenOrgMember(authentication)";

    private final DependencyService dependencies;
    private final BlockerService blockers;

    public DependencyController(DependencyService dependencies, BlockerService blockers) {
        this.dependencies = dependencies;
        this.blockers = blockers;
    }

    @PostMapping("/v1/work-items/{workItemId}/dependencies")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Make this work wait for a prerequisite in the same project (planners); returns affected work")
    public ResponseEntity<DependencyService.LinkResult> link(@PathVariable String workItemId,
            @RequestBody DependencyService.LinkRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(dependencies.link(authentication, workItemId, request));
    }

    @GetMapping("/v1/work-items/{workItemId}/dependencies")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Blocked by, blocks, and all downstream work affected by this item")
    public DependencyService.DependencyView view(@PathVariable String workItemId, Authentication authentication) {
        return dependencies.view(authentication, workItemId);
    }

    @DeleteMapping("/v1/dependencies/{dependencyId}")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Remove a dependency link (planners)")
    public ResponseEntity<Void> unlink(@PathVariable UUID dependencyId, Authentication authentication) {
        dependencies.unlink(authentication, dependencyId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/v1/work-items/{workItemId}/blockers")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Flag the work as blocked with a reason, owner and severity (assignee or planner)")
    public ResponseEntity<BlockerService.BlockerView> raise(@PathVariable String workItemId,
            @RequestBody BlockerService.RaiseRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(blockers.raise(authentication, workItemId, request));
    }

    @GetMapping("/v1/work-items/{workItemId}/blockers")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Open and cleared blockers of a work item")
    public List<BlockerService.BlockerView> forWorkItem(@PathVariable String workItemId, Authentication authentication) {
        return blockers.forWorkItem(authentication, workItemId);
    }

    @GetMapping("/v1/projects/{projectId}/work-item-blockers")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Open work-item blockers of a readable project, critical first, with age (project-level delivery blockers stay at /blockers)")
    public List<BlockerService.BlockerView> openForProject(@PathVariable String projectId, Authentication authentication) {
        return blockers.openForProject(authentication, projectId);
    }

    @PostMapping("/v1/blockers/{blockerId}/resolve")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Clear a blocker (owner, reporter, assignee or planner); the work keeps its state")
    public BlockerService.BlockerView resolve(@PathVariable String blockerId,
            @RequestBody(required = false) BlockerService.ResolveRequest request, Authentication authentication) {
        return blockers.resolve(authentication, blockerId, request);
    }
}
