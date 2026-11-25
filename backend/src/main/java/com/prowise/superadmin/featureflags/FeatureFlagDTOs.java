package com.prowise.superadmin.featureflags;

import java.time.Instant;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public final class FeatureFlagDTOs {

    private FeatureFlagDTOs() {}

    public record FeatureFlagResponse(
            String id,
            String flagKey,
            String label,
            String description,
            boolean enabled,
            String audience,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
        public static FeatureFlagResponse fromEntity(FeatureFlagEntity e) {
            return new FeatureFlagResponse(
                    e.getId(),
                    e.getFlagKey(),
                    e.getLabel(),
                    e.getDescription(),
                    Boolean.TRUE.equals(e.getEnabled()),
                    e.getAudience(),
                    e.getCreatedAt(),
                    e.getUpdatedAt(),
                    e.getVersion() == null ? 0L : e.getVersion()
            );
        }
    }

    public record CreateFeatureFlagRequest(
            @NotBlank String flagKey,
            @NotBlank String label,
            String description,
            Boolean enabled,
            String audience
    ) {}

    public record UpdateFeatureFlagRequest(
            String label,
            String description,
            Boolean enabled,
            String audience,
            Long expectedVersion
    ) {}

    public record ToggleFlagRequest(
            @NotNull Boolean enabled,
            Long expectedVersion
    ) {}
}
