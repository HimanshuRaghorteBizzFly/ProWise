package com.prowise.operator.console;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

/** Operator announcement and email drafts (JSON is snake_case; every update carries expected_version). */
public final class DraftDTOs {

    private DraftDTOs() {}

    @Schema(name = "OperatorAnnouncementDraft")
    public record AnnouncementDraft(
            String id,
            String title,
            String message,
            String type,
            String targetAudience,
            List<String> targetPlans,
            List<String> targetOrgIds,
            List<String> channels,
            @Schema(description = "DRAFT, PENDING_REVIEW, CHANGES_REQUESTED, PUBLISHED, ARCHIVED") String status,
            Instant scheduledFor,
            Instant expiresAt,
            Instant publishedAt,
            String authorType,
            String authorId,
            String createdBy,
            Instant submittedAt,
            String submittedBy,
            String reviewerNote,
            String reviewedBy,
            Instant reviewedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {}

    @Schema(name = "OperatorAnnouncementDraftRequest")
    public record AnnouncementDraftRequest(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 255) String title,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message,
            @Schema(description = "Default INFO; letters and underscores, e.g. MAINTENANCE, PRODUCT_UPDATE") String type,
            @Schema(description = "Default ALL_ORGS") String targetAudience,
            List<String> targetPlans,
            List<String> targetOrgIds,
            @Schema(description = "Default [IN_APP_BANNER]") List<String> channels,
            @Schema(description = "Proposed schedule") Instant scheduledFor,
            Instant expiresAt,
            @Schema(description = "Required on PUT; ignored on POST") Long expectedVersion
    ) {}

    @Schema(name = "OperatorEmailDraft")
    public record EmailDraft(
            String id,
            String name,
            String category,
            String subject,
            String headline,
            String bodyText,
            String bodyHtml,
            String ctaLabel,
            String audienceDescription,
            @Schema(description = "DRAFT, SUBMITTED, APPROVED, REJECTED") String status,
            String authorType,
            String createdBy,
            String createdByEmail,
            Instant submittedAt,
            String reviewedBy,
            Instant reviewedAt,
            String reviewerNote,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {}

    @Schema(name = "OperatorEmailDraftRequest")
    public record EmailDraftRequest(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 200) String name,
            @Schema(maxLength = 60) String category,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 255) String subject,
            @Schema(maxLength = 255) String headline,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String bodyText,
            @Schema(description = "Optional HTML; script, iframe/object/embed, on* event handlers and javascript:/vbscript: URLs are refused (400)")
            String bodyHtml,
            @Schema(maxLength = 120) String ctaLabel,
            @Schema(maxLength = 500) String audienceDescription,
            @Schema(description = "Required on PUT; ignored on POST") Long expectedVersion
    ) {}

    @Schema(name = "DraftReviewRequest")
    public record ReviewRequest(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long expectedVersion,
            @Schema(description = "Shown to the author") String reviewerNote
    ) {}
}
