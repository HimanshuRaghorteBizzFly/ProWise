package com.prowise.project;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonAlias;

import jakarta.validation.constraints.NotBlank;

/** Task 2.2 request and response shapes (JSON is snake_case globally). */
public final class ProgressDTOs {

    private ProgressDTOs() {}

    /** A check-in or a correction. Every submission is a new PENDING entry; nothing is edited. */
    public record CheckInRequest(
            BigDecimal percent,
            String accomplished,
            @JsonAlias("nextSteps") String nextSteps,
            String blockers,
            @JsonAlias("projectedFinish") LocalDate projectedFinish,
            String evidence,
            @JsonAlias("downwardReason") String downwardReason,
            /** Structured evidence: commit links or SHAs, links, uploaded screenshots (FILE = file id). */
            @JsonAlias("evidenceItems") List<EvidenceItem> evidenceItems) {}

    /** One piece of evidence: COMMIT (SHA or commit URL), PULL_REQUEST, LINK, FILE (uploaded file id) or NOTE. */
    public record EvidenceItem(String type, String ref, String label) {}

    /** Team Lead decision on a pending entry: APPROVE or REJECT (a rejection needs a reason). */
    public record DecisionRequest(String decision, String reason, Long expectedVersion) {}

    public record AttachRepoRequest(
            @NotBlank(message = "repo_name is required")
            @JsonAlias({"repo_name", "repoName"})
            String repoName,
            @JsonAlias({"default_branch", "defaultBranch"})
            String defaultBranch
    ) {}

    public record PersonRef(UUID userId, String email) {}

    /** One stored entry: what was reported, by whom and when, with how (method) and its decision. */
    public record CheckIn(
            String id,
            String projectId,
            int revisionSeq,
            String revisionOf,
            BigDecimal percent,
            String accomplished,
            String nextSteps,
            String blockers,
            LocalDate projectedFinish,
            String evidence,
            String downwardReason,
            String status,
            String method,
            String label,
            PersonRef author,
            Instant submittedAt,
            PersonRef decidedBy,
            Instant decidedAt,
            String decisionReason,
            long version,
            List<EvidenceItem> evidenceItems) {}

    /** The approved figure; percent null and label "Not reported" when nothing is approved yet. */
    public record Figure(BigDecimal percent, String label, String method, Instant reportedAt, Instant approvedAt,
            String checkinId) {}

    public record ProgressSummary(
            String projectId,
            String projectKey,
            String projectName,
            String mode,
            String lifecycle,
            boolean archived,
            Figure current,
            CheckIn pending,
            PersonRef approver,
            String approverNote,
            boolean canSubmit,
            boolean canDecide,
            List<CheckIn> history,
            /** People chosen at creation to approve this project (PROJECT-scoped task.review). */
            List<PersonRef> approvers) {}

    public record PendingReview(String projectId, String projectKey, String projectName, Figure current,
            CheckIn checkin) {}
}
