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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Create Project step by step: a draft only its creator sees, activated into a real project in one transaction. */
@RestController
@Tag(name = "Project drafts", description = "Multi-step Create Project: draft, steps, discard, activate")
public class ProjectDraftController {

    private static final String MEMBER = "@permissionService.tokenOrgMember(authentication)";

    private final ProjectDraftService drafts;

    public ProjectDraftController(ProjectDraftService drafts) {
        this.drafts = drafts;
    }

    @PostMapping("/v1/organizations/{orgId}/project-drafts")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'project.create')")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Step 1: save the basics as a draft (name, key, description, mode, dates)")
    public ProjectDraftService.DraftView create(@PathVariable UUID orgId, @RequestBody ProjectDraftService.BasicsRequest request,
            Authentication authentication) {
        return drafts.create(orgId, authentication, request);
    }

    @GetMapping("/v1/organizations/{orgId}/project-drafts")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'project.create')")
    @Operation(summary = "The caller's open drafts (resume or discard)")
    public List<ProjectDraftService.DraftSummary> mine(@PathVariable UUID orgId, Authentication authentication) {
        return drafts.mine(orgId, authentication);
    }

    @GetMapping("/v1/project-drafts/{draftId}")
    @PreAuthorize(MEMBER)
    @Operation(summary = "One of the caller's drafts (404 for anyone else)")
    public ProjectDraftService.DraftView get(@PathVariable UUID draftId, Authentication authentication) {
        return drafts.get(authentication, draftId);
    }

    @PutMapping("/v1/project-drafts/{draftId}/basics")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Step 1: basics (start today or later, end on or after start)")
    public ProjectDraftService.DraftView basics(@PathVariable UUID draftId, @RequestBody ProjectDraftService.BasicsRequest request,
            Authentication authentication) {
        return drafts.saveBasics(authentication, draftId, request);
    }

    @PutMapping("/v1/project-drafts/{draftId}/documents")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Step 2: staged documents attached to the draft")
    public ProjectDraftService.DraftView documents(@PathVariable UUID draftId,
            @RequestBody ProjectDraftService.DocumentsRequest request, Authentication authentication) {
        return drafts.saveDocuments(authentication, draftId, request);
    }

    @PutMapping("/v1/project-drafts/{draftId}/plan")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Step 3 (Team): phases and tasks; points total at most 100")
    public ProjectDraftService.DraftView plan(@PathVariable UUID draftId, @RequestBody ProjectDraftService.PlanRequest request,
            Authentication authentication) {
        return drafts.savePlan(authentication, draftId, request);
    }

    @PutMapping("/v1/project-drafts/{draftId}/repository")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Step 4: verify and attach a GitHub repository (repo.connect); the token is encrypted, never returned")
    public ProjectDraftService.DraftView repository(@PathVariable UUID draftId,
            @RequestBody ProjectDraftService.RepositoryRequest request, Authentication authentication) {
        return drafts.saveRepository(authentication, draftId, request);
    }

    @PutMapping("/v1/project-drafts/{draftId}/people")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Step 5: team lead, developers, QA (never Owner or Admin)")
    public ProjectDraftService.DraftView people(@PathVariable UUID draftId, @RequestBody ProjectDraftService.PeopleRequest request,
            Authentication authentication) {
        return drafts.savePeople(authentication, draftId, request);
    }

    @PutMapping("/v1/project-drafts/{draftId}/approvers")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Step 6: who approves this project's work (project-scoped task.review on activation)")
    public ProjectDraftService.DraftView approvers(@PathVariable UUID draftId,
            @RequestBody ProjectDraftService.ApproversRequest request, Authentication authentication) {
        return drafts.saveApprovers(authentication, draftId, request);
    }

    @DeleteMapping("/v1/project-drafts/{draftId}")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Discard the draft (its staged documents are removed)")
    public ResponseEntity<Void> discard(@PathVariable UUID draftId, @RequestBody ProjectDraftService.VersionRequest request,
            Authentication authentication) {
        drafts.discard(authentication, draftId, request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/v1/project-drafts/{draftId}/activate")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Step 7: create the project from the draft in one transaction (everything re-validated)")
    public ProjectSetupService.SetupResult activate(@PathVariable UUID draftId, @RequestBody ProjectDraftService.VersionRequest request,
            Authentication authentication) {
        return drafts.activate(authentication, draftId, request);
    }

    @GetMapping("/v1/project-drafts/{draftId}/github/repositories")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Step 4 (GitHub App): repositories of one of the organization's installations")
    public List<com.prowise.integration.github.GitHubAppService.RepositoryChoice> githubRepositories(@PathVariable UUID draftId,
            @org.springframework.web.bind.annotation.RequestParam("installation_id") UUID installationId,
            Authentication authentication) {
        return drafts.repositories(authentication, draftId, installationId);
    }

    @GetMapping("/v1/project-drafts/{draftId}/github/branches")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Step 4 (GitHub App): branches of the chosen repository")
    public List<String> githubBranches(@PathVariable UUID draftId,
            @org.springframework.web.bind.annotation.RequestParam("installation_id") UUID installationId,
            @org.springframework.web.bind.annotation.RequestParam String repository, Authentication authentication) {
        return drafts.branches(authentication, draftId, installationId, repository);
    }

    @PostMapping("/v1/project-drafts/{draftId}/github/validate")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Step 4 (GitHub App): the confirmation checks before the repository is attached to the draft")
    public com.prowise.integration.github.GitHubAppService.Validation githubValidate(@PathVariable UUID draftId,
            @RequestBody com.prowise.integration.github.GitHubAppService.ChoiceRequest request, Authentication authentication) {
        return drafts.validateRepository(authentication, draftId, request);
    }
}
