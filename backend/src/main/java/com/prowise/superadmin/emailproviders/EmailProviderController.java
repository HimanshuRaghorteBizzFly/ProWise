package com.prowise.superadmin.emailproviders;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.identity.AuthPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * SMTP administration: Super Admin only. Platform Operators have no access (they see delivery logs read-only
 * through the operator console). Mutations honour Idempotency-Key (IdempotencyFilter) and expected_version.
 */
@RestController
@RequestMapping({"/v1/admin/smtp", "/api/v1/admin/smtp", "/api/admin/smtp"})
@Tag(name = "Super Admin SMTP", description = "Live SMTP settings, connection tests, test emails and delivery logs")
public class EmailProviderController {

    private static final String SUPER_ADMIN = "hasAuthority('PLATFORM_SUPER_ADMIN')";

    private final EmailProviderService service;

    public EmailProviderController(EmailProviderService service) {
        this.service = service;
    }

    @GetMapping({"", "/settings"})
    @PreAuthorize(SUPER_ADMIN)
    @Operation(summary = "Get SMTP settings (the password is never returned)")
    public EmailProviderDTOs.SmtpSettingsResponse getSettings() {
        return service.getSettings();
    }

    @PutMapping({"", "/settings"})
    @PreAuthorize(SUPER_ADMIN)
    @Operation(summary = "Save SMTP settings; the password is stored encrypted and saving does not mark SMTP as connected")
    public EmailProviderDTOs.SmtpSettingsResponse updateSettings(HttpServletRequest request,
            @RequestBody EmailProviderDTOs.UpdateSmtpSettingsRequest body) {
        return service.updateSettings(body, AuthPrincipal.require(request).email());
    }

    @PostMapping("/test-connection")
    @PreAuthorize(SUPER_ADMIN)
    @Operation(summary = "Connect, negotiate TLS and authenticate against the configured SMTP server; records the result")
    public EmailProviderDTOs.ConnectionTestResponse testConnection(HttpServletRequest request) {
        return service.testConnection(AuthPrincipal.require(request).email());
    }

    @PostMapping("/test-email")
    @PreAuthorize(SUPER_ADMIN)
    @Operation(summary = "Send the real SMTP verification email and report the server's reply")
    public EmailProviderDTOs.TestEmailResponse testEmail(HttpServletRequest request,
            @RequestBody(required = false) EmailProviderDTOs.TestEmailRequest body) {
        return service.sendTestEmail(body, AuthPrincipal.require(request).email());
    }

    @PostMapping("/verify-sender")
    @PreAuthorize(SUPER_ADMIN)
    @Operation(summary = "Ask the SMTP server whether it accepts the sender address (MAIL FROM, then RSET; nothing is sent)")
    public EmailProviderDTOs.VerifySenderResponse verifySender(HttpServletRequest request,
            @RequestBody(required = false) EmailProviderDTOs.VerifySenderRequest body) {
        return service.verifySender(body, AuthPrincipal.require(request).email());
    }

    @GetMapping("/logs")
    @PreAuthorize(SUPER_ADMIN)
    @Operation(summary = "Email delivery logs: paged, newest first, with search, status, type and date filters")
    public EmailProviderDTOs.EmailDeliveryLogPage logs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        return service.logs(page, size, q, status, type, from, to);
    }
}
