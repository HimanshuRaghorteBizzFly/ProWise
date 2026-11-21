package com.prowise.project;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.authz.PermissionService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping
@Tag(name = "Project Management", description = "Endpoints for project lifecycle, settings, members, and tracking")
public class ProjectController {

    private final ProjectService projectService;
    private final PermissionService permissionService;

    public ProjectController(ProjectService projectService, PermissionService permissionService) {
        this.projectService = projectService;
        this.permissionService = permissionService;
    }

    // 1. Create Project
    @PostMapping({"/v1/organizations/{orgId}/projects", "/api/v1/organizations/{orgId}/projects"})
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'project.create')")
    @Operation(summary = "Create a project in the organization")
    public ResponseEntity<ProjectDTOs.ProjectResponse> createProject(
            @PathVariable UUID orgId,
            @Valid @RequestBody ProjectDTOs.CreateProjectRequest request,
            Authentication auth) {
        ProjectDTOs.ProjectResponse response = projectService.createProject(orgId, auth, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .location(URI.create("/v1/projects/" + response.id()))
                .body(response);
    }

    // 2. List Projects
    @GetMapping({"/v1/organizations/{orgId}/projects", "/api/v1/organizations/{orgId}/projects"})
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'project.read')")
    @Operation(summary = "List readable projects in the organization with filtering and cursor pagination")
    public ResponseEntity<ProjectDTOs.ProjectListResponse> listProjects(
            @PathVariable UUID orgId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String owner,
            @RequestParam(required = false) String team,
            @RequestParam(required = false) String health,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String mode,
            @RequestParam(required = false) Boolean archived,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "50") int limit,
            Authentication auth) {
        ProjectDTOs.ProjectListResponse response = projectService.listProjects(
                orgId, auth, search, owner, team, health, status, mode, archived, cursor, limit);
        return ResponseEntity.ok(response);
    }

    // 3. Get Single Project
    @GetMapping({"/v1/projects/{projectId}", "/api/v1/projects/{projectId}",
                  "/v1/organizations/{orgId}/projects/{projectId}", "/api/v1/organizations/{orgId}/projects/{projectId}"})
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "Get project details by ID")
    public ResponseEntity<ProjectDTOs.ProjectResponse> getProject(
            @PathVariable(required = false) UUID orgId,
            @PathVariable String projectId,
            Authentication auth) {
        UUID effectiveOrgId = orgId != null ? orgId : permissionService.principal(auth).organizationId();
        ProjectDTOs.ProjectResponse response = projectService.getProject(effectiveOrgId, projectId, auth);
        return ResponseEntity.ok(response);
    }

    // 4. Update Project (PATCH)
    @PatchMapping({"/v1/projects/{projectId}", "/api/v1/projects/{projectId}",
                   "/v1/organizations/{orgId}/projects/{projectId}", "/api/v1/organizations/{orgId}/projects/{projectId}"})
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "Update project details, deadlines, owners, or settings")
    public ResponseEntity<ProjectDTOs.ProjectResponse> updateProject(
            @PathVariable(required = false) UUID orgId,
            @PathVariable String projectId,
            @Valid @RequestBody ProjectDTOs.UpdateProjectRequest request,
            Authentication auth) {
        UUID effectiveOrgId = orgId != null ? orgId : permissionService.principal(auth).organizationId();
        ProjectDTOs.ProjectResponse response = projectService.updateProject(effectiveOrgId, projectId, auth, request);
        return ResponseEntity.ok(response);
    }

    // 5. Archive Project
    @PostMapping({"/v1/projects/{projectId}/archive", "/api/v1/projects/{projectId}/archive",
                  "/v1/organizations/{orgId}/projects/{projectId}/archive", "/api/v1/organizations/{orgId}/projects/{projectId}/archive"})
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "Archive project")
    public ResponseEntity<ProjectDTOs.ProjectResponse> archiveProject(
            @PathVariable(required = false) UUID orgId,
            @PathVariable String projectId,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication auth) {
        UUID effectiveOrgId = orgId != null ? orgId : permissionService.principal(auth).organizationId();
        long version = body != null && body.get("expectedVersion") != null
                ? ((Number) body.get("expectedVersion")).longValue()
                : 0L;
        ProjectDTOs.ProjectResponse response = projectService.archiveProject(effectiveOrgId, projectId, version, auth);
        return ResponseEntity.ok(response);
    }

    // 6. Restore Project
    @PostMapping({"/v1/projects/{projectId}/restore", "/api/v1/projects/{projectId}/restore",
                  "/v1/organizations/{orgId}/projects/{projectId}/restore", "/api/v1/organizations/{orgId}/projects/{projectId}/restore"})
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "Restore archived project")
    public ResponseEntity<ProjectDTOs.ProjectResponse> restoreProject(
            @PathVariable(required = false) UUID orgId,
            @PathVariable String projectId,
            @RequestBody(required = false) Map<String, Object> body,
            Authentication auth) {
        UUID effectiveOrgId = orgId != null ? orgId : permissionService.principal(auth).organizationId();
        long version = body != null && body.get("expectedVersion") != null
                ? ((Number) body.get("expectedVersion")).longValue()
                : 0L;
        ProjectDTOs.ProjectResponse response = projectService.restoreProject(effectiveOrgId, projectId, version, auth);
        return ResponseEntity.ok(response);
    }

    // 7. Add Project Member
    @PostMapping({"/v1/projects/{projectId}/members", "/api/v1/projects/{projectId}/members",
                  "/v1/organizations/{orgId}/projects/{projectId}/members", "/api/v1/organizations/{orgId}/projects/{projectId}/members"})
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "Add member to project")
    public ResponseEntity<ProjectDTOs.ProjectMemberResponse> addMember(
            @PathVariable(required = false) UUID orgId,
            @PathVariable String projectId,
            @Valid @RequestBody ProjectDTOs.ProjectMemberRequest request,
            Authentication auth) {
        UUID effectiveOrgId = orgId != null ? orgId : permissionService.principal(auth).organizationId();
        ProjectDTOs.ProjectMemberResponse response = projectService.addMember(effectiveOrgId, projectId, request, auth);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    // 8. Remove Project Member
    @DeleteMapping({"/v1/projects/{projectId}/members/{membershipId}", "/api/v1/projects/{projectId}/members/{membershipId}",
                    "/v1/organizations/{orgId}/projects/{projectId}/members/{membershipId}", "/api/v1/organizations/{orgId}/projects/{projectId}/members/{membershipId}"})
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "Remove member from project")
    public ResponseEntity<Void> removeMember(
            @PathVariable(required = false) UUID orgId,
            @PathVariable String projectId,
            @PathVariable UUID membershipId,
            Authentication auth) {
        UUID effectiveOrgId = orgId != null ? orgId : permissionService.principal(auth).organizationId();
        projectService.removeMember(effectiveOrgId, projectId, membershipId, auth);
        return ResponseEntity.noContent().build();
    }

    // 9. List Project Members
    @GetMapping({"/v1/projects/{projectId}/members", "/api/v1/projects/{projectId}/members",
                 "/v1/organizations/{orgId}/projects/{projectId}/members", "/api/v1/organizations/{orgId}/projects/{projectId}/members"})
    @PreAuthorize("@permissionService.tokenOrgMember(authentication)")
    @Operation(summary = "List project members")
    public ResponseEntity<List<ProjectDTOs.ProjectMemberResponse>> listMembers(
            @PathVariable(required = false) UUID orgId,
            @PathVariable String projectId,
            Authentication auth) {
        UUID effectiveOrgId = orgId != null ? orgId : permissionService.principal(auth).organizationId();
        List<ProjectDTOs.ProjectMemberResponse> response = projectService.listMembers(effectiveOrgId, projectId, auth);
        return ResponseEntity.ok(response);
    }
}
