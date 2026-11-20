package com.prowise.superadmin.policies;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "platform_policies")
public class PlatformPolicyEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id = "policy-default";

    @Column(name = "checkin_grace_working_days", nullable = false)
    private Integer checkinGraceWorkingDays = 3;

    @Column(name = "stale_webhook_minutes", nullable = false)
    private Integer staleWebhookMinutes = 60;

    @Column(name = "audit_retention_days", nullable = false)
    private Integer auditRetentionDays = 90;

    @Column(name = "enforce_mfa_for_operators", nullable = false)
    private Boolean enforceMfaForOperators = true;

    @Column(name = "auto_suspend_after_past_due_days", nullable = false)
    private Integer autoSuspendAfterPastDueDays = 14;

    @Column(name = "default_trial_days", nullable = false)
    private Integer defaultTrialDays = 14;

    @Column(name = "max_attachment_mb", nullable = false)
    private Integer maxAttachmentMb = 50;

    @Column(name = "maintenance_banner_mode", nullable = false)
    private Boolean maintenanceBannerMode = false;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public PlatformPolicyEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Integer getCheckinGraceWorkingDays() { return checkinGraceWorkingDays; }
    public void setCheckinGraceWorkingDays(Integer checkinGraceWorkingDays) { this.checkinGraceWorkingDays = checkinGraceWorkingDays; }

    public Integer getStaleWebhookMinutes() { return staleWebhookMinutes; }
    public void setStaleWebhookMinutes(Integer staleWebhookMinutes) { this.staleWebhookMinutes = staleWebhookMinutes; }

    public Integer getAuditRetentionDays() { return auditRetentionDays; }
    public void setAuditRetentionDays(Integer auditRetentionDays) { this.auditRetentionDays = auditRetentionDays; }

    public Boolean getEnforceMfaForOperators() { return enforceMfaForOperators; }
    public void setEnforceMfaForOperators(Boolean enforceMfaForOperators) { this.enforceMfaForOperators = enforceMfaForOperators; }

    public Integer getAutoSuspendAfterPastDueDays() { return autoSuspendAfterPastDueDays; }
    public void setAutoSuspendAfterPastDueDays(Integer autoSuspendAfterPastDueDays) { this.autoSuspendAfterPastDueDays = autoSuspendAfterPastDueDays; }

    public Integer getDefaultTrialDays() { return defaultTrialDays; }
    public void setDefaultTrialDays(Integer defaultTrialDays) { this.defaultTrialDays = defaultTrialDays; }

    public Integer getMaxAttachmentMb() { return maxAttachmentMb; }
    public void setMaxAttachmentMb(Integer maxAttachmentMb) { this.maxAttachmentMb = maxAttachmentMb; }

    public Boolean getMaintenanceBannerMode() { return maintenanceBannerMode; }
    public void setMaintenanceBannerMode(Boolean maintenanceBannerMode) { this.maintenanceBannerMode = maintenanceBannerMode; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
