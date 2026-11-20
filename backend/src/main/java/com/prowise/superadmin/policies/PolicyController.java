package com.prowise.superadmin.policies;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.identity.AuthPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping({"/v1/admin", "/api/v1/admin"})
@Tag(name = "Super Admin Platform Policies & Branding", description = "Global platform governance policies, MFA enforcement, and white-label branding")
public class PolicyController {

    private final PolicyService policyService;

    public PolicyController(PolicyService policyService) {
        this.policyService = policyService;
    }

    @GetMapping("/policies")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('config.manage') or hasAuthority('security.manage')")
    @Operation(summary = "Get platform governance policies and settings")
    public ResponseEntity<PolicyDTOs.PlatformPolicyResponse> getPolicies() {
        return ResponseEntity.ok(policyService.getPolicySettings());
    }

    @PutMapping("/policies")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('config.manage')")
    @Operation(summary = "Update platform governance policies and settings")
    public ResponseEntity<PolicyDTOs.PlatformPolicyResponse> updatePolicies(
            HttpServletRequest request,
            @Valid @RequestBody PolicyDTOs.UpdatePolicySettingsRequest body
    ) {
        AuthPrincipal principal = AuthPrincipal.current(request);
        String actor = principal != null ? principal.email() : "superadmin@prowise.io";
        return ResponseEntity.ok(policyService.updatePolicySettings(body, actor));
    }

    @GetMapping("/branding")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('config.manage')")
    @Operation(summary = "Get global branding preferences")
    public ResponseEntity<PolicyDTOs.PlatformBrandingResponse> getBranding() {
        return ResponseEntity.ok(policyService.getBrandingPreferences());
    }

    @PutMapping("/branding")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('config.manage')")
    @Operation(summary = "Update global branding preferences")
    public ResponseEntity<PolicyDTOs.PlatformBrandingResponse> updateBranding(
            HttpServletRequest request,
            @Valid @RequestBody PolicyDTOs.UpdateBrandingRequest body
    ) {
        AuthPrincipal principal = AuthPrincipal.current(request);
        String actor = principal != null ? principal.email() : "superadmin@prowise.io";
        return ResponseEntity.ok(policyService.updateBrandingPreferences(body, actor));
    }
}
