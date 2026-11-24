package com.prowise.superadmin.emailtemplates;

import java.math.BigDecimal;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "email_templates")
public class EmailTemplateEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "template_key", nullable = false, unique = true, length = 80)
    private String templateKey;

    @Column(name = "code", length = 64)
    private String code;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "category", nullable = false, length = 50)
    private String category = "ALERTS"; // AUTH, BILLING, DELIVERY, ALERTS, ANNOUNCEMENTS

    @Column(name = "trigger_description", columnDefinition = "TEXT")
    private String triggerDescription;

    @Column(name = "header_badge", length = 80)
    private String headerBadge;

    @Column(name = "banner_color", length = 30)
    private String bannerColor = "indigo";

    @Column(name = "sender_brand_name", length = 120)
    private String senderBrandName = "ProWise";

    @Column(name = "show_highlight_box", nullable = false)
    private Boolean showHighlightBox = true;

    @Column(name = "footer_note", columnDefinition = "TEXT")
    private String footerNote;

    @Column(name = "open_rate", precision = 5, scale = 2)
    private BigDecimal openRate = BigDecimal.ZERO;

    @Column(name = "click_rate", precision = 5, scale = 2)
    private BigDecimal clickRate = BigDecimal.ZERO;

    @Column(name = "subject", nullable = false, length = 255)
    private String subject;

    @Column(name = "headline", nullable = false, length = 255)
    private String headline;

    @Column(name = "body_paragraphs", nullable = false, columnDefinition = "TEXT")
    private String bodyParagraphs;

    @Column(name = "cta_label", length = 100)
    private String ctaLabel;

    @Column(name = "cta_url", length = 255)
    private String ctaUrl;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "variables", columnDefinition = "JSONB")
    private String variables = "[]";

    @Column(name = "status", nullable = false, length = 30)
    private String status = "ACTIVE"; // ACTIVE, DRAFT

    @Version
    @Column(name = "version", nullable = false)
    private Long version = 0L;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Column(name = "updated_by", nullable = false, length = 200)
    private String updatedBy = "Super Admin";

    public EmailTemplateEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTemplateKey() { return templateKey; }
    public void setTemplateKey(String templateKey) { this.templateKey = templateKey; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getTriggerDescription() { return triggerDescription; }
    public void setTriggerDescription(String triggerDescription) { this.triggerDescription = triggerDescription; }

    public String getHeaderBadge() { return headerBadge; }
    public void setHeaderBadge(String headerBadge) { this.headerBadge = headerBadge; }

    public String getBannerColor() { return bannerColor; }
    public void setBannerColor(String bannerColor) { this.bannerColor = bannerColor; }

    public String getSenderBrandName() { return senderBrandName; }
    public void setSenderBrandName(String senderBrandName) { this.senderBrandName = senderBrandName; }

    public Boolean getShowHighlightBox() { return showHighlightBox; }
    public void setShowHighlightBox(Boolean showHighlightBox) { this.showHighlightBox = showHighlightBox; }

    public String getFooterNote() { return footerNote; }
    public void setFooterNote(String footerNote) { this.footerNote = footerNote; }

    public BigDecimal getOpenRate() { return openRate; }
    public void setOpenRate(BigDecimal openRate) { this.openRate = openRate; }

    public BigDecimal getClickRate() { return clickRate; }
    public void setClickRate(BigDecimal clickRate) { this.clickRate = clickRate; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public String getHeadline() { return headline; }
    public void setHeadline(String headline) { this.headline = headline; }

    public String getBodyParagraphs() { return bodyParagraphs; }
    public void setBodyParagraphs(String bodyParagraphs) { this.bodyParagraphs = bodyParagraphs; }

    public String getCtaLabel() { return ctaLabel; }
    public void setCtaLabel(String ctaLabel) { this.ctaLabel = ctaLabel; }

    public String getCtaUrl() { return ctaUrl; }
    public void setCtaUrl(String ctaUrl) { this.ctaUrl = ctaUrl; }

    public String getVariables() { return variables; }
    public void setVariables(String variables) { this.variables = variables; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
