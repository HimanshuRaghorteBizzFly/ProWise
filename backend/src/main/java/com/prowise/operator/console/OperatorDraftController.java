package com.prowise.operator.console;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.common.api.ClientAddress;
import com.prowise.identity.AuthPrincipal;
import com.prowise.superadmin.common.AdminRequests;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Operator announcement and email drafts. Operators draft and submit; only a Super Admin publishes an
 * announcement (existing /v1/admin/announcements/{id}/publish) or reviews an email draft (below).
 */
@RestController
@Tag(name = "Platform Operator Drafts", description = "Announcement and email drafts for Super Admin review")
public class OperatorDraftController {

    private static final String OPERATOR = "hasAuthority('PLATFORM_OPERATOR') or hasAuthority('PLATFORM_SUPER_ADMIN')";

    private final AnnouncementDraftService announcements;
    private final EmailDraftService emails;

    public OperatorDraftController(AnnouncementDraftService announcements, EmailDraftService emails) {
        this.announcements = announcements;
        this.emails = emails;
    }

    // ---------------------------------------------------------------- announcement drafts

    @GetMapping("/v1/operator/announcement-drafts")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "List operator-authored announcement drafts (communications.announcements:view)")
    public ConsoleDTOs.Page<DraftDTOs.AnnouncementDraft> listAnnouncements(
            @RequestParam(required = false) String status, @RequestParam(required = false) String search,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size,
            HttpServletRequest request) {
        return announcements.list(AuthPrincipal.require(request), status, search, page, size);
    }

    @GetMapping("/v1/operator/announcement-drafts/{id}")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Get one announcement draft")
    public DraftDTOs.AnnouncementDraft getAnnouncement(@PathVariable String id, HttpServletRequest request) {
        return announcements.get(AuthPrincipal.require(request), id);
    }

    @PostMapping("/v1/operator/announcement-drafts")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Create an announcement draft (communications.announcements:create); status DRAFT")
    public ResponseEntity<DraftDTOs.AnnouncementDraft> createAnnouncement(
            @RequestBody(required = false) DraftDTOs.AnnouncementDraftRequest body, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(announcements.create(AuthPrincipal.require(request), body, ClientAddress.of(request)));
    }

    @PutMapping("/v1/operator/announcement-drafts/{id}")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Replace an announcement draft's content (communications.announcements:edit; expected_version required)")
    public DraftDTOs.AnnouncementDraft updateAnnouncement(@PathVariable String id,
            @RequestBody(required = false) DraftDTOs.AnnouncementDraftRequest body, HttpServletRequest request) {
        return announcements.update(AuthPrincipal.require(request), id, body, ClientAddress.of(request));
    }

    @DeleteMapping("/v1/operator/announcement-drafts/{id}")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Delete an announcement draft (communications.announcements:delete; ?expectedVersion= required)")
    public ResponseEntity<Void> deleteAnnouncement(@PathVariable String id,
            @RequestParam(required = false) Long expectedVersion, HttpServletRequest request) {
        announcements.delete(AuthPrincipal.require(request), id, expectedVersion, ClientAddress.of(request));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/v1/operator/announcement-drafts/{id}/submit")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Submit for Super Admin review -> PENDING_REVIEW (communications.announcements:edit; body expected_version)")
    public DraftDTOs.AnnouncementDraft submitAnnouncement(@PathVariable String id,
            @RequestBody(required = false) AdminRequests.VersionRequest body, HttpServletRequest request) {
        return announcements.submit(AuthPrincipal.require(request), id, AdminRequests.expected(body), ClientAddress.of(request));
    }

    @PostMapping("/v1/admin/announcements/{id}/request-changes")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Super Admin: send a PENDING_REVIEW operator draft back -> CHANGES_REQUESTED (body expected_version, reviewer_note)")
    public DraftDTOs.AnnouncementDraft requestAnnouncementChanges(@PathVariable String id,
            @RequestBody(required = false) DraftDTOs.ReviewRequest body, HttpServletRequest request) {
        return announcements.requestChanges(AuthPrincipal.require(request), id, body, ClientAddress.of(request));
    }

    // ---------------------------------------------------------------- email drafts

    @GetMapping("/v1/operator/email-drafts")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "List email drafts (communications.email_drafts:view)")
    public ConsoleDTOs.Page<DraftDTOs.EmailDraft> listEmails(
            @RequestParam(required = false) String status, @RequestParam(required = false) String search,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size,
            HttpServletRequest request) {
        return emails.list(AuthPrincipal.require(request), status, search, page, size);
    }

    @GetMapping("/v1/operator/email-drafts/{id}")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Get one email draft")
    public DraftDTOs.EmailDraft getEmail(@PathVariable String id, HttpServletRequest request) {
        return emails.get(AuthPrincipal.require(request), id);
    }

    @PostMapping("/v1/operator/email-drafts")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Create an email draft (communications.email_drafts:create); unsafe HTML = 400 field_errors")
    public ResponseEntity<DraftDTOs.EmailDraft> createEmail(@RequestBody(required = false) DraftDTOs.EmailDraftRequest body,
            HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(emails.create(AuthPrincipal.require(request), body, ClientAddress.of(request)));
    }

    @PutMapping("/v1/operator/email-drafts/{id}")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Replace an email draft's content (communications.email_drafts:edit; expected_version required)")
    public DraftDTOs.EmailDraft updateEmail(@PathVariable String id,
            @RequestBody(required = false) DraftDTOs.EmailDraftRequest body, HttpServletRequest request) {
        return emails.update(AuthPrincipal.require(request), id, body, ClientAddress.of(request));
    }

    @DeleteMapping("/v1/operator/email-drafts/{id}")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Delete an email draft (communications.email_drafts:delete; ?expectedVersion= required)")
    public ResponseEntity<Void> deleteEmail(@PathVariable String id, @RequestParam(required = false) Long expectedVersion,
            HttpServletRequest request) {
        emails.delete(AuthPrincipal.require(request), id, expectedVersion, ClientAddress.of(request));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/v1/operator/email-drafts/{id}/submit")
    @PreAuthorize(OPERATOR)
    @Operation(summary = "Submit for Super Admin review -> SUBMITTED (communications.email_drafts:execute; body expected_version)")
    public DraftDTOs.EmailDraft submitEmail(@PathVariable String id,
            @RequestBody(required = false) AdminRequests.VersionRequest body, HttpServletRequest request) {
        return emails.submit(AuthPrincipal.require(request), id, AdminRequests.expected(body), ClientAddress.of(request));
    }

    @GetMapping("/v1/admin/email-drafts")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Super Admin: list operator email drafts")
    public ConsoleDTOs.Page<DraftDTOs.EmailDraft> adminListEmails(
            @RequestParam(required = false) String status, @RequestParam(required = false) String search,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size,
            HttpServletRequest request) {
        return emails.list(AuthPrincipal.require(request), status, search, page, size);
    }

    @PostMapping("/v1/admin/email-drafts/{id}/approve")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Super Admin: approve a SUBMITTED email draft (sends nothing; body expected_version, reviewer_note)")
    public DraftDTOs.EmailDraft approveEmail(@PathVariable String id, @RequestBody(required = false) DraftDTOs.ReviewRequest body,
            HttpServletRequest request) {
        return emails.review(AuthPrincipal.require(request), id, true, body, ClientAddress.of(request));
    }

    @PostMapping("/v1/admin/email-drafts/{id}/reject")
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN')")
    @Operation(summary = "Super Admin: reject a SUBMITTED email draft back to its author (body expected_version, reviewer_note)")
    public DraftDTOs.EmailDraft rejectEmail(@PathVariable String id, @RequestBody(required = false) DraftDTOs.ReviewRequest body,
            HttpServletRequest request) {
        return emails.review(AuthPrincipal.require(request), id, false, body, ClientAddress.of(request));
    }
}
