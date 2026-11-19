package com.prowise.superadmin.announcements;

import java.time.Instant;
import java.util.List;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

public final class AnnouncementDTOs {

    private AnnouncementDTOs() {}

    public record AnnouncementResponse(
            String id,
            String title,
            String message,
            String type,
            String targetAudience,
            List<String> targetPlans,
            List<String> targetOrgIds,
            List<String> channels,
            String status,
            Instant scheduledFor,
            Instant expiresAt,
            Instant publishedAt,
            String createdBy,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static AnnouncementResponse fromEntity(
                AnnouncementEntity e,
                List<String> plans,
                List<String> orgIds,
                List<String> channels
        ) {
            return new AnnouncementResponse(
                    e.getId(),
                    e.getTitle(),
                    e.getMessage(),
                    e.getType(),
                    e.getTargetAudience(),
                    plans,
                    orgIds,
                    channels,
                    e.getStatus(),
                    e.getScheduledFor(),
                    e.getExpiresAt(),
                    e.getPublishedAt(),
                    e.getCreatedBy(),
                    e.getCreatedAt(),
                    e.getUpdatedAt()
            );
        }
    }

    public record CreateAnnouncementRequest(
            @NotBlank String title,
            @NotBlank String message,
            @NotBlank String type,
            @NotBlank String targetAudience,
            List<String> targetPlans,
            List<String> targetOrgIds,
            @NotEmpty List<String> channels,
            String status,
            Instant scheduledFor,
            Instant expiresAt
    ) {}

    public record UpdateAnnouncementRequest(
            String title,
            String message,
            String type,
            String targetAudience,
            List<String> targetPlans,
            List<String> targetOrgIds,
            List<String> channels,
            String status,
            Instant scheduledFor,
            Instant expiresAt
    ) {}

    public record BulkDeleteRequest(
            @NotNull List<String> ids
    ) {}
}
