package com.prowise.delivery;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.prowise.developer.DeveloperAccess;
import com.prowise.developer.DeveloperAccess.Actor;
import com.prowise.delivery.DeliveryDTOs.*;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping
@Tag(name = "Project Delivery & Lifecycle", description = "Endpoints for Delivery Acceptance, Reviewer Decisions, Blockers & Waivers, Project Closure, and Lifecycle State Machine")
public class DeliveryLifecycleController {

    private static final String MEMBER = "@permissionService.tokenOrgMember(authentication)";

    private final DeliveryLifecycleService deliveryService;
    private final DeveloperAccess access;

    public DeliveryLifecycleController(DeliveryLifecycleService deliveryService, DeveloperAccess access) {
        this.deliveryService = deliveryService;
        this.access = access;
    }

    private Actor actor(Authentication auth) {
        return access.actor(auth);
    }

    // 1. Request Delivery Acceptance (T15, AS-02)
    @PostMapping({"/v1/projects/{projectId}/acceptance-requests", "/api/v1/projects/{projectId}/acceptance-requests"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Submit delivery acceptance request with checklist and evidence (100% progress required)")
    public ResponseEntity<AcceptanceRequestResponse> requestAcceptance(
            @PathVariable String projectId,
            @Valid @RequestBody AcceptanceSubmissionRequest request,
            Authentication auth) {
        AcceptanceRequestResponse res = deliveryService.requestAcceptance(actor(auth), projectId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    // 2. Get Acceptance Requests for a Project
    @GetMapping({"/v1/projects/{projectId}/acceptance-requests", "/api/v1/projects/{projectId}/acceptance-requests"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get delivery acceptance requests and their decisions for a project")
    public List<AcceptanceRequestResponse> getAcceptanceRequests(
            @PathVariable String projectId,
            Authentication auth) {
        return deliveryService.getAcceptanceRequests(actor(auth), projectId);
    }

    // 3. Reviewer Decision on Acceptance Request (T15, AS-02)
    @PostMapping({"/v1/acceptance-requests/{requestId}/decisions", "/api/v1/acceptance-requests/{requestId}/decisions"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Reviewer decision (ACCEPTED, REJECTED, CHANGES_REQUESTED) on delivery acceptance request")
    public ResponseEntity<AcceptanceDecisionResponse> decideAcceptance(
            @PathVariable String requestId,
            @Valid @RequestBody AcceptanceDecisionRequest request,
            Authentication auth) {
        AcceptanceDecisionResponse res = deliveryService.decideAcceptance(actor(auth), requestId, request);
        return ResponseEntity.ok(res);
    }

    // 4. Close Delivered Project (AS-02)
    @PostMapping({"/v1/projects/{projectId}/close", "/api/v1/projects/{projectId}/close"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Authorized closure of a delivered project with handover note and reason")
    public ResponseEntity<ProjectClosureResponse> closeProject(
            @PathVariable String projectId,
            @Valid @RequestBody CloseProjectRequest request,
            Authentication auth) {
        ProjectClosureResponse res = deliveryService.closeProject(actor(auth), projectId, request);
        return ResponseEntity.ok(res);
    }

    // 5. Reopen Closed/Delivered Project
    @PostMapping({"/v1/projects/{projectId}/reopen", "/api/v1/projects/{projectId}/reopen"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Reopen a closed or delivered project back to ACTIVE")
    public ResponseEntity<ProjectDeliveryStatusResponse> reopenProject(
            @PathVariable String projectId,
            @Valid @RequestBody ReopenProjectRequest request,
            Authentication auth) {
        ProjectDeliveryStatusResponse res = deliveryService.reopenProject(actor(auth), projectId, request);
        return ResponseEntity.ok(res);
    }

    // 6. Transition Lifecycle (e.g. ON_HOLD / ACTIVE)
    @PostMapping({"/v1/projects/{projectId}/lifecycle", "/api/v1/projects/{projectId}/lifecycle"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Transition project lifecycle state (e.g. ACTIVE <-> ON_HOLD)")
    public ResponseEntity<ProjectDeliveryStatusResponse> transitionLifecycle(
            @PathVariable String projectId,
            @Valid @RequestBody TransitionLifecycleRequest request,
            Authentication auth) {
        ProjectDeliveryStatusResponse res = deliveryService.transitionLifecycle(actor(auth), projectId, request);
        return ResponseEntity.ok(res);
    }

    // 7. Get Project Delivery Status & Overview
    @GetMapping({"/v1/projects/{projectId}/delivery-status", "/api/v1/projects/{projectId}/delivery-status"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get project delivery lifecycle status, blocker counts, and allowed action flags")
    public ResponseEntity<ProjectDeliveryStatusResponse> getDeliveryStatus(
            @PathVariable String projectId,
            Authentication auth) {
        ProjectDeliveryStatusResponse res = deliveryService.getDeliveryStatus(actor(auth), projectId);
        return ResponseEntity.ok(res);
    }

    // 8. Create Blocker
    @PostMapping({"/v1/projects/{projectId}/blockers", "/api/v1/projects/{projectId}/blockers"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Report a blocker for a project")
    public ResponseEntity<ProjectBlockerResponse> createBlocker(
            @PathVariable String projectId,
            @Valid @RequestBody CreateBlockerRequest request,
            Authentication auth) {
        ProjectBlockerResponse res = deliveryService.createBlocker(actor(auth), projectId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(res);
    }

    // 9. Get Blockers
    @GetMapping({"/v1/projects/{projectId}/blockers", "/api/v1/projects/{projectId}/blockers"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get list of blockers with their waivers")
    public List<ProjectBlockerResponse> getBlockers(
            @PathVariable String projectId,
            Authentication auth) {
        return deliveryService.getBlockers(actor(auth), projectId);
    }

    // 10. Waive Blocker
    @PostMapping({"/v1/projects/{projectId}/blockers/{blockerId}/waiver", "/api/v1/projects/{projectId}/blockers/{blockerId}/waiver"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Approve a named waiver for a blocker")
    public ResponseEntity<ProjectBlockerResponse> waiveBlocker(
            @PathVariable String projectId,
            @PathVariable String blockerId,
            @Valid @RequestBody CreateWaiverRequest request,
            Authentication auth) {
        ProjectBlockerResponse res = deliveryService.waiveBlocker(actor(auth), projectId, blockerId, request);
        return ResponseEntity.ok(res);
    }

    // 11. Resolve Blocker
    @PostMapping({"/v1/projects/{projectId}/blockers/{blockerId}/resolve", "/api/v1/projects/{projectId}/blockers/{blockerId}/resolve"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Resolve a blocker")
    public ResponseEntity<ProjectBlockerResponse> resolveBlocker(
            @PathVariable String projectId,
            @PathVariable String blockerId,
            Authentication auth) {
        ProjectBlockerResponse res = deliveryService.resolveBlocker(actor(auth), projectId, blockerId);
        return ResponseEntity.ok(res);
    }

    // 12. Get Lifecycle History
    @GetMapping({"/v1/projects/{projectId}/lifecycle-history", "/api/v1/projects/{projectId}/lifecycle-history"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get audit history of lifecycle state transitions")
    public List<ProjectLifecycleHistoryResponse> getLifecycleHistory(
            @PathVariable String projectId,
            Authentication auth) {
        return deliveryService.getLifecycleHistory(actor(auth), projectId);
    }

    // 13. Get Closures
    @GetMapping({"/v1/projects/{projectId}/closures", "/api/v1/projects/{projectId}/closures"})
    @PreAuthorize(MEMBER)
    @Operation(summary = "Get closure records for a project")
    public List<ProjectClosureResponse> getClosures(
            @PathVariable String projectId,
            Authentication auth) {
        return deliveryService.getClosures(actor(auth), projectId);
    }
}
