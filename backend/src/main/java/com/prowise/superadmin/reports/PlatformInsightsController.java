package com.prowise.superadmin.reports;

import java.time.LocalDate;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.superadmin.common.AdminRequests;
import com.prowise.superadmin.integrations.IntegrationSettingsService;
import com.prowise.superadmin.security.SecurityOverviewService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Super Admin read models over real data, plus the non-secret integration settings. Super Admin only. */
@RestController
@Tag(name = "Super Admin Insights", description = "Reports, security posture and integration settings computed from stored rows (no estimates)")
public class PlatformInsightsController {

    private static final String SUPER_ADMIN = "hasAuthority('PLATFORM_SUPER_ADMIN')";

    private final ReportsService reportsService;
    private final SecurityOverviewService securityOverviewService;
    private final IntegrationSettingsService integrationSettingsService;

    public PlatformInsightsController(
            ReportsService reportsService,
            SecurityOverviewService securityOverviewService,
            IntegrationSettingsService integrationSettingsService) {
        this.reportsService = reportsService;
        this.securityOverviewService = securityOverviewService;
        this.integrationSettingsService = integrationSettingsService;
    }

    @GetMapping({"/v1/admin/reports/overview", "/api/v1/admin/reports/overview"})
    @PreAuthorize(SUPER_ADMIN)
    @Operation(summary = "Platform report over real rows",
            description = "Organizations, users, subscriptions, invoices, payments, audit and sign-ins. Totals are the current "
                    + "state; monthly/daily series, invoices, payments, audit and logins are limited to [from, to] (UTC dates, "
                    + "inclusive). Buckets without rows are omitted. Default range: the last 12 months ending today.")
    public ReportsDTOs.ReportsOverview reportsOverview(
            @Parameter(description = "YYYY-MM-DD, inclusive (UTC)") @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @Parameter(description = "YYYY-MM-DD, inclusive (UTC)") @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return reportsService.overview(from, to);
    }

    @GetMapping({"/v1/admin/security/overview", "/api/v1/admin/security/overview"})
    @PreAuthorize(SUPER_ADMIN)
    @Operation(summary = "Security posture",
            description = "Failed sign-ins (users + operators), locked accounts, forced password changes, open sessions, Super Admin "
                    + "count, the last 20 failed sign-ins with masked emails, and accounts still using a published seed password.")
    public SecurityOverviewService.SecurityOverview securityOverview() {
        return securityOverviewService.overview();
    }

    @GetMapping({"/v1/admin/integration-settings", "/api/v1/admin/integration-settings"})
    @PreAuthorize(SUPER_ADMIN)
    @Operation(summary = "Non-secret integration settings (creates the default row when missing)")
    public IntegrationSettingsService.IntegrationSettingsResponse integrationSettings() {
        return integrationSettingsService.get();
    }

    @PutMapping({"/v1/admin/integration-settings", "/api/v1/admin/integration-settings"})
    @PreAuthorize(SUPER_ADMIN)
    @Operation(summary = "Replace the integration settings (expected_version required; 409 STALE_VERSION when stale)",
            description = "Validated: webhook_max_retries 0-20, webhook_timeout_seconds 1-120, github_app_slug lowercase "
                    + "letters/digits/hyphens, github_client_id letters/digits/._-, allowed_event_types GitHub event names. "
                    + "Secrets are not accepted here; they stay in environment variables. Accepts Idempotency-Key.")
    public IntegrationSettingsService.IntegrationSettingsResponse updateIntegrationSettings(
            HttpServletRequest http,
            @RequestBody(required = false) IntegrationSettingsService.UpdateIntegrationSettingsRequest body) {
        IntegrationSettingsService.UpdateIntegrationSettingsRequest request = body != null ? body
                : new IntegrationSettingsService.UpdateIntegrationSettingsRequest(null, null, null, null, null, null, null);
        return integrationSettingsService.update(request, AdminRequests.actor(http));
    }
}
