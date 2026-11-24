package com.prowise.work;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.work.ScopeService.ProjectScopeVersion;

/**
 * Task 3.2 cross-project reads: scope versions of every Structured project the caller may read, and one version by
 * id (404 when its project is not readable). Drafts and approval stay on the project routes (ScopeController).
 */
@RestController
@RequestMapping("/v1/organizations/{orgId}/scope-versions")
public class OrgScopeController {

    private static final String MEMBER = "@permissionService.member(authentication, #orgId)";

    private final ScopeService scope;

    public OrgScopeController(ScopeService scope) {
        this.scope = scope;
    }

    @GetMapping
    @PreAuthorize(MEMBER)
    List<ProjectScopeVersion> list(@PathVariable UUID orgId, Authentication authentication,
            @RequestParam(value = "status", required = false) String status) {
        return scope.orgVersions(orgId, authentication, status);
    }

    @GetMapping("/{versionId}")
    @PreAuthorize(MEMBER)
    ProjectScopeVersion get(@PathVariable UUID orgId, @PathVariable UUID versionId, Authentication authentication) {
        return scope.orgVersion(orgId, versionId, authentication);
    }
}
