package com.prowise.delivery;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonAlias;

public class DeliveryDTOs {

    public record ChecklistItem(
            String id,
            String label,
            boolean checked,
            String notes
    ) {}

    public record EvidenceItem(
            String type,
            String title,
            String url,
            String reference
    ) {}

    public record AcceptanceSubmissionRequest(
            @JsonAlias({"bound_checkin_id", "boundCheckinId"})
            String boundCheckinId,

            List<ChecklistItem> checklist,

            @JsonAlias({"evidence_summary", "evidenceSummary"})
            String evidenceSummary,

            @JsonAlias({"evidence_items", "evidenceItems"})
            List<EvidenceItem> evidenceItems
    ) {}

    public record AcceptanceDecisionRequest(
            String decision, // 'ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED'
            String reason,

            @JsonAlias({"expected_project_version", "expectedProjectVersion"})
            Long expectedProjectVersion
    ) {}

    public record CreateBlockerRequest(
            String title,
            String description,
            String severity // 'NORMAL', 'CRITICAL'
    ) {}

    public record CreateWaiverRequest(
            @JsonAlias({"blocker_ref", "blockerRef"})
            String blockerRef,

            String reason
    ) {}

    public record CloseProjectRequest(
            @JsonAlias({"handover_note", "handoverNote"})
            String handoverNote,

            String reason,

            @JsonAlias({"expected_project_version", "expectedProjectVersion"})
            Long expectedProjectVersion
    ) {}

    public record ReopenProjectRequest(
            String reason,

            @JsonAlias({"expected_project_version", "expectedProjectVersion"})
            Long expectedProjectVersion
    ) {}

    public record TransitionLifecycleRequest(
            @JsonAlias({"target_lifecycle", "targetLifecycle"})
            String targetLifecycle, // 'ON_HOLD', 'ACTIVE'

            String reason,

            @JsonAlias({"expected_project_version", "expectedProjectVersion"})
            Long expectedProjectVersion
    ) {}

    public record AcceptanceDecisionResponse(
            String id,
            String requestId,
            String projectId,
            String decision,
            String actorId,
            String actorName,
            String reason,
            Instant decidedAt
    ) {}

    public record AcceptanceRequestResponse(
            String id,
            UUID orgId,
            String projectId,
            String boundCheckinId,
            List<ChecklistItem> checklist,
            String evidenceSummary,
            List<EvidenceItem> evidenceItems,
            String status,
            Long version,
            String createdBy,
            String createdByName,
            Instant createdAt,
            Instant updatedAt,
            List<AcceptanceDecisionResponse> decisions
    ) {}

    public record ProjectBlockerWaiverResponse(
            String id,
            String projectId,
            String blockerRef,
            String actorId,
            String actorName,
            String reason,
            Instant waivedAt
    ) {}

    public record ProjectBlockerResponse(
            String id,
            String projectId,
            String title,
            String description,
            String severity,
            String status,
            String createdBy,
            Instant createdAt,
            Instant resolvedAt,
            ProjectBlockerWaiverResponse waiver
    ) {}

    public record ProjectClosureResponse(
            String id,
            String projectId,
            String actorId,
            String actorName,
            String handoverNote,
            String reason,
            Instant closedAt
    ) {}

    public record ProjectLifecycleHistoryResponse(
            String id,
            String projectId,
            String previousLifecycle,
            String newLifecycle,
            String reason,
            String actorId,
            String actorName,
            Instant createdAt
    ) {}

    public record ProjectDeliveryStatusResponse(
            String projectId,
            String lifecycle,
            String previousLifecycle,
            boolean archived,
            BigDecimal progressPercent,
            Long version,
            AcceptanceRequestResponse latestAcceptanceRequest,
            ProjectClosureResponse latestClosure,
            int openCriticalBlockersCount,
            int openUnwaivedCriticalBlockersCount,
            boolean canSubmitDelivery,
            boolean canApproveDelivery,
            boolean canClose,
            boolean canArchive,
            boolean canRestore
    ) {}
}
