package com.prowise.superadmin.featureflags;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
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
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "FLAG_NOT_FOUND", "Feature flag not found: " + id));
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

        auditService.logActivity(
                "PLATFORM",
                "CREATE_FEATURE_FLAG",
                "Created feature flag: " + saved.getLabel() + " (" + saved.getFlagKey() + ")",
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                saved.getLabel(),
                "INFO"
        );

        return FeatureFlagDTOs.FeatureFlagResponse.fromEntity(saved);
    }

    public FeatureFlagDTOs.FeatureFlagResponse updateFeatureFlag(String id, FeatureFlagDTOs.UpdateFeatureFlagRequest req, String actorEmail) {
        FeatureFlagEntity entity = repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "FLAG_NOT_FOUND", "Feature flag not found: " + id));

        if (req.label() != null) entity.setLabel(req.label().trim());
        if (req.description() != null) entity.setDescription(req.description());
        if (req.enabled() != null) entity.setEnabled(req.enabled());
        if (req.audience() != null) entity.setAudience(req.audience());
        entity.setUpdatedAt(Instant.now());

        FeatureFlagEntity updated = repository.save(entity);

        auditService.logActivity(
                "PLATFORM",
                "UPDATE_FEATURE_FLAG",
                "Updated feature flag: " + updated.getLabel(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                updated.getLabel(),
                "INFO"
        );

        return FeatureFlagDTOs.FeatureFlagResponse.fromEntity(updated);
    }

    public FeatureFlagDTOs.FeatureFlagResponse toggleFeatureFlag(String id, boolean enabled, String actorEmail) {
        FeatureFlagEntity entity = repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "FLAG_NOT_FOUND", "Feature flag not found: " + id));

        entity.setEnabled(enabled);
        entity.setUpdatedAt(Instant.now());
        FeatureFlagEntity updated = repository.save(entity);

        auditService.logActivity(
                "PLATFORM",
                "TOGGLE_FEATURE_FLAG",
                (enabled ? "Enabled" : "Disabled") + " feature flag: " + updated.getLabel(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                updated.getLabel(),
                "WARNING"
        );

        return FeatureFlagDTOs.FeatureFlagResponse.fromEntity(updated);
    }

    public void deleteFeatureFlag(String id, String actorEmail) {
        FeatureFlagEntity entity = repository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "FLAG_NOT_FOUND", "Feature flag not found: " + id));

        repository.delete(entity);

        auditService.logActivity(
                "PLATFORM",
                "DELETE_FEATURE_FLAG",
                "Deleted feature flag: " + entity.getLabel(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                entity.getLabel(),
                "WARNING"
        );
    }
}
