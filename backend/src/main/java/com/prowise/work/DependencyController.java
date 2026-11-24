package com.prowise.work;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.work.BlockerService.Blocker;
import com.prowise.work.BlockerService.BlockerRequest;
import com.prowise.work.BlockerService.Raised;
import com.prowise.work.BlockerService.ResolveRequest;
import com.prowise.work.DependencyService.Board;
import com.prowise.work.DependencyService.Change;
import com.prowise.work.DependencyService.ItemRef;
import com.prowise.work.DependencyService.LinkRequest;
import com.prowise.work.DependencyService.ReleaseRequest;
import com.prowise.work.DependencyService.VersionRequest;

/**
 * Task 3.4 routes. The membership is checked here; project.edit (links), task.update (raising blockers) and the
 * owner / opener / project.edit rule (resolving) are checked in the services against the project and the task.
 */
@RestController
@RequestMapping("/v1/organizations/{orgId}/projects/{projectId}")
public class DependencyController {

    private static final String MEMBER = "@permissionService.member(authentication, #orgId)";

    private final DependencyService dependencies;
    private final BlockerService blockers;

    public DependencyController(DependencyService dependencies, BlockerService blockers) {
        this.dependencies = dependencies;
        this.blockers = blockers;
    }

    @GetMapping("/dependencies")
    @PreAuthorize(MEMBER)
    Board board(@PathVariable UUID orgId, @PathVariable String projectId, Authentication authentication) {
        return dependencies.board(orgId, projectId, authentication, blockers);
    }

    @PostMapping("/work-items/{itemId}/dependencies")
    @PreAuthorize(MEMBER)
    ResponseEntity<Change> link(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId,
            Authentication authentication, @RequestBody LinkRequest request) {
        return ResponseEntity.status(201).body(dependencies.link(orgId, projectId, itemId, authentication, request));
    }

    @PostMapping("/work-items/{itemId}/dependencies/{linkId}/remove")
    @PreAuthorize(MEMBER)
    Change unlink(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId, @PathVariable UUID linkId,
            Authentication authentication, @RequestBody VersionRequest request) {
        return dependencies.unlink(orgId, projectId, itemId, linkId, authentication, request);
    }

    @PostMapping("/work-items/{itemId}/dependencies/release")
    @PreAuthorize(MEMBER)
    Change release(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId, Authentication authentication,
            @RequestBody ReleaseRequest request) {
        return dependencies.release(orgId, projectId, itemId, authentication, request);
    }

    @PostMapping("/work-items/{itemId}/dependency-flag/clear")
    @PreAuthorize(MEMBER)
    ItemRef clearFlag(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId, Authentication authentication,
            @RequestBody VersionRequest request) {
        return dependencies.clearFlag(orgId, projectId, itemId, authentication, request);
    }

    @GetMapping("/work-items/{itemId}/blockers")
    @PreAuthorize(MEMBER)
    List<Blocker> blockers(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId, Authentication authentication) {
        return blockers.list(orgId, projectId, itemId, authentication);
    }

    @PostMapping("/work-items/{itemId}/blockers")
    @PreAuthorize(MEMBER)
    ResponseEntity<Raised> raise(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId,
            Authentication authentication, @RequestBody BlockerRequest request) {
        return ResponseEntity.status(201).body(blockers.raise(orgId, projectId, itemId, authentication, request));
    }

    @PostMapping("/work-items/{itemId}/blockers/{blockerId}/resolve")
    @PreAuthorize(MEMBER)
    Raised resolve(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable String itemId, @PathVariable String blockerId,
            Authentication authentication, @RequestBody ResolveRequest request) {
        return blockers.resolve(orgId, projectId, itemId, blockerId, authentication, request);
    }
}
