package com.prowise.superadmin.licenses;

import java.util.List;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.identity.AuthPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping({"/v1/admin/licenses", "/api/v1/admin/licenses"})
@Tag(name = "Super Admin Licenses", description = "Enterprise license key generation, validation, and revocation")
public class LicenseController {

    private final LicenseService licenseService;

    public LicenseController(LicenseService licenseService) {
        this.licenseService = licenseService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('security.manage')")
    @Operation(summary = "List license keys with optional org/status filters")
    public ResponseEntity<List<LicenseDTOs.LicenseResponse>> listLicenses(
            @RequestParam(required = false) UUID orgId,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(licenseService.listLicenses(orgId, status));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('security.manage')")
    @Operation(summary = "Get single license details by ID")
    public ResponseEntity<LicenseDTOs.LicenseResponse> getLicense(@PathVariable String id) {
        return ResponseEntity.ok(licenseService.getLicense(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('security.manage')")
    @Operation(summary = "Generate a new cryptographic enterprise license key")
    public ResponseEntity<LicenseDTOs.LicenseResponse> generateLicense(
            HttpServletRequest request,
            @Valid @RequestBody LicenseDTOs.GenerateLicenseRequest body
    ) {
        AuthPrincipal principal = AuthPrincipal.current(request);
        String actor = principal != null ? principal.email() : "superadmin@prowise.io";
        return ResponseEntity.status(HttpStatus.CREATED).body(licenseService.generateLicense(body, actor));
    }

    @PostMapping("/validate")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('security.manage')")
    @Operation(summary = "Validate an existing license key")
    public ResponseEntity<LicenseDTOs.ValidateLicenseResponse> validateLicense(
            @Valid @RequestBody LicenseDTOs.ValidateLicenseRequest body
    ) {
        return ResponseEntity.ok(licenseService.validateLicense(body.licenseKey()));
    }

    @PostMapping("/{id}/revoke")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('security.manage')")
    @Operation(summary = "Revoke an enterprise license key")
    public ResponseEntity<LicenseDTOs.LicenseResponse> revokeLicense(
            HttpServletRequest request,
            @PathVariable String id,
            @Valid @RequestBody LicenseDTOs.RevokeLicenseRequest body
    ) {
        AuthPrincipal principal = AuthPrincipal.current(request);
        String actor = principal != null ? principal.email() : "superadmin@prowise.io";
        return ResponseEntity.ok(licenseService.revokeLicense(id, body, actor));
    }
}
