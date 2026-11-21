package com.prowise.project;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class ProjectDTOs {

    private ProjectDTOs() {}

    public record CreateProjectRequest(
            @NotBlank(message = "Project name is required")
            @Size(max = 200, message = "Project name must not exceed 200 characters")
            String name,

            @NotBlank(message = "Project key is required")
            @Size(min = 2, max = 20, message = "Project key must be between 2 and 20 characters")
            @Pattern(regexp = "^[A-Za-z0-9_-]{2,20}$", message = "Project key must contain only letters, numbers, hyphens or underscores")
            String key,

            String description,
            String mode, // "INDIVIDUAL" or "STRUCTURED"
            String priority, // "LOW", "MEDIUM", "HIGH", "CRITICAL"
            String lifecycle, // "PLANNED", "ACTIVE", "ON_HOLD"
            @JsonAlias({"project_manager_id", "projectManagerId"})
            String projectManagerId,
            @JsonAlias({"accountable_developer_id", "accountableDeveloperId"})
            String accountableDeveloperId,
            @JsonAlias({"member_ids", "memberIds"})
            List<String> memberIds,
            @JsonAlias({"team_ids", "teamIds"})
            List<String> teamIds,
            @JsonAlias({"start_date", "startDate"})
            Instant startDate,
            @JsonAlias({"target_date", "targetDate"})
            Instant targetDate,
            String timezone
    ) {}

    public record UpdateProjectRequest(
            String name,
            String description,
            String mode,
            String priority,
            String lifecycle,
            @JsonAlias({"project_manager_id", "projectManagerId"})
            String projectManagerId,
            @JsonAlias({"accountable_developer_id", "accountableDeveloperId"})
            String accountableDeveloperId,
            @JsonAlias({"start_date", "startDate"})
            Instant startDate,
            @JsonAlias({"target_date", "targetDate"})
            Instant targetDate,
            @JsonAlias({"target_date_reason", "targetDateReason"})
            String targetDateReason,
            String timezone,
            @JsonAlias({"member_ids", "memberIds"})
            List<String> memberIds,
            @JsonAlias({"team_ids", "teamIds"})
            List<String> teamIds,
            @NotNull(message = "expected_version is required for concurrency control")
            @JsonAlias({"expected_version", "expectedVersion"})
            Long expectedVersion
    ) {}

    public record ProjectResponse(
            String id,
            UUID orgId,
            String key,
            String name,
            String description,
            String mode,
            String lifecycle,
            String priority,
            String projectManagerId,
            String accountableDeveloperId,
            List<String> teamIds,
            List<String> memberIds,
            Instant startDate,
            Instant targetDate,
            String timezone,
            BigDecimal lastProgressPercent,
            String health,
            boolean archived,
            Long version,
            Instant createdAt,
            Instant updatedAt,
            List<ProjectDateHistoryDTO> dateHistory
    ) {}

    public record ProjectMemberRequest(
            @NotNull(message = "membership_id is required")
            @JsonAlias({"membership_id", "membershipId"})
            UUID membershipId,
            String role
    ) {}

    public record ProjectMemberResponse(
            UUID id,
            String projectId,
            UUID membershipId,
            UUID userId,
            String name,
            String email,
            String role,
            Instant createdAt
    ) {}

    public record ProjectDateHistoryDTO(
            UUID id,
            Instant oldTargetDate,
            Instant newTargetDate,
            String reason,
            UUID actorId,
            Instant changedAt
    ) {}

    public record ProjectListResponse(
            List<ProjectResponse> projects,
            String nextCursor,
            boolean hasMore,
            long totalCount
    ) {}
}
