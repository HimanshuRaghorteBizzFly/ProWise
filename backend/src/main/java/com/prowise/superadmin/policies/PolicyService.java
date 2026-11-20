package com.prowise.superadmin.policies;

import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.superadmin.audit.AuditService;
import com.prowise.superadmin.featureflags.FeatureFlagDTOs;
import com.prowise.superadmin.featureflags.FeatureFlagService;

@Service
@Transactional
public class PolicyService {

    private final PlatformPolicyRepository policyRepository;
    private final PlatformBrandingRepository brandingRepository;
    private final FeatureFlagService featureFlagService;
    private final AuditService auditService;

    public PolicyService(
            PlatformPolicyRepository policyRepository,
            PlatformBrandingRepository brandingRepository,
            FeatureFlagService featureFlagService,
            AuditService auditService
    ) {
        this.policyRepository = policyRepository;
        this.brandingRepository = brandingRepository;
        this.featureFlagService = featureFlagService;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public PolicyDTOs.PlatformPolicyResponse getPolicySettings() {
        PlatformPolicyEntity policy = policyRepository.findAll().stream().findFirst().orElseGet(() -> {
            PlatformPolicyEntity def = new PlatformPolicyEntity();
            return policyRepository.save(def);
        });

        List<FeatureFlagDTOs.FeatureFlagResponse> flags = featureFlagService.listFeatureFlags();
        return PolicyDTOs.PlatformPolicyResponse.fromEntity(policy, flags);
    }

    public PolicyDTOs.PlatformPolicyResponse updatePolicySettings(PolicyDTOs.UpdatePolicySettingsRequest req, String actorEmail) {
        PlatformPolicyEntity policy = policyRepository.findAll().stream().findFirst().orElseGet(() -> {
            PlatformPolicyEntity def = new PlatformPolicyEntity();
            return def;
        });

        policy.setCheckinGraceWorkingDays(req.checkinGraceWorkingDays());
        policy.setStaleWebhookMinutes(req.staleWebhookMinutes());
        policy.setAuditRetentionDays(req.auditRetentionDays());
        policy.setEnforceMfaForOperators(req.enforceMfaForOperators());
        policy.setAutoSuspendAfterPastDueDays(req.autoSuspendAfterPastDueDays());
        policy.setDefaultTrialDays(req.defaultTrialDays());
        policy.setMaxAttachmentMb(req.maxAttachmentMb());
        policy.setMaintenanceBannerMode(req.maintenanceBannerMode());
        policy.setUpdatedAt(Instant.now());

        PlatformPolicyEntity saved = policyRepository.save(policy);

        auditService.logActivity(
                "SECURITY",
                "UPDATE_PLATFORM_POLICIES",
                "Updated global platform security, retention and grace policies",
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                "Global Policies",
                "WARNING"
        );

        List<FeatureFlagDTOs.FeatureFlagResponse> flags = featureFlagService.listFeatureFlags();
        return PolicyDTOs.PlatformPolicyResponse.fromEntity(saved, flags);
    }

    @Transactional(readOnly = true)
    public PolicyDTOs.PlatformBrandingResponse getBrandingPreferences() {
        PlatformBrandingEntity branding = brandingRepository.findAll().stream().findFirst().orElseGet(() -> {
            PlatformBrandingEntity def = new PlatformBrandingEntity();
            return brandingRepository.save(def);
        });
        return PolicyDTOs.PlatformBrandingResponse.fromEntity(branding);
    }

    public PolicyDTOs.PlatformBrandingResponse updateBrandingPreferences(PolicyDTOs.UpdateBrandingRequest req, String actorEmail) {
        PlatformBrandingEntity branding = brandingRepository.findAll().stream().findFirst().orElseGet(() -> {
            PlatformBrandingEntity def = new PlatformBrandingEntity();
            return def;
        });

        branding.setPlatformName(req.platformName().trim());
        branding.setSupportEmail(req.supportEmail().trim());
        if (req.statusPageUrl() != null) branding.setStatusPageUrl(req.statusPageUrl().trim());
        if (req.defaultTimezone() != null) branding.setDefaultTimezone(req.defaultTimezone().trim());
        if (req.defaultLanguage() != null) branding.setDefaultLanguage(req.defaultLanguage().trim());
        if (req.dateFormat() != null) branding.setDateFormat(req.dateFormat().trim());
        if (req.currencyDisplay() != null) branding.setCurrencyDisplay(req.currencyDisplay().trim());
        if (req.compactDensity() != null) branding.setCompactDensity(req.compactDensity());
        branding.setUpdatedAt(Instant.now());

        PlatformBrandingEntity saved = brandingRepository.save(branding);

        auditService.logActivity(
                "PLATFORM",
                "UPDATE_BRANDING_PREFERENCES",
                "Updated platform global branding: " + saved.getPlatformName(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                saved.getPlatformName(),
                "INFO"
        );

        return PolicyDTOs.PlatformBrandingResponse.fromEntity(saved);
    }
}
