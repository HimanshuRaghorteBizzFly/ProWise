package com.prowise.project;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.common.api.CursorPage;

/**
 * Task 2.1: project records. Create needs organization-scope project.create. Read and edit routes only check the
 * membership here; ProjectService decides per project (portfolio, project-scoped grant or assignment), so a
 * project-scoped grant works and an unreadable project is a 404.
 */
@RestController
@RequestMapping("/v1/organizations/{orgId}/projects")
public class ProjectController {

    private final ProjectService projects;

    public ProjectController(ProjectService projects) {
        this.projects = projects;
    }

    @GetMapping
    @PreAuthorize("@permissionService.member(authentication, #orgId)")
    CursorPage<ProjectService.ProjectResponse> list(
            @PathVariable UUID orgId,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) UUID owner,
            @RequestParam(required = false) UUID team,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(name = "include_archived", required = false) Boolean includeArchived,
            Authentication authentication) {
        return projects.list(orgId, authentication,
                new ProjectService.ListQuery(cursor, limit, q, owner, team, status, mode, from, to, includeArchived));
    }

    @PostMapping
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'project.create')")
    ResponseEntity<ProjectService.ProjectResponse> create(@PathVariable UUID orgId, Authentication authentication,
            @RequestBody ProjectService.CreateProjectRequest request) {
        return ResponseEntity.status(201).body(projects.create(orgId, authentication, request));
    }

    /** Active members and teams for the project setup and edit forms (project.create or project.edit). */
    @GetMapping("/options")
    @PreAuthorize("@permissionService.member(authentication, #orgId)")
    ProjectService.ProjectOptions options(@PathVariable UUID orgId, Authentication authentication) {
        return projects.options(orgId, authentication);
    }

    @GetMapping("/{projectId}")
    @PreAuthorize("@permissionService.member(authentication, #orgId)")
    ProjectService.ProjectResponse get(@PathVariable UUID orgId, @PathVariable String projectId,
            Authentication authentication) {
        return projects.get(orgId, projectId, authentication);
    }

    @GetMapping("/{projectId}/date-history")
    @PreAuthorize("@permissionService.member(authentication, #orgId)")
    List<ProjectService.DateChange> dateHistory(@PathVariable UUID orgId, @PathVariable String projectId,
            Authentication authentication) {
        return projects.dateHistory(orgId, projectId, authentication);
    }

    @PatchMapping("/{projectId}")
    @PreAuthorize("@permissionService.member(authentication, #orgId)")
    ProjectService.ProjectResponse update(@PathVariable UUID orgId, @PathVariable String projectId,
            Authentication authentication, @RequestBody ProjectService.UpdateProjectRequest request) {
        return projects.update(orgId, projectId, authentication, request);
    }

}
