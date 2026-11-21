package com.prowise.org;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Member status with departure handover (1.4 + 1.2), member role change (1.2) and handover items.
 * The read-only member list stays on GET /v1/organizations/{org}/members (RoleController).
 */
@RestController
@RequestMapping("/v1/organizations/{orgId}")
public class MembershipController {

    private final MembershipService memberships;

    public MembershipController(MembershipService memberships) {
        this.memberships = memberships;
    }

    @PatchMapping("/members/{membershipId}/status")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'member.disable')")
    MembershipService.MemberStatusResponse changeStatus(
            @PathVariable UUID orgId,
            @PathVariable UUID membershipId,
            Authentication authentication,
            @RequestBody MembershipService.MemberStatusRequest request) {
        return memberships.changeStatus(orgId, membershipId, authentication, request);
    }

    @PatchMapping("/members/{membershipId}/role")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'role.manage')")
    MembershipService.MemberStatusResponse changeRole(
            @PathVariable UUID orgId,
            @PathVariable UUID membershipId,
            Authentication authentication,
            @RequestBody MembershipService.MemberRoleRequest request) {
        return memberships.changeRole(orgId, membershipId, authentication, request);
    }

    @GetMapping("/members/{membershipId}/ownership")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'member.disable')")
    MembershipService.MemberOwnershipResponse ownership(@PathVariable UUID orgId, @PathVariable UUID membershipId,
            Authentication authentication) {
        return memberships.ownership(orgId, membershipId, authentication);
    }

    @GetMapping("/handover-items")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'member.disable')")
    List<MembershipService.HandoverItem> handoverItems(@PathVariable UUID orgId,
            @RequestParam(required = false) String status, Authentication authentication) {
        return memberships.handoverItems(orgId, authentication, status);
    }

    @PostMapping("/handover-items/{itemId}/resolve")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'member.disable')")
    MembershipService.HandoverItem resolveHandover(@PathVariable UUID orgId, @PathVariable UUID itemId,
            Authentication authentication, @RequestBody MembershipService.ResolveHandoverRequest request) {
        return memberships.resolveHandover(orgId, itemId, authentication, request);
    }
}
