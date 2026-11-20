package com.prowise.superadmin.plans;

import java.util.List;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping
public class PlanController {

    private final PlanService planService;

    public PlanController(PlanService planService) {
        this.planService = planService;
    }

    @GetMapping({"/v1/admin/plans", "/api/v1/admin/plans"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('plans.manage')")
    public List<PlanDTOs.PlanResponse> listPlans() {
        return planService.listPlans();
    }

    @GetMapping({"/v1/admin/plans/{id}", "/api/v1/admin/plans/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('plans.manage')")
    public PlanDTOs.PlanResponse getPlan(@PathVariable String id) {
        return planService.getPlan(id);
    }

    @PostMapping({"/v1/admin/plans", "/api/v1/admin/plans"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('plans.manage')")
    public ResponseEntity<PlanDTOs.PlanResponse> createPlan(@RequestBody PlanDTOs.CreatePlanRequest request) {
        PlanDTOs.PlanResponse created = planService.createPlan(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping({"/v1/admin/plans/{id}", "/api/v1/admin/plans/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('plans.manage')")
    public PlanDTOs.PlanResponse updatePlan(
            @PathVariable String id,
            @RequestBody PlanDTOs.UpdatePlanRequest request
    ) {
        return planService.updatePlan(id, request);
    }

    @PostMapping({"/v1/admin/plans/{id}/archive", "/api/v1/admin/plans/{id}/archive"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('plans.manage')")
    public PlanDTOs.PlanResponse toggleArchive(@PathVariable String id) {
        return planService.togglePlanArchive(id);
    }

    @DeleteMapping({"/v1/admin/plans/{id}", "/api/v1/admin/plans/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('plans.manage')")
    public ResponseEntity<Void> deletePlan(@PathVariable String id) {
        planService.deletePlan(id);
        return ResponseEntity.noContent().build();
    }
}
