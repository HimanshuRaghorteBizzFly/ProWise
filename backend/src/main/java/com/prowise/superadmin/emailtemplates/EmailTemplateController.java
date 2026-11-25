package com.prowise.superadmin.emailtemplates;

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
@RequestMapping({"/v1/admin/email-templates", "/api/v1/admin/email-templates"})
@Tag(name = "Super Admin Email Templates", description = "Transactional email templates. Mutations need expected_version (409 STALE_VERSION when stale) and accept Idempotency-Key.")
public class EmailTemplateController {

    private final EmailTemplateService templateService;

    public EmailTemplateController(EmailTemplateService templateService) {
        this.templateService = templateService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('templates.manage')")
    @Operation(summary = "List email templates with optional filters")
    public ResponseEntity<List<EmailTemplateDTOs.EmailTemplateResponse>> listTemplates(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String search
    ) {
        return ResponseEntity.ok(templateService.listTemplates(category, status, search));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('templates.manage')")
    @Operation(summary = "Get single email template by ID")
    public ResponseEntity<EmailTemplateDTOs.EmailTemplateResponse> getTemplate(@PathVariable String id) {
        return ResponseEntity.ok(templateService.getTemplate(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('templates.manage')")
    @Operation(summary = "Create a new transactional email template")
    public ResponseEntity<EmailTemplateDTOs.EmailTemplateResponse> createTemplate(
            HttpServletRequest request,
            @Valid @RequestBody EmailTemplateDTOs.CreateEmailTemplateRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(templateService.createTemplate(body, actor));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('templates.manage')")
    @Operation(summary = "Update an existing email template (expected_version required)")
    public ResponseEntity<EmailTemplateDTOs.EmailTemplateResponse> updateTemplate(
            HttpServletRequest request,
            @PathVariable String id,
            @Valid @RequestBody EmailTemplateDTOs.UpdateEmailTemplateRequest body
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.ok(templateService.updateTemplate(id, body, actor));
    }

    @PostMapping("/{id}/clone")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('templates.manage')")
    @Operation(summary = "Clone an existing email template")
    public ResponseEntity<EmailTemplateDTOs.EmailTemplateResponse> cloneTemplate(
            HttpServletRequest request,
            @PathVariable String id
    ) {
        String actor = AdminRequests.actor(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(templateService.cloneTemplate(id, actor));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('templates.manage')")
    @Operation(summary = "Delete an email template (?expectedVersion= required)")
    public ResponseEntity<Void> deleteTemplate(
            HttpServletRequest request,
            @PathVariable String id,
            @RequestParam(required = false) Long expectedVersion
    ) {
        String actor = AdminRequests.actor(request);
        templateService.deleteTemplate(id, expectedVersion, actor);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/test-send")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('templates.manage')")
    @Operation(summary = "Send a test preview of the email template")
    public ResponseEntity<Void> sendTestEmail(
            HttpServletRequest request,
            @PathVariable String id,
            @Valid @RequestBody EmailTemplateDTOs.SendTestEmailRequest body
    ) {
        String actor = AdminRequests.actor(request);
        templateService.sendTestEmail(id, body.recipientEmail(), actor);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/bulk-delete")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('templates.manage')")
    @Operation(summary = "Bulk delete email templates (items: [{id, expected_version}]; all-or-nothing)")
    public ResponseEntity<Void> bulkDelete(
            HttpServletRequest request,
            @Valid @RequestBody AdminRequests.BulkVersionedRequest body
    ) {
        String actor = AdminRequests.actor(request);
        templateService.bulkDelete(body.items(), actor);
        return ResponseEntity.noContent().build();
    }
}
