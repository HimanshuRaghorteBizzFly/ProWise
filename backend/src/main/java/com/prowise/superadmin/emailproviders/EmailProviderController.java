package com.prowise.superadmin.emailproviders;

import java.util.List;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.identity.AuthPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping({"/v1/admin/smtp", "/api/v1/admin/smtp", "/v1/admin/email-providers", "/api/v1/admin/email-providers"})
@Tag(name = "Super Admin SMTP & Email Providers", description = "Transactional email relay credentials and diagnostics")
public class EmailProviderController {

    private final EmailProviderService emailProviderService;

    public EmailProviderController(EmailProviderService emailProviderService) {
        this.emailProviderService = emailProviderService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('smtp.configure')")
    @Operation(summary = "Get current SMTP outbound relay configuration")
    public ResponseEntity<EmailProviderDTOs.SmtpConfigResponse> getSmtpConfig() {
        return ResponseEntity.ok(emailProviderService.getSmtpConfig());
    }

    @PutMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('smtp.configure')")
    @Operation(summary = "Update outbound SMTP settings and credentials")
    public ResponseEntity<EmailProviderDTOs.SmtpConfigResponse> updateSmtpConfig(
            HttpServletRequest request,
            @Valid @RequestBody EmailProviderDTOs.UpdateSmtpConfigRequest body
    ) {
        AuthPrincipal principal = AuthPrincipal.current(request);
        String actor = principal != null ? principal.email() : "superadmin@prowise.io";
        return ResponseEntity.ok(emailProviderService.updateSmtpConfig(body, actor));
    }

    @PostMapping("/test")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('smtp.configure')")
    @Operation(summary = "Execute live SMTP test handshake")
    public ResponseEntity<EmailProviderDTOs.TestSmtpResponse> testSmtp(
            HttpServletRequest request,
            @Valid @RequestBody EmailProviderDTOs.TestSmtpRequest body
    ) {
        AuthPrincipal principal = AuthPrincipal.current(request);
        String actor = principal != null ? principal.email() : "superadmin@prowise.io";
        return ResponseEntity.ok(emailProviderService.testConnection(body, actor));
    }

    @GetMapping("/logs")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('smtp.configure')")
    @Operation(summary = "Get recent email dispatch delivery logs")
    public ResponseEntity<List<EmailProviderDTOs.EmailDeliveryLogDTO>> getDeliveryLogs() {
        return ResponseEntity.ok(emailProviderService.getDeliveryLogs());
    }
}
