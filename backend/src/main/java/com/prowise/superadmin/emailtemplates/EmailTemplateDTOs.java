package com.prowise.superadmin.emailtemplates;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public final class EmailTemplateDTOs {

    private EmailTemplateDTOs() {}

    public record EmailTemplateResponse(
            String id,
            String key,
            String code,
            String name,
            String category,
            String triggerDescription,
            String headerBadge,
            String bannerColor,
            String senderBrandName,
            boolean showHighlightBox,
            String footerNote,
            BigDecimal openRate,
            BigDecimal clickRate,
            String subject,
            String headline,
            String bodyParagraphs,
            String ctaLabel,
            String ctaUrl,
            List<String> variables,
            String status,
            Instant updatedAt,
            String updatedBy
    ) {
        public static EmailTemplateResponse fromEntity(EmailTemplateEntity e, List<String> parsedVars) {
            return new EmailTemplateResponse(
                    e.getId(),
                    e.getTemplateKey(),
                    e.getCode(),
                    e.getName(),
                    e.getCategory(),
                    e.getTriggerDescription(),
                    e.getHeaderBadge(),
                    e.getBannerColor(),
                    e.getSenderBrandName(),
                    e.getShowHighlightBox() != null ? e.getShowHighlightBox() : true,
                    e.getFooterNote(),
                    e.getOpenRate(),
                    e.getClickRate(),
                    e.getSubject(),
                    e.getHeadline(),
                    e.getBodyParagraphs(),
                    e.getCtaLabel(),
                    e.getCtaUrl(),
                    parsedVars,
                    e.getStatus(),
                    e.getUpdatedAt(),
                    e.getUpdatedBy()
            );
        }
    }

    public record CreateEmailTemplateRequest(
            @NotBlank String key,
            String code,
            @NotBlank String name,
            @NotBlank String category,
            String triggerDescription,
            String headerBadge,
            String bannerColor,
            String senderBrandName,
            Boolean showHighlightBox,
            String footerNote,
            @NotBlank String subject,
            @NotBlank String headline,
            @NotBlank String bodyParagraphs,
            String ctaLabel,
            String ctaUrl,
            List<String> variables,
            String status
    ) {}

    public record UpdateEmailTemplateRequest(
            String name,
            String category,
            String triggerDescription,
            String headerBadge,
            String bannerColor,
            String senderBrandName,
            Boolean showHighlightBox,
            String footerNote,
            String subject,
            String headline,
            String bodyParagraphs,
            String ctaLabel,
            String ctaUrl,
            List<String> variables,
            String status
    ) {}

    public record SendTestEmailRequest(
            @NotBlank String recipientEmail
    ) {}

    public record BulkDeleteRequest(
            @NotNull List<String> ids
    ) {}
}
