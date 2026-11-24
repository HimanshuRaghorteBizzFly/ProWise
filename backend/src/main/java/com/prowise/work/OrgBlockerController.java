package com.prowise.work;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.work.BlockerService.ProjectBlocker;

/**
 * Task 3.4 cross-project reads: open blockers of every Structured project the caller may read, and one blocker by id
 * (404 when its project is not readable). Raising and clearing stay on the project routes (DependencyController).
 */
@RestController
@RequestMapping("/v1/organizations/{orgId}/blockers")
public class OrgBlockerController {

    private static final String MEMBER = "@permissionService.member(authentication, #orgId)";

    private final BlockerService blockers;

    public OrgBlockerController(BlockerService blockers) {
        this.blockers = blockers;
    }

    @GetMapping
    @PreAuthorize(MEMBER)
    List<ProjectBlocker> open(@PathVariable UUID orgId, Authentication authentication) {
        return blockers.orgOpen(orgId, authentication);
    }

    @GetMapping("/{blockerId}")
    @PreAuthorize(MEMBER)
    ProjectBlocker get(@PathVariable UUID orgId, @PathVariable String blockerId, Authentication authentication) {
        return blockers.orgBlocker(orgId, blockerId, authentication);
    }
}
