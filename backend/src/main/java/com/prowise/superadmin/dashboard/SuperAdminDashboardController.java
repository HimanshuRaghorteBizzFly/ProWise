package com.prowise.superadmin.dashboard;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping({"/v1/admin/dashboard", "/api/v1/admin/dashboard"})
@Tag(name = "Super Admin Executive Dashboard", description = "Cross-tenant KPIs, MRR trajectory, subscription metrics, and operational health")
public class SuperAdminDashboardController {

    private final SuperAdminDashboardService dashboardService;

    public SuperAdminDashboardController(SuperAdminDashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('ROLE_PLATFORM_SUPER_ADMIN') or hasAuthority('ROLE_SUPER_ADMIN') or hasAuthority('SUPER_ADMIN') or hasAuthority('audit.view') or hasAuthority('orgs.view')")
    @Operation(summary = "Get aggregated executive dashboard telemetry, revenue overview, and recent activity")
    public ResponseEntity<SuperAdminDashboardDTOs.SuperAdminDashboardResponse> getDashboard() {
        return ResponseEntity.ok(dashboardService.getDashboardData());
    }
}
