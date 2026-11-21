package com.prowise.org;

import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Task 1.2: invitations of one organization (member.invite). Responses never contain the token. */
@RestController
@RequestMapping("/v1/organizations/{orgId}/invitations")
public class InvitationController {

    private final InvitationService invitations;

    public InvitationController(InvitationService invitations) {
        this.invitations = invitations;
    }

    @GetMapping
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'member.invite')")
    List<InvitationService.InvitationResponse> list(@PathVariable UUID orgId,
            @RequestParam(required = false) String status, Authentication authentication) {
        return invitations.list(orgId, authentication, status);
    }

    @GetMapping("/{invitationId}")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'member.invite')")
    InvitationService.InvitationResponse get(@PathVariable UUID orgId, @PathVariable UUID invitationId,
            Authentication authentication) {
        return invitations.get(orgId, invitationId, authentication);
    }

    @PostMapping
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'member.invite')")
    ResponseEntity<InvitationService.InvitationResponse> create(@PathVariable UUID orgId, Authentication authentication,
            @RequestBody InvitationService.CreateInvitationRequest request) {
        return ResponseEntity.status(201).body(invitations.create(orgId, authentication, request));
    }

    @PostMapping("/{invitationId}/resend")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'member.invite')")
    InvitationService.InvitationResponse resend(@PathVariable UUID orgId, @PathVariable UUID invitationId,
            Authentication authentication, @RequestBody InvitationService.VersionRequest request) {
        return invitations.resend(orgId, invitationId, authentication, request);
    }

    @PostMapping("/{invitationId}/revoke")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'member.invite')")
    InvitationService.InvitationResponse revoke(@PathVariable UUID orgId, @PathVariable UUID invitationId,
            Authentication authentication, @RequestBody InvitationService.VersionRequest request) {
        return invitations.revoke(orgId, invitationId, authentication, request);
    }
}
