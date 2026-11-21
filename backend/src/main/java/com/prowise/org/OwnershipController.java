package com.prowise.org;

import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Task 1.2: ownership transfer. org.manage at the route; the service also requires the caller to be THE owner. */
@RestController
@RequestMapping("/v1/organizations/{orgId}/ownership")
public class OwnershipController {

    private final OwnershipService ownership;

    public OwnershipController(OwnershipService ownership) {
        this.ownership = ownership;
    }

    @GetMapping
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'org.manage')")
    OwnershipService.OwnershipResponse current(@PathVariable UUID orgId, Authentication authentication) {
        return ownership.current(orgId, authentication);
    }

    @PostMapping("/transfer")
    @PreAuthorize("@permissionService.authorize(authentication, #orgId, 'org.manage')")
    OwnershipService.TransferResponse transfer(@PathVariable UUID orgId, Authentication authentication,
            @RequestBody OwnershipService.TransferRequest request) {
        return ownership.transfer(orgId, authentication, request);
    }
}
