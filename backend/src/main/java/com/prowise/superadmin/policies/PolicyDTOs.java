package com.prowise.superadmin.policies;

import java.time.Instant;
import java.util.List;
import com.prowise.superadmin.featureflags.FeatureFlagDTOs;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public final class PolicyDTOs {

    private PolicyDTOs() {}

    public record PlatformPolicyResponse(
            int checkinGraceWorkingDays,
            int staleWebhookMinutes,
            int auditRetentionDays,
            boolean enforceMfaForOperators,
            int autoSuspendAfterPastDueDays,
            int defaultTrialDays,
            int maxAttachmentMb,
            boolean maintenanceBannerMode,
            List<FeatureFlagDTOs.FeatureFlagResponse> featureFlags,
            Instant updatedAt
    ) {
        public static PlatformPolicyResponse fromEntity(
                PlatformPolicyEntity e,
                List<FeatureFlagDTOs.FeatureFlagResponse> flags
        ) {
            return new PlatformPolicyResponse(
                    e.getCheckinGraceWorkingDays(),
                    e.getStaleWebhookMinutes(),
                    e.getAuditRetentionDays(),
                    Boolean.TRUE.equals(e.getEnforceMfaForOperators()),
                    e.getAutoSuspendAfterPastDueDays(),
                    e.getDefaultTrialDays(),
                    e.getMaxAttachmentMb(),
                    Boolean.TRUE.equals(e.getMaintenanceBannerMode()),
                    flags,
                    e.getUpdatedAt()
            );
        }
    }

    public record UpdatePolicySettingsRequest(
            @NotNull Integer checkinGraceWorkingDays,
            @NotNull Integer staleWebhookMinutes,
            @NotNull Integer auditRetentionDays,
            @NotNull Boolean enforceMfaForOperators,
            @NotNull Integer autoSuspendAfterPastDueDays,
            @NotNull Integer defaultTrialDays,
            @NotNull Integer maxAttachmentMb,
            @NotNull Boolean maintenanceBannerMode
    ) {}

    public record PlatformBrandingResponse(
            String platformName,
            String supportEmail,
            String statusPageUrl,
            String defaultTimezone,
            String defaultLanguage,
            String dateFormat,
            String currencyDisplay,
            boolean compactDensity,
            Instant updatedAt
    ) {
        public static PlatformBrandingResponse fromEntity(PlatformBrandingEntity e) {
            return new PlatformBrandingResponse(
                    e.getPlatformName(),
                    e.getSupportEmail(),
                    e.getStatusPageUrl(),
                    e.getDefaultTimezone(),
                    e.getDefaultLanguage(),
                    e.getDateFormat(),
                    e.getCurrencyDisplay(),
                    Boolean.TRUE.equals(e.getCompactDensity()),
                    e.getUpdatedAt()
            );
        }
    }

    public record UpdateBrandingRequest(
            @NotBlank String platformName,
            @NotBlank @Email String supportEmail,
            String statusPageUrl,
            String defaultTimezone,
            String defaultLanguage,
            String dateFormat,
            String currencyDisplay,
            Boolean compactDensity
    ) {}
}
