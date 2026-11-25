package com.prowise.project;

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
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.common.api.IdempotencyFilter;
import com.prowise.developer.GitHubActivityEntity;
import com.prowise.project.ProgressDTOs.AttachRepoRequest;
import com.prowise.project.ProgressDTOs.CheckIn;
import com.prowise.project.ProgressDTOs.CheckInRequest;
import com.prowise.project.ProgressDTOs.DecisionRequest;
import com.prowise.project.ProgressDTOs.PendingReview;
import com.prowise.project.ProgressDTOs.ProgressSummary;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Task 2.2: check-ins and Team Lead approval. Routes only check the org-bound token membership here;
 * ProgressService applies the project read rule (404), the accountable-developer rule and the team-lead rule.
 */
@RestController
@Tag(name = "Project progress", description = "Individual check-ins, append-only corrections and Team Lead approval")
public class ProgressController {

    private static final String MEMBER = "@permissionService.tokenOrgMember(authentication)";

    private final ProgressService progress;

    public ProgressController(ProgressService progress) {
        this.progress = progress;
    }

    @PostMapping({"/v1/projects/{projectId}/checkins", "/api/v1/projects/{projectId}/checkins"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Submit a check-in or correction (accountable developer). Starts PENDING; replay-safe with Idempotency-Key")
    public ResponseEntity<CheckIn> submit(@PathVariable String projectId, @RequestBody CheckInRequest request,
            @RequestHeader(value = IdempotencyFilter.HEADER, required = false) String idempotencyKey,
            Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(progress.submit(authentication, projectId, request, idempotencyKey));
    }

    @GetMapping({"/v1/projects/{projectId}/checkins", "/api/v1/projects/{projectId}/checkins",
            "/v1/projects/{projectId}/progress-history", "/api/v1/projects/{projectId}/progress-history"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "All check-ins of a project, newest first, with author, time, method and status")
    public List<CheckIn> history(@PathVariable String projectId, Authentication authentication) {
        return progress.history(authentication, projectId);
    }

    @GetMapping({"/v1/projects/{projectId}/checkins/summary", "/api/v1/projects/{projectId}/checkins/summary"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Approved figure (or Not reported), the pending entry, the approver and what the caller may do")
    public ProgressSummary summary(@PathVariable String projectId, Authentication authentication) {
        return progress.summary(authentication, projectId);
    }

    @GetMapping("/v1/checkins/{checkinId}")
    @PreAuthorize(MEMBER)
    @Operation(summary = "One Solo submission with its project and the approved figure (404 when the project is not readable)")
    public PendingReview checkin(@PathVariable String checkinId, Authentication authentication) {
        return progress.one(authentication, checkinId);
    }

    @PostMapping({"/v1/checkins/{checkinId}/decision", "/api/v1/checkins/{checkinId}/decision"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Approve or request changes on a pending Solo submission (a chosen approver, or the team lead; never own)")
    public CheckIn decide(@PathVariable String checkinId, @RequestBody DecisionRequest request,
            Authentication authentication) {
        return progress.decide(authentication, checkinId, request);
    }

    @GetMapping({"/v1/organizations/{orgId}/reviews/pending", "/api/v1/organizations/{orgId}/reviews/pending"})
    @PreAuthorize("@permissionService.member(authentication, #orgId)")
    @Operation(summary = "The caller's approval queue: pending check-ins of projects whose team they lead")
    public List<PendingReview> pending(@PathVariable UUID orgId, Authentication authentication) {
        return progress.pendingQueue(authentication, orgId);
    }

    @GetMapping({"/v1/projects/{projectId}/github-activity", "/api/v1/projects/{projectId}/github-activity"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Repository events of a project (evidence only; never sets progress)")
    public List<GitHubActivityEntity> gitHubActivity(@PathVariable String projectId, Authentication authentication) {
        return progress.gitHubActivity(authentication, projectId);
    }

    @PostMapping({"/v1/projects/{projectId}/repositories", "/api/v1/projects/{projectId}/repositories"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Link a repository to a project")
    public ResponseEntity<Void> linkRepository(@PathVariable String projectId, @RequestBody AttachRepoRequest request,
            Authentication authentication) {
        progress.linkRepository(authentication, projectId, request);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }
}
