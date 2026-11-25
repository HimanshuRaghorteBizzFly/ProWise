package com.prowise.work;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Task 3.2 scope versions. Organization from the org-bound token; the service checks permission and state. */
@RestController
@Tag(name = "Scope versions", description = "Approved scope (baseline) with versioned, explained changes")
public class ScopeController {

    private static final String MEMBER = "@permissionService.tokenOrgMember(authentication)";

    private final ScopeService service;
    private final StructuredSnapshotService snapshots;

    public ScopeController(ScopeService service, StructuredSnapshotService snapshots) {
        this.service = service;
        this.snapshots = snapshots;
    }

    @GetMapping("/v1/projects/{projectId}/structured-progress")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Calculated progress from accepted work in the active baseline, its explanation and all snapshots")
    public StructuredSnapshotService.StructuredProgressView structuredProgress(@PathVariable String projectId,
            Authentication authentication) {
        return snapshots.view(authentication, projectId);
    }

    @GetMapping("/v1/projects/{projectId}/scope-versions")
    @PreAuthorize(MEMBER)
    @Operation(summary = "All scope versions of a readable project (drafts, active, superseded, discarded)")
    public List<ScopeService.ScopeVersionSummary> list(@PathVariable String projectId, Authentication authentication) {
        return service.list(authentication, projectId);
    }

    @PostMapping("/v1/projects/{projectId}/scope-versions")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Propose a scope change against the current baseline (project.scope.change)")
    public ResponseEntity<ScopeService.ScopeVersionResponse> draft(@PathVariable String projectId,
            @RequestBody ScopeService.DraftRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.draft(authentication, projectId, request));
    }

    @GetMapping("/v1/scope-versions/{versionId}")
    @PreAuthorize(MEMBER)
    @Operation(summary = "One scope version with its leaves, the difference to its base and the effect on progress")
    public ScopeService.ScopeVersionResponse get(@PathVariable UUID versionId, Authentication authentication) {
        return service.get(authentication, versionId);
    }

    @PostMapping("/v1/scope-versions/{versionId}/approve")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Approve a draft: it becomes the only active baseline (409 STALE_VERSION if the baseline moved)")
    public ScopeService.ScopeVersionResponse approve(@PathVariable UUID versionId,
            @RequestBody ScopeService.DecisionRequest request, Authentication authentication) {
        return service.approve(authentication, versionId, request);
    }

    @PostMapping("/v1/scope-versions/{versionId}/discard")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Discard a draft; parts it proposed by splitting are retired")
    public ScopeService.ScopeVersionResponse discard(@PathVariable UUID versionId,
            @RequestBody ScopeService.DecisionRequest request, Authentication authentication) {
        return service.discard(authentication, versionId, request);
    }
}
