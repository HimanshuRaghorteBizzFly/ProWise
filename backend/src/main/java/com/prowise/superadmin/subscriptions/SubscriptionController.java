package com.prowise.superadmin.subscriptions;

import java.util.List;
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

@RestController
@RequestMapping
public class SubscriptionController {

    private final SubscriptionService subscriptionService;

    public SubscriptionController(SubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }

    @GetMapping({"/v1/admin/subscriptions", "/api/v1/admin/subscriptions"})
    @PreAuthorize("isAuthenticated()")
    public List<SubscriptionDTOs.SubscriptionResponse> listSubscriptions(
            @RequestParam(required = false) String planId,
            @RequestParam(required = false) String status
    ) {
        return subscriptionService.listSubscriptions(planId, status);
    }

    @GetMapping({"/v1/admin/subscriptions/{id}", "/api/v1/admin/subscriptions/{id}"})
    @PreAuthorize("isAuthenticated()")
    public SubscriptionDTOs.SubscriptionResponse getSubscription(@PathVariable String id) {
        return subscriptionService.getSubscription(id);
    }

    @PostMapping({"/v1/admin/subscriptions", "/api/v1/admin/subscriptions"})
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<SubscriptionDTOs.SubscriptionResponse> assignSubscription(
            @RequestBody SubscriptionDTOs.AssignSubscriptionRequest request
    ) {
        SubscriptionDTOs.SubscriptionResponse assigned = subscriptionService.assignSubscription(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(assigned);
    }

    @PatchMapping({"/v1/admin/subscriptions/{id}", "/api/v1/admin/subscriptions/{id}"})
    @PreAuthorize("isAuthenticated()")
    public SubscriptionDTOs.SubscriptionResponse updateSubscription(
            @PathVariable String id,
            @RequestBody SubscriptionDTOs.UpdateSubscriptionRequest request
    ) {
        return subscriptionService.updateSubscription(id, request);
    }

    @PostMapping({"/v1/admin/subscriptions/{id}/renew", "/api/v1/admin/subscriptions/{id}/renew"})
    @PreAuthorize("isAuthenticated()")
    public SubscriptionDTOs.SubscriptionResponse renewSubscription(@PathVariable String id) {
        return subscriptionService.renewSubscription(id);
    }

    @PostMapping({"/v1/admin/subscriptions/{id}/cancel", "/api/v1/admin/subscriptions/{id}/cancel"})
    @PreAuthorize("isAuthenticated()")
    public SubscriptionDTOs.SubscriptionResponse cancelSubscription(
            @PathVariable String id,
            @RequestParam(required = false, defaultValue = "false") boolean immediate
    ) {
        return subscriptionService.cancelSubscription(id, immediate);
    }

    @PostMapping({"/v1/admin/subscriptions/{id}/reactivate", "/api/v1/admin/subscriptions/{id}/reactivate"})
    @PreAuthorize("isAuthenticated()")
    public SubscriptionDTOs.SubscriptionResponse reactivateSubscription(@PathVariable String id) {
        return subscriptionService.reactivateSubscription(id);
    }

    @DeleteMapping({"/v1/admin/subscriptions/{id}", "/api/v1/admin/subscriptions/{id}"})
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> deleteSubscription(@PathVariable String id) {
        subscriptionService.deleteSubscription(id);
        return ResponseEntity.noContent().build();
    }
}
