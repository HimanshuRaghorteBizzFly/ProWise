package com.prowise.superadmin.subscriptions;

import java.util.List;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.superadmin.common.AdminRequests;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping
@Tag(name = "Super Admin Subscriptions", description = "Tenant subscriptions. Mutations need expected_version (409 STALE_VERSION when stale) and accept Idempotency-Key.")
public class SubscriptionController {

    private final SubscriptionService subscriptionService;

    public SubscriptionController(SubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }

    @GetMapping({"/v1/admin/subscriptions", "/api/v1/admin/subscriptions"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('subscriptions.manage')")
    @Operation(summary = "List subscriptions")
    public List<SubscriptionDTOs.SubscriptionResponse> listSubscriptions(
            @RequestParam(required = false) String planId,
            @RequestParam(required = false) String status
    ) {
        return subscriptionService.listSubscriptions(planId, status);
    }

    @GetMapping({"/v1/admin/subscriptions/{id}", "/api/v1/admin/subscriptions/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('subscriptions.manage')")
    @Operation(summary = "Get one subscription")
    public SubscriptionDTOs.SubscriptionResponse getSubscription(@PathVariable String id) {
        return subscriptionService.getSubscription(id);
    }

    @PostMapping({"/v1/admin/subscriptions", "/api/v1/admin/subscriptions"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('subscriptions.manage')")
    @Operation(summary = "Assign a plan to an organization")
    public ResponseEntity<SubscriptionDTOs.SubscriptionResponse> assignSubscription(
            HttpServletRequest http,
            @RequestBody SubscriptionDTOs.AssignSubscriptionRequest request
    ) {
        SubscriptionDTOs.SubscriptionResponse assigned = subscriptionService.assignSubscription(request, AdminRequests.actor(http));
        return ResponseEntity.status(HttpStatus.CREATED).body(assigned);
    }

    @PatchMapping({"/v1/admin/subscriptions/{id}", "/api/v1/admin/subscriptions/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('subscriptions.manage')")
    @Operation(summary = "Update a subscription (expected_version required)")
    public SubscriptionDTOs.SubscriptionResponse updateSubscription(
            HttpServletRequest http,
            @PathVariable String id,
            @RequestBody SubscriptionDTOs.UpdateSubscriptionRequest request
    ) {
        return subscriptionService.updateSubscription(id, request, AdminRequests.actor(http));
    }

    @PostMapping({"/v1/admin/subscriptions/{id}/renew", "/api/v1/admin/subscriptions/{id}/renew"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('subscriptions.manage')")
    @Operation(summary = "Renew for one more billing period (body: expected_version)")
    public SubscriptionDTOs.SubscriptionResponse renewSubscription(
            HttpServletRequest http,
            @PathVariable String id,
            @RequestBody(required = false) AdminRequests.VersionRequest body
    ) {
        return subscriptionService.renewSubscription(id, com.prowise.superadmin.common.AdminRequests.expected(body), AdminRequests.actor(http));
    }

    @PostMapping({"/v1/admin/subscriptions/{id}/cancel", "/api/v1/admin/subscriptions/{id}/cancel"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('subscriptions.manage')")
    @Operation(summary = "Cancel now (immediate=true) or at period end (body: expected_version, optional immediate)")
    public SubscriptionDTOs.SubscriptionResponse cancelSubscription(
            HttpServletRequest http,
            @PathVariable String id,
            @RequestParam(required = false) Boolean immediate,
            @RequestBody(required = false) SubscriptionDTOs.CancelSubscriptionRequest body
    ) {
        boolean now = (body != null && Boolean.TRUE.equals(body.immediate())) || Boolean.TRUE.equals(immediate);
        return subscriptionService.cancelSubscription(id, now, body != null ? body.expectedVersion() : null, AdminRequests.actor(http));
    }

    @PostMapping({"/v1/admin/subscriptions/{id}/reactivate", "/api/v1/admin/subscriptions/{id}/reactivate"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('subscriptions.manage')")
    @Operation(summary = "Reactivate a cancelled subscription (body: expected_version)")
    public SubscriptionDTOs.SubscriptionResponse reactivateSubscription(
            HttpServletRequest http,
            @PathVariable String id,
            @RequestBody(required = false) AdminRequests.VersionRequest body
    ) {
        return subscriptionService.reactivateSubscription(id, com.prowise.superadmin.common.AdminRequests.expected(body), AdminRequests.actor(http));
    }

    @DeleteMapping({"/v1/admin/subscriptions/{id}", "/api/v1/admin/subscriptions/{id}"})
    @PreAuthorize("hasAuthority('PLATFORM_SUPER_ADMIN') or hasAuthority('subscriptions.manage')")
    @Operation(summary = "Delete a subscription (?expectedVersion= required)")
    public ResponseEntity<Void> deleteSubscription(
            HttpServletRequest http,
            @PathVariable String id,
            @RequestParam(required = false) Long expectedVersion
    ) {
        subscriptionService.deleteSubscription(id, expectedVersion, AdminRequests.actor(http));
        return ResponseEntity.noContent().build();
    }
}
