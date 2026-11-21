package com.prowise.project;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class ProgressDTOs {

    public record EvidenceItemDTO(
            String type, // "COMMIT", "PR", "LINK"
            String url,
            String title,
            String sha,
            @JsonAlias({"pr_number", "prNumber"})
            Integer prNumber,
            @JsonAlias({"repo_name", "repoName"})
            String repoName
    ) {}

    public record CheckInSubmissionRequest(
            @NotNull(message = "percent is required")
            @DecimalMin(value = "0.00", message = "percent cannot be negative")
            @DecimalMax(value = "100.00", message = "percent cannot exceed 100")
            BigDecimal percent,

            @NotBlank(message = "accomplished is required")
            String accomplished,

            @NotBlank(message = "next_steps is required")
            @JsonAlias({"next_steps", "nextSteps"})
            String nextSteps,

            String blockers,

            @JsonAlias({"projected_finish", "projectedFinish"})
            Instant projectedFinish,

            @JsonAlias({"downward_reason", "downwardReason"})
            String downwardReason,

            @JsonAlias({"revision_of", "revisionOf"})
            String revisionOf,

            String evidence,

            @JsonAlias({"evidence_items", "evidenceItems"})
            List<EvidenceItemDTO> evidenceItems,

            @JsonAlias({"idempotency_key", "idempotencyKey"})
            String idempotencyKey
    ) {}

    public record VerificationDecisionRequest(
            @NotBlank(message = "decision is required (APPROVE, REQUEST_CHANGES, REJECT)")
            String decision,
            String comment
    ) {}

    public record ToggleVerificationRequest(
            @JsonAlias({"require_verification", "requireVerification"})
            boolean requireVerification
    ) {}

    public record AttachRepoRequest(
            @NotBlank(message = "repo_name is required")
            @JsonAlias({"repo_name", "repoName"})
            String repoName,
            @JsonAlias({"default_branch", "defaultBranch"})
            String defaultBranch
    ) {}

    public record CheckInResponse(
            String id,
            UUID orgId,
            String projectId,
            String projectKey,
            String projectName,
            String authorId,
            String authorName,
            String revisionOf,
            int revisionSeq,
            BigDecimal percent,
            String accomplished,
            String nextSteps,
            String blockers,
            Instant projectedFinish,
            String downwardReason,
            String status,
            String method,
            String evidence,
            List<EvidenceItemDTO> evidenceItems,
            String verifiedBy,
            String reviewComment,
            Instant reviewedAt,
            Instant capturedAt,
            Instant createdAt,
            long version
    ) {}

    public record ProgressSummaryResponse(
            String projectId,
            String projectKey,
            String projectName,
            String mode,
            BigDecimal currentPercent,
            String currentMethod,
            Instant lastReportedAt,
            boolean requireVerification,
            CheckInResponse latestAcceptedCheckIn,
            CheckInResponse pendingCheckIn,
            List<CheckInResponse> history
    ) {}

    public record PendingReviewResponse(
            CheckInResponse checkin,
            String projectKey,
            String projectName,
            String authorName,
            BigDecimal previousAcceptedPercent
    ) {}
}
