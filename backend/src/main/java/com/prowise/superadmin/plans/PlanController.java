package com.prowise.superadmin.plans;

import java.util.List;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.superadmin.common.AdminRequests;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping
@Tag(name = "Super Admin Plans", description = "Plan catalogue. Mutations need expected_version (409 STALE_VERSION when stale) and accept Idempotency-Key.")
public class PlanController {

    private final PlanService planService;

    public PlanController(PlanService planService) {
        this.planService = planService;
    }

    @GetMapping({"/v1/admin/plans", "/api/v1/admin/plans"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('plans.manage')")
    @Operation(summary = "List plans")
    public List<PlanDTOs.PlanResponse> listPlans() {
        return planService.listPlans();
    }

    @GetMapping({"/v1/admin/plans/{id}", "/api/v1/admin/plans/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('plans.manage')")
    @Operation(summary = "Get one plan")
    public PlanDTOs.PlanResponse getPlan(@PathVariable String id) {
        return planService.getPlan(id);
    }

    @PostMapping({"/v1/admin/plans", "/api/v1/admin/plans"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('plans.manage')")
    @Operation(summary = "Create a plan")
    public ResponseEntity<PlanDTOs.PlanResponse> createPlan(HttpServletRequest http, @RequestBody PlanDTOs.CreatePlanRequest request) {
        PlanDTOs.PlanResponse created = planService.createPlan(request, AdminRequests.actor(http));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping({"/v1/admin/plans/{id}", "/api/v1/admin/plans/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('plans.manage')")
    @Operation(summary = "Update a plan (expected_version required)")
    public PlanDTOs.PlanResponse updatePlan(
            HttpServletRequest http,
            @PathVariable String id,
            @RequestBody PlanDTOs.UpdatePlanRequest request
    ) {
        return planService.updatePlan(id, request, AdminRequests.actor(http));
    }

    @PostMapping({"/v1/admin/plans/{id}/archive", "/api/v1/admin/plans/{id}/archive"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('plans.manage')")
    @Operation(summary = "Archive an active plan, or restore an archived one (body: expected_version)")
    public PlanDTOs.PlanResponse toggleArchive(
            HttpServletRequest http,
            @PathVariable String id,
            @RequestBody(required = false) AdminRequests.VersionRequest body
    ) {
        return planService.togglePlanArchive(id, com.prowise.superadmin.common.AdminRequests.expected(body), AdminRequests.actor(http));
    }

    @DeleteMapping({"/v1/admin/plans/{id}", "/api/v1/admin/plans/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('plans.manage')")
    @Operation(summary = "Delete a plan (?expectedVersion= required)")
    public ResponseEntity<Void> deletePlan(
            HttpServletRequest http,
            @PathVariable String id,
            @RequestParam(required = false) Long expectedVersion
    ) {
        planService.deletePlan(id, expectedVersion, AdminRequests.actor(http));
        return ResponseEntity.noContent().build();
    }
}
