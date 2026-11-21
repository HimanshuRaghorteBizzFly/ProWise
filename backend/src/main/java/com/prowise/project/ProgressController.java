package com.prowise.project;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.developer.DeveloperAccess;
import com.prowise.developer.DeveloperAccess.Actor;
import com.prowise.developer.GitHubActivityEntity;
import com.prowise.project.ProgressDTOs.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping
@Tag(name = "Project Progress & Verification", description = "Endpoints for Individual progress check-ins, append-only corrections, and Team Lead verification")
public class ProgressController {

    private static final String MEMBER = "@permissionService.tokenOrgMember(authentication)";

    private final ProgressService progressService;
    private final DeveloperAccess access;

    public ProgressController(ProgressService progressService, DeveloperAccess access) {
        this.progressService = progressService;
        this.access = access;
    }

    private Actor actor(Authentication auth) {
        return access.actor(auth);
    }

    // 1. Submit progress check-in (T17, T18, AS-01)
    @PostMapping({"/v1/projects/{projectId}/checkins", "/api/v1/projects/{projectId}/checkins"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Submit developer progress check-in (accountable developer only)")
    public ResponseEntity<CheckInResponse> submitCheckIn(
            @PathVariable String projectId,
            @Valid @RequestBody CheckInSubmissionRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            Authentication auth) {
        CheckInResponse response = progressService.submitCheckIn(actor(auth), projectId, request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // 2. Get project check-in history
    @GetMapping({"/v1/projects/{projectId}/checkins", "/api/v1/projects/{projectId}/checkins"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get immutable progress check-in history for a project")
    public List<CheckInResponse> getProjectCheckIns(
            @PathVariable String projectId,
            Authentication auth) {
        return progressService.getProjectCheckIns(actor(auth), projectId);
    }

    // 3. Get progress summary (latest accepted, pending, and current progress)
    @GetMapping({"/v1/projects/{projectId}/checkins/summary", "/api/v1/projects/{projectId}/checkins/summary"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get project progress summary with current accepted and pending values")
    public ProgressSummaryResponse getProgressSummary(
            @PathVariable String projectId,
            Authentication auth) {
        return progressService.getProjectProgressSummary(actor(auth), projectId);
    }

    // 4. Verify check-in (Team Lead / Reviewer decision)
    @PostMapping({"/v1/checkins/{checkinId}/verify", "/api/v1/checkins/{checkinId}/verify"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Verify or request changes on a developer progress check-in")
    public CheckInResponse verifyCheckIn(
            @PathVariable String checkinId,
            @Valid @RequestBody VerificationDecisionRequest request,
            Authentication auth) {
        return progressService.verifyCheckIn(actor(auth), checkinId, request);
    }

    // 5. Team Lead pending reviews queue
    @GetMapping({"/v1/organizations/{orgId}/reviews/pending", "/api/v1/organizations/{orgId}/reviews/pending"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get pending progress check-ins awaiting verification across the organization")
    public List<PendingReviewResponse> getPendingReviews(
            @PathVariable UUID orgId,
            Authentication auth) {
        return progressService.getPendingReviews(actor(auth), orgId);
    }

    // 6. GitHub activity for project / repos
    @GetMapping({"/v1/projects/{projectId}/github-activity", "/api/v1/projects/{projectId}/github-activity"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get GitHub commits and pull requests for project evidence")
    public List<GitHubActivityEntity> getGitHubActivity(
            @PathVariable String projectId,
            Authentication auth) {
        return progressService.getGitHubActivity(actor(auth), projectId);
    }

    // 7. Link repository to project
    @PostMapping({"/v1/projects/{projectId}/repositories", "/api/v1/projects/{projectId}/repositories"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Link a GitHub repository to a project")
    public ResponseEntity<Void> linkRepository(
            @PathVariable String projectId,
            @Valid @RequestBody AttachRepoRequest request,
            Authentication auth) {
        progressService.linkRepository(actor(auth), projectId, request);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    // 8. Toggle project verification requirement
    @PatchMapping({"/v1/projects/{projectId}/settings/verification", "/api/v1/projects/{projectId}/settings/verification"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Toggle verification requirement for project check-ins")
    public ResponseEntity<Void> setRequireVerification(
            @PathVariable String projectId,
            @RequestBody ToggleVerificationRequest request,
            Authentication auth) {
        progressService.setRequireVerification(actor(auth), projectId, request.requireVerification());
        return ResponseEntity.noContent().build();
    }
}
