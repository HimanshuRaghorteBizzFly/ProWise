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

import com.prowise.work.ScopeService.DraftRequest;
import com.prowise.work.ScopeService.ScopeVersion;

/** Task 3.2 routes: scope versions of a project (read), drafts and approval (project.scope.change in the service). */
@RestController
@RequestMapping("/v1/organizations/{orgId}/projects/{projectId}/scope-versions")
public class ScopeController {

    private static final String MEMBER = "@permissionService.member(authentication, #orgId)";

    private final ScopeService scope;

    public ScopeController(ScopeService scope) {
        this.scope = scope;
    }

    @GetMapping
    @PreAuthorize(MEMBER)
    List<ScopeVersion> list(@PathVariable UUID orgId, @PathVariable String projectId, Authentication authentication) {
        return scope.list(orgId, projectId, authentication);
    }

    @PostMapping
    @PreAuthorize(MEMBER)
    ResponseEntity<ScopeVersion> draft(@PathVariable UUID orgId, @PathVariable String projectId, Authentication authentication,
            @RequestBody DraftRequest request) {
        return ResponseEntity.status(201).body(scope.createDraft(orgId, projectId, authentication, request));
    }

    @PostMapping("/{versionId}/approve")
    @PreAuthorize(MEMBER)
    ScopeVersion approve(@PathVariable UUID orgId, @PathVariable String projectId, @PathVariable UUID versionId,
            Authentication authentication, @RequestBody WorkController.VersionBody body) {
        return scope.approve(orgId, projectId, versionId, authentication, body.expectedVersion());
    }
}
