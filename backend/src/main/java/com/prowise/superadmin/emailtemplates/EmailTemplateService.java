package com.prowise.superadmin.emailtemplates;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.superadmin.common.AdminRequests;
import com.prowise.superadmin.audit.AuditService;

@Service
@Transactional
public class EmailTemplateService {

    private final EmailTemplateRepository repository;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    public EmailTemplateService(EmailTemplateRepository repository, AuditService auditService, ObjectMapper objectMapper) {
        this.repository = repository;
        this.auditService = auditService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<EmailTemplateDTOs.EmailTemplateResponse> listTemplates(String category, String status, String search) {
        List<EmailTemplateEntity> all = repository.findAll();
        if (category != null && !category.equalsIgnoreCase("ALL")) {
            all = all.stream().filter(t -> category.equalsIgnoreCase(t.getCategory())).toList();
        }
        if (status != null && !status.equalsIgnoreCase("ALL")) {
            all = all.stream().filter(t -> status.equalsIgnoreCase(t.getStatus())).toList();
        }
        if (search != null && !search.trim().isEmpty()) {
            String lower = search.trim().toLowerCase();
            all = all.stream().filter(t ->
                    t.getName().toLowerCase().contains(lower) ||
                    t.getTemplateKey().toLowerCase().contains(lower) ||
                    t.getSubject().toLowerCase().contains(lower)
            ).toList();
        }
        return all.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public EmailTemplateDTOs.EmailTemplateResponse getTemplate(String id) {
        EmailTemplateEntity entity = repository.findById(id)
                .orElseThrow(ApiException::notFound);
        return toResponse(entity);
    }

    public EmailTemplateDTOs.EmailTemplateResponse createTemplate(EmailTemplateDTOs.CreateEmailTemplateRequest req, String actorEmail) {
        String templateId = "tpl-" + UUID.randomUUID().toString().substring(0, 8);
        String cleanKey = req.key().trim().toLowerCase(java.util.Locale.ROOT);

        if (repository.findByTemplateKey(cleanKey).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_KEY", "A template with key '" + cleanKey + "' already exists.");
        }

        EmailTemplateEntity entity = new EmailTemplateEntity();
        entity.setId(templateId);
        entity.setTemplateKey(cleanKey);
        entity.setCode(req.code() != null ? req.code() : "TPL-" + (System.currentTimeMillis() % 1000));
        entity.setName(req.name().trim());
        entity.setCategory(req.category().toUpperCase());
        entity.setTriggerDescription(req.triggerDescription());
        entity.setHeaderBadge(req.headerBadge());
        entity.setBannerColor(req.bannerColor() != null ? req.bannerColor() : "indigo");
        entity.setSenderBrandName(req.senderBrandName() != null ? req.senderBrandName() : "ProWise");
        entity.setShowHighlightBox(req.showHighlightBox() != null ? req.showHighlightBox() : true);
        entity.setFooterNote(req.footerNote());
        entity.setSubject(req.subject().trim());
        entity.setHeadline(req.headline().trim());
        entity.setBodyParagraphs(req.bodyParagraphs());
        entity.setCtaLabel(req.ctaLabel());
        entity.setCtaUrl(req.ctaUrl());
        entity.setVariables(writeVariablesJson(req.variables()));
        entity.setStatus(req.status() != null ? req.status().toUpperCase() : "ACTIVE");
        entity.setUpdatedAt(Instant.now());
        entity.setUpdatedBy(actorEmail != null ? actorEmail : "Super Admin");

        EmailTemplateEntity saved = repository.save(entity);
        repository.flush();

        auditService.logActivity(
                "COMMUNICATION",
                "CREATE_EMAIL_TEMPLATE",
                "Created email template: " + saved.getName() + " (" + saved.getTemplateKey() + ")",
                "Super Admin",
                actorEmail,
                saved.getName(),
                "INFO"
        );

        return toResponse(saved);
    }

    public EmailTemplateDTOs.EmailTemplateResponse updateTemplate(String id, EmailTemplateDTOs.UpdateEmailTemplateRequest req, String actorEmail) {
        EmailTemplateEntity entity = repository.findById(id)
                .orElseThrow(ApiException::notFound);
        ExpectedVersion.checkRequired(entity.getVersion(), req.expectedVersion());

        if (req.name() != null) entity.setName(req.name().trim());
        if (req.category() != null) entity.setCategory(req.category().toUpperCase());
        if (req.triggerDescription() != null) entity.setTriggerDescription(req.triggerDescription());
        if (req.headerBadge() != null) entity.setHeaderBadge(req.headerBadge());
        if (req.bannerColor() != null) entity.setBannerColor(req.bannerColor());
        if (req.senderBrandName() != null) entity.setSenderBrandName(req.senderBrandName());
        if (req.showHighlightBox() != null) entity.setShowHighlightBox(req.showHighlightBox());
        if (req.footerNote() != null) entity.setFooterNote(req.footerNote());
        if (req.subject() != null) entity.setSubject(req.subject().trim());
        if (req.headline() != null) entity.setHeadline(req.headline().trim());
        if (req.bodyParagraphs() != null) entity.setBodyParagraphs(req.bodyParagraphs());
        if (req.ctaLabel() != null) entity.setCtaLabel(req.ctaLabel());
        if (req.ctaUrl() != null) entity.setCtaUrl(req.ctaUrl());
        if (req.variables() != null) entity.setVariables(writeVariablesJson(req.variables()));
        if (req.status() != null) entity.setStatus(req.status().toUpperCase());
        entity.setUpdatedAt(Instant.now());
        entity.setUpdatedBy(actorEmail != null ? actorEmail : "Super Admin");

        EmailTemplateEntity updated = repository.save(entity);
        repository.flush();

        auditService.logActivity(
                "COMMUNICATION",
                "UPDATE_EMAIL_TEMPLATE",
                "Updated email template: " + updated.getName(),
                "Super Admin",
                actorEmail,
                updated.getName(),
                "INFO"
        );

        return toResponse(updated);
    }

    public EmailTemplateDTOs.EmailTemplateResponse cloneTemplate(String id, String actorEmail) {
        EmailTemplateEntity source = repository.findById(id)
                .orElseThrow(ApiException::notFound);

        String cloneId = "tpl-" + UUID.randomUUID().toString().substring(0, 8);
        String cloneKey = source.getTemplateKey() + "_clone_" + System.currentTimeMillis() % 1000;

        EmailTemplateEntity clone = new EmailTemplateEntity();
        clone.setId(cloneId);
        clone.setTemplateKey(cloneKey);
        clone.setCode(source.getCode() != null ? (source.getCode() + "-COPY") : "TPL-COPY");
        clone.setName("Copy of " + source.getName());
        clone.setCategory(source.getCategory());
        clone.setTriggerDescription(source.getTriggerDescription());
        clone.setHeaderBadge(source.getHeaderBadge());
        clone.setBannerColor(source.getBannerColor());
        clone.setSenderBrandName(source.getSenderBrandName());
        clone.setShowHighlightBox(source.getShowHighlightBox());
        clone.setFooterNote(source.getFooterNote());
        clone.setSubject(source.getSubject());
        clone.setHeadline(source.getHeadline());
        clone.setBodyParagraphs(source.getBodyParagraphs());
        clone.setCtaLabel(source.getCtaLabel());
        clone.setCtaUrl(source.getCtaUrl());
        clone.setVariables(source.getVariables());
        clone.setStatus("DRAFT");
        clone.setUpdatedAt(Instant.now());
        clone.setUpdatedBy(actorEmail != null ? actorEmail : "Super Admin");

        EmailTemplateEntity saved = repository.save(clone);
        repository.flush();

        auditService.logActivity(
                "COMMUNICATION",
                "CLONE_EMAIL_TEMPLATE",
                "Cloned email template " + source.getName() + " to " + saved.getName(),
                "Super Admin",
                actorEmail,
                saved.getName(),
                "INFO"
        );

        return toResponse(saved);
    }

    public void deleteTemplate(String id, Long expectedVersion, String actorEmail) {
        EmailTemplateEntity entity = repository.findById(id)
                .orElseThrow(ApiException::notFound);
        ExpectedVersion.checkRequired(entity.getVersion(), expectedVersion);

        repository.delete(entity);
        repository.flush();

        auditService.logActivity(
                "COMMUNICATION",
                "DELETE_EMAIL_TEMPLATE",
                "Deleted email template: " + entity.getName(),
                "Super Admin",
                actorEmail,
                entity.getName(),
                "WARNING"
        );
    }

    /** All-or-nothing: an unknown id is 404 and an outdated version 409 STALE_VERSION; nothing is deleted then. */
    public void bulkDelete(List<AdminRequests.VersionedId> items, String actorEmail) {
        List<EmailTemplateEntity> list = new ArrayList<>();
        for (AdminRequests.VersionedId item : items) {
            EmailTemplateEntity entity = repository.findById(item.id()).orElseThrow(ApiException::notFound);
            ExpectedVersion.checkRequired(entity.getVersion(), item.expectedVersion());
            list.add(entity);
        }
        repository.deleteAll(list);
        repository.flush();

        auditService.logActivity(
                "COMMUNICATION",
                "BULK_DELETE_EMAIL_TEMPLATES",
                "Bulk deleted " + list.size() + " email templates",
                "Super Admin",
                actorEmail,
                list.size() + " templates",
                "WARNING"
        );
    }

    public void sendTestEmail(String id, String recipientEmail, String actorEmail) {
        EmailTemplateEntity entity = repository.findById(id)
                .orElseThrow(ApiException::notFound);

        auditService.logActivity(
                "COMMUNICATION",
                "SEND_TEST_EMAIL",
                "Dispatched preview test email for '" + entity.getName() + "' to " + recipientEmail,
                "Super Admin",
                actorEmail,
                entity.getName(),
                "INFO"
        );
    }

    private EmailTemplateDTOs.EmailTemplateResponse toResponse(EmailTemplateEntity e) {
        List<String> vars = parseVariablesJson(e.getVariables());
        return EmailTemplateDTOs.EmailTemplateResponse.fromEntity(e, vars);
    }

    private List<String> parseVariablesJson(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception ex) {
            return List.of();
        }
    }

    private String writeVariablesJson(List<String> vars) {
        if (vars == null || vars.isEmpty()) return "[]";
        try {
            return objectMapper.writeValueAsString(vars);
        } catch (Exception ex) {
            return "[]";
        }
    }
}
