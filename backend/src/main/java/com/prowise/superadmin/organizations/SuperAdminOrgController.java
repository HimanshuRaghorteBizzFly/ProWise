package com.prowise.superadmin.organizations;

import java.util.List;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.superadmin.common.AdminRequests;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping({"/v1/admin/organizations", "/api/v1/admin/organizations"})
@Tag(name = "Super Admin Organizations", description = "Multi-tenant organization lifecycle. Mutations need expected_version (409 STALE_VERSION when stale) and accept Idempotency-Key.")
public class SuperAdminOrgController {

    private final SuperAdminOrgService orgService;

    public SuperAdminOrgController(SuperAdminOrgService orgService) {
        this.orgService = orgService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('orgs.view')")
    @Operation(summary = "List tenant organizations with optional filters")
    public ResponseEntity<List<SuperAdminOrgDTOs.OrgDetailResponse>> listOrganizations(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String planId,
            @RequestParam(required = false) String search
    ) {
        return ResponseEntity.ok(orgService.listOrganizations(status, planId, search));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('orgs.view')")
    @Operation(summary = "Get detailed tenant organization profile")
    public ResponseEntity<SuperAdminOrgDTOs.OrgDetailResponse> getOrganization(@PathVariable UUID id) {
        return ResponseEntity.ok(orgService.getOrganization(id));
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('orgs.view')")
    @Operation(summary = "Get platform-wide organization statistics")
    public ResponseEntity<SuperAdminOrgDTOs.OrgSummaryResponse> getSummary() {
        return ResponseEntity.ok(orgService.getSummary());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('orgs.create')")
    @Operation(summary = "Provision a new tenant organization")
    public ResponseEntity<SuperAdminOrgDTOs.OrgDetailResponse> createOrganization(
            HttpServletRequest request,
            @Valid @RequestBody SuperAdminOrgDTOs.CreateOrgRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(orgService.createOrganization(body, actor));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('orgs.edit')")
    @Operation(summary = "Update an existing tenant organization (expected_version required)")
    public ResponseEntity<SuperAdminOrgDTOs.OrgDetailResponse> updateOrganization(
            HttpServletRequest request,
            @PathVariable UUID id,
            @Valid @RequestBody SuperAdminOrgDTOs.UpdateOrgRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.ok(orgService.updateOrganization(id, body, actor));
    }

    @PostMapping("/{id}/suspend")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('orgs.suspend')")
    @Operation(summary = "Suspend a tenant organization (body: reason, expected_version)")
    public ResponseEntity<SuperAdminOrgDTOs.OrgDetailResponse> suspendOrganization(
            HttpServletRequest request,
            @PathVariable UUID id,
            @Valid @RequestBody SuperAdminOrgDTOs.SuspendOrgRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.ok(orgService.suspendOrganization(id, body, actor));
    }

    @PostMapping("/{id}/reactivate")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('orgs.suspend')")
    @Operation(summary = "Reactivate a suspended organization (body: expected_version)")
    public ResponseEntity<SuperAdminOrgDTOs.OrgDetailResponse> reactivateOrganization(
            HttpServletRequest request,
            @PathVariable UUID id,
            @RequestBody(required = false) AdminRequests.VersionRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.ok(orgService.reactivateOrganization(id, com.prowise.superadmin.common.AdminRequests.expected(body), actor));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('orgs.delete')")
    @Operation(summary = "Delete an organization (?expectedVersion= required)")
    public ResponseEntity<Void> deleteOrganization(
            HttpServletRequest request,
            @PathVariable UUID id,
            @RequestParam(required = false) Long expectedVersion
    ) {
        String actor = AdminRequests.actor(request);
        orgService.deleteOrganization(id, expectedVersion, actor);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/bulk-suspend")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('orgs.suspend')")
    @Operation(summary = "Bulk suspend multiple organizations (items: [{id, expected_version}]; all-or-nothing)")
    public ResponseEntity<Void> bulkSuspend(
            HttpServletRequest request,
            @Valid @RequestBody SuperAdminOrgDTOs.BulkSuspendRequest body
    ) {
        String actor = AdminRequests.actor(request);
        orgService.bulkSuspend(body, actor);
        return ResponseEntity.noContent().build();
    }
}
