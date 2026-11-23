package com.prowise.org;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Task 1.2: the invitee side. Identity-level (the invitee has no membership yet): any signed-in user may try,
 * and the service accepts only a valid, pending, unexpired token for their own email. The token travels in the
 * body, never in the URL.
 */
@RestController
@RequestMapping("/v1/invitations")
public class InvitationAcceptController {

    private final InvitationService invitations;

    public InvitationAcceptController(InvitationService invitations) {
        this.invitations = invitations;
    }

    @PostMapping("/preview")
    @PreAuthorize("isAuthenticated()")
    InvitationService.InvitationPreview preview(Authentication authentication,
            @RequestBody InvitationService.TokenRequest request) {
        return invitations.preview(authentication, request);
    }

    /** Opened from the emailed link before signing in: what the invitation is for. Invalid links are a 404. */
    @PostMapping("/public-preview")
    @PreAuthorize("permitAll()")
    InvitationService.PublicInvitationPreview publicPreview(@RequestBody InvitationService.TokenRequest request) {
        return invitations.publicPreview(request);
    }

    /** A new person creates their account from the single-use link with their own password, and joins. */
    @PostMapping("/activate")
    @PreAuthorize("permitAll()")
    InvitationService.AcceptResponse activate(@RequestBody InvitationService.ActivateRequest request) {
        return invitations.activate(request);
    }

    @PostMapping("/accept")
    @PreAuthorize("isAuthenticated()")
    InvitationService.AcceptResponse accept(Authentication authentication,
            @RequestBody InvitationService.TokenRequest request) {
        return invitations.accept(authentication, request);
    }
}
