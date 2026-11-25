package com.prowise.superadmin.featureflags;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.superadmin.audit.AuditService;

@Service
@Transactional
public class FeatureFlagService {

    private final FeatureFlagRepository repository;
    private final AuditService auditService;

    public FeatureFlagService(FeatureFlagRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<FeatureFlagDTOs.FeatureFlagResponse> listFeatureFlags() {
        return repository.findAll().stream().map(FeatureFlagDTOs.FeatureFlagResponse::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public FeatureFlagDTOs.FeatureFlagResponse getFeatureFlag(String id) {
        FeatureFlagEntity entity = repository.findById(id)
                .orElseThrow(ApiException::notFound);
        return FeatureFlagDTOs.FeatureFlagResponse.fromEntity(entity);
    }

    public FeatureFlagDTOs.FeatureFlagResponse createFeatureFlag(FeatureFlagDTOs.CreateFeatureFlagRequest req, String actorEmail) {
        String cleanKey = req.flagKey().trim().toLowerCase(java.util.Locale.ROOT);
        if (repository.findByFlagKey(cleanKey).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_KEY", "Feature flag key '" + cleanKey + "' already exists.");
        }

        String id = "flag-" + UUID.randomUUID().toString().substring(0, 8);
        FeatureFlagEntity entity = new FeatureFlagEntity();
        entity.setId(id);
        entity.setFlagKey(cleanKey);
        entity.setLabel(req.label().trim());
        entity.setDescription(req.description());
        entity.setEnabled(Boolean.TRUE.equals(req.enabled()));
        entity.setAudience(req.audience() != null ? req.audience() : "All Tenants");
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());

        FeatureFlagEntity saved = repository.save(entity);
        repository.flush();

        auditService.logActivity(
                "PLATFORM",
                "CREATE_FEATURE_FLAG",
                "Created feature flag: " + saved.getLabel() + " (" + saved.getFlagKey() + ")",
                "Super Admin",
                actorEmail,
                saved.getLabel(),
                "INFO"
        );

        return FeatureFlagDTOs.FeatureFlagResponse.fromEntity(saved);
    }

    public FeatureFlagDTOs.FeatureFlagResponse updateFeatureFlag(String id, FeatureFlagDTOs.UpdateFeatureFlagRequest req, String actorEmail) {
        FeatureFlagEntity entity = repository.findById(id)
                .orElseThrow(ApiException::notFound);
        ExpectedVersion.checkRequired(entity.getVersion(), req.expectedVersion());

        if (req.label() != null) entity.setLabel(req.label().trim());
        if (req.description() != null) entity.setDescription(req.description());
        if (req.enabled() != null) entity.setEnabled(req.enabled());
        if (req.audience() != null) entity.setAudience(req.audience());
        entity.setUpdatedAt(Instant.now());

        FeatureFlagEntity updated = repository.save(entity);
        repository.flush();

        auditService.logActivity(
                "PLATFORM",
                "UPDATE_FEATURE_FLAG",
                "Updated feature flag: " + updated.getLabel(),
                "Super Admin",
                actorEmail,
                updated.getLabel(),
                "INFO"
        );

        return FeatureFlagDTOs.FeatureFlagResponse.fromEntity(updated);
    }

    public FeatureFlagDTOs.FeatureFlagResponse toggleFeatureFlag(String id, boolean enabled, Long expectedVersion, String actorEmail) {
        FeatureFlagEntity entity = repository.findById(id)
                .orElseThrow(ApiException::notFound);
        ExpectedVersion.checkRequired(entity.getVersion(), expectedVersion);

        entity.setEnabled(enabled);
        entity.setUpdatedAt(Instant.now());
        FeatureFlagEntity updated = repository.save(entity);
        repository.flush();

        auditService.logActivity(
                "PLATFORM",
                "TOGGLE_FEATURE_FLAG",
                (enabled ? "Enabled" : "Disabled") + " feature flag: " + updated.getLabel(),
                "Super Admin",
                actorEmail,
                updated.getLabel(),
                "WARNING"
        );

        return FeatureFlagDTOs.FeatureFlagResponse.fromEntity(updated);
    }

    public void deleteFeatureFlag(String id, Long expectedVersion, String actorEmail) {
        FeatureFlagEntity entity = repository.findById(id)
                .orElseThrow(ApiException::notFound);
        ExpectedVersion.checkRequired(entity.getVersion(), expectedVersion);

        repository.delete(entity);
        repository.flush();

        auditService.logActivity(
                "PLATFORM",
                "DELETE_FEATURE_FLAG",
                "Deleted feature flag: " + entity.getLabel(),
                "Super Admin",
                actorEmail,
                entity.getLabel(),
                "WARNING"
        );
    }
}
