package com.prowise.superadmin.featureflags;

import java.util.List;
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
@RequestMapping({"/v1/admin/feature-flags", "/api/v1/admin/feature-flags"})
@Tag(name = "Super Admin Feature Flags", description = "Platform feature flags. Mutations need expected_version (409 STALE_VERSION when stale) and accept Idempotency-Key.")
public class FeatureFlagController {

    private final FeatureFlagService flagService;

    public FeatureFlagController(FeatureFlagService flagService) {
        this.flagService = flagService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('config.manage')")
    @Operation(summary = "List all platform feature flags")
    public ResponseEntity<List<FeatureFlagDTOs.FeatureFlagResponse>> listFeatureFlags() {
        return ResponseEntity.ok(flagService.listFeatureFlags());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('config.manage')")
    @Operation(summary = "Get single feature flag by ID")
    public ResponseEntity<FeatureFlagDTOs.FeatureFlagResponse> getFeatureFlag(@PathVariable String id) {
        return ResponseEntity.ok(flagService.getFeatureFlag(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('config.manage')")
    @Operation(summary = "Create a new platform feature flag")
    public ResponseEntity<FeatureFlagDTOs.FeatureFlagResponse> createFeatureFlag(
            HttpServletRequest request,
            @Valid @RequestBody FeatureFlagDTOs.CreateFeatureFlagRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(flagService.createFeatureFlag(body, actor));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('config.manage')")
    @Operation(summary = "Update an existing feature flag (expected_version required)")
    public ResponseEntity<FeatureFlagDTOs.FeatureFlagResponse> updateFeatureFlag(
            HttpServletRequest request,
            @PathVariable String id,
            @Valid @RequestBody FeatureFlagDTOs.UpdateFeatureFlagRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.ok(flagService.updateFeatureFlag(id, body, actor));
    }

    @PostMapping("/{id}/toggle")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('config.manage')")
    @Operation(summary = "Toggle active status of a feature flag (body: enabled, expected_version)")
    public ResponseEntity<FeatureFlagDTOs.FeatureFlagResponse> toggleFeatureFlag(
            HttpServletRequest request,
            @PathVariable String id,
            @Valid @RequestBody FeatureFlagDTOs.ToggleFlagRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.ok(flagService.toggleFeatureFlag(id, body.enabled(), body.expectedVersion(), actor));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('config.manage')")
    @Operation(summary = "Delete a feature flag (?expectedVersion= required)")
    public ResponseEntity<Void> deleteFeatureFlag(
            HttpServletRequest request,
            @PathVariable String id,
            @RequestParam(required = false) Long expectedVersion
    ) {
        String actor = AdminRequests.actor(request);
        flagService.deleteFeatureFlag(id, expectedVersion, actor);
        return ResponseEntity.noContent().build();
    }
}
