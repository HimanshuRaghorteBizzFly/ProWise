package com.prowise.delivery;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.common.api.ApiException;
import com.prowise.common.audit.ChangeRecorder;
import com.prowise.developer.DeveloperAccess;
import com.prowise.developer.DeveloperAccess.Actor;
import com.prowise.developer.ProjectCheckInEntity;
import com.prowise.developer.ProjectCheckInRepository;
import com.prowise.developer.ProjectEntity;
import com.prowise.developer.ProjectRepository;

@Service
public class DeliveryLifecycleService {

    private static final Logger log = LoggerFactory.getLogger(DeliveryLifecycleService.class);

    private final ProjectRepository projectRepository;
    private final ProjectCheckInRepository checkInRepository;
    private final AcceptanceRequestRepository acceptanceRequestRepository;
    private final AcceptanceDecisionRepository acceptanceDecisionRepository;
    private final ProjectBlockerRepository blockerRepository;
    private final ProjectBlockerWaiverRepository waiverRepository;
    private final ProjectClosureRepository closureRepository;
    private final ProjectLifecycleHistoryRepository lifecycleHistoryRepository;
    private final DeveloperAccess access;
    private final ChangeRecorder changeRecorder;
    private final ObjectMapper objectMapper;

    public DeliveryLifecycleService(
            ProjectRepository projectRepository,
            ProjectCheckInRepository checkInRepository,
            AcceptanceRequestRepository acceptanceRequestRepository,
            AcceptanceDecisionRepository acceptanceDecisionRepository,
            ProjectBlockerRepository blockerRepository,
            ProjectBlockerWaiverRepository waiverRepository,
            ProjectClosureRepository closureRepository,
            ProjectLifecycleHistoryRepository lifecycleHistoryRepository,
            DeveloperAccess access,
            ChangeRecorder changeRecorder,
            ObjectMapper objectMapper) {
        this.projectRepository = projectRepository;
        this.checkInRepository = checkInRepository;
        this.acceptanceRequestRepository = acceptanceRequestRepository;
        this.acceptanceDecisionRepository = acceptanceDecisionRepository;
        this.blockerRepository = blockerRepository;
        this.waiverRepository = waiverRepository;
        this.closureRepository = closureRepository;
        this.lifecycleHistoryRepository = lifecycleHistoryRepository;
        this.access = access;
        this.changeRecorder = changeRecorder;
        this.objectMapper = objectMapper;
    }

    // =========================================================================
    // 1. REQUEST DELIVERY ACCEPTANCE
    // =========================================================================
    @Transactional
    public DeliveryDTOs.AcceptanceRequestResponse requestAcceptance(
            Actor actor,
            String projectId,
            DeliveryDTOs.AcceptanceSubmissionRequest req) {

        ProjectEntity project = findVisibleProject(actor, projectId);

        // Rule: cannot perform actions on archived project
        if (project.isArchived()) {
            throw new ApiException(HttpStatus.CONFLICT, "PROJECT_ARCHIVED",
                    "Actions cannot be performed on an archived project. Restore it first.");
        }

        // Rule: Project must be in ACTIVE state to request acceptance
        if (!"ACTIVE".equalsIgnoreCase(project.getLifecycle())) {
            if ("AWAITING_ACCEPTANCE".equalsIgnoreCase(project.getLifecycle())) {
                throw new ApiException(HttpStatus.CONFLICT, "ACCEPTANCE_ALREADY_PENDING",
                        "Delivery acceptance is already pending review for this project.");
            }
            if ("DELIVERED".equalsIgnoreCase(project.getLifecycle()) || "CLOSED".equalsIgnoreCase(project.getLifecycle())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "ALREADY_DELIVERED",
                        "Project is already in " + project.getLifecycle() + " state.");
            }
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_LIFECYCLE_STATE",
                    "Delivery acceptance can only be requested for ACTIVE projects. Current: " + project.getLifecycle());
        }

        // Rule: Progress must be 100%
        if (project.getLastProgressPercent() == null
                || project.getLastProgressPercent().compareTo(BigDecimal.valueOf(100)) < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INCOMPLETE_PROGRESS",
                    "Delivery acceptance requires 100% progress. Current recorded progress is "
                            + (project.getLastProgressPercent() != null ? project.getLastProgressPercent() : "0") + "%.");
        }

        // Validate bound check-in if provided
        if (req.boundCheckinId() != null && !req.boundCheckinId().isBlank()) {
            ProjectCheckInEntity checkin = checkInRepository.findByIdAndOrgId(req.boundCheckinId().trim(), actor.orgId())
                    .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CHECKIN", "Specified check-in was not found."));
            if (!project.getId().equals(checkin.getProjectId())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CHECKIN", "Specified check-in does not belong to this project.");
            }
            if (checkin.getPercent() == null || checkin.getPercent().compareTo(BigDecimal.valueOf(100)) < 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CHECKIN_PERCENT", "Bound check-in must report 100% progress.");
            }
        }

        Instant now = Instant.now();
        String reqId = "accreq-" + UUID.randomUUID().toString().substring(0, 8);

        AcceptanceRequestEntity entity = new AcceptanceRequestEntity();
        entity.setId(reqId);
        entity.setOrgId(actor.orgId());
        entity.setProjectId(project.getId());
        entity.setBoundCheckinId(req.boundCheckinId() != null ? req.boundCheckinId().trim() : null);
        entity.setChecklist(toJson(req.checklist() != null ? req.checklist() : List.of()));
        entity.setEvidenceSummary(req.evidenceSummary() != null ? req.evidenceSummary().trim() : null);
        entity.setEvidenceItems(toJson(req.evidenceItems() != null ? req.evidenceItems() : List.of()));
        entity.setStatus("PENDING");
        entity.setCreatedBy(actor.userId());
        entity.setCreatedByName(actor.principal().email() != null ? actor.principal().email() : actor.userId());
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        AcceptanceRequestEntity saved = acceptanceRequestRepository.save(entity);

        // Transition project lifecycle to AWAITING_ACCEPTANCE
        String prevLifecycle = project.getLifecycle();
        project.setLifecycle("AWAITING_ACCEPTANCE");
        project.setStatus("AWAITING_ACCEPTANCE");
        project.setUpdatedAt(now);
        projectRepository.save(project);

        // Record lifecycle transition
        ProjectLifecycleHistoryEntity history = new ProjectLifecycleHistoryEntity();
        history.setId("lh-" + UUID.randomUUID().toString().substring(0, 8));
        history.setOrgId(actor.orgId());
        history.setProjectId(project.getId());
        history.setPreviousLifecycle(prevLifecycle);
        history.setNewLifecycle("AWAITING_ACCEPTANCE");
        history.setReason("Delivery acceptance requested by developer");
        history.setActorId(actor.userId());
        history.setActorName(actor.principal().email() != null ? actor.principal().email() : actor.userId());
        history.setCreatedAt(now);
        lifecycleHistoryRepository.save(history);

        // Audit & outbox
        Map<String, Object> meta = new HashMap<>();
        meta.put("project_id", project.getId());
        meta.put("acceptance_request_id", saved.getId());
        meta.put("bound_checkin_id", saved.getBoundCheckinId());
        changeRecorder.recordChange(
                actor.orgId(),
                tryParseUuid(actor.userId()),
                "delivery.acceptance.requested",
                "PROJECT",
                project.getId(),
                meta,
                "Project",
                project.getId(),
                "DeliveryAcceptanceRequestedEvent",
                project.getVersion(),
                meta
        );

        return toAcceptanceRequestResponse(saved, List.of());
    }

    // =========================================================================
    // 2. DECIDE DELIVERY ACCEPTANCE (APPROVE / REJECT / REQUEST_CHANGES)
    // =========================================================================
    @Transactional
    public DeliveryDTOs.AcceptanceDecisionResponse decideAcceptance(
            Actor actor,
            String requestId,
            DeliveryDTOs.AcceptanceDecisionRequest req) {

        AcceptanceRequestEntity acceptanceReq = acceptanceRequestRepository.findByIdAndOrgId(requestId, actor.orgId())
                .orElseThrow(() -> access.notFound(actor, "ACCEPTANCE_REQUEST", requestId));

        ProjectEntity project = findVisibleProject(actor, acceptanceReq.getProjectId());

        // Rule: cannot perform actions on archived project
        if (project.isArchived()) {
            throw new ApiException(HttpStatus.CONFLICT, "PROJECT_ARCHIVED",
                    "Actions cannot be performed on an archived project. Restore it first.");
        }

        // Rule: Separation of duties (D04) - submitter and accountable dev cannot approve their own submission
        if (actor.userId().equals(acceptanceReq.getCreatedBy())) {
            log.warn("User {} attempted self-approval on acceptance request {}", actor.userId(), requestId);
            throw PermissionService.forbidden();
        }
        if (project.getAccountableDeveloperId() != null && actor.userId().equals(project.getAccountableDeveloperId())) {
            log.warn("Accountable developer {} attempted self-approval on acceptance request {}", actor.userId(), requestId);
            throw PermissionService.forbidden();
        }

        // Rule: Reviewer authorization check
        boolean canReview = access.can(actor, project.getId(), PermissionKey.PROJECT_EDIT)
                || access.can(actor, project.getId(), PermissionKey.PROJECT_PROGRESS_OVERRIDE)
                || access.can(actor, project.getId(), PermissionKey.TASK_REVIEW)
                || access.can(actor, project.getId(), PermissionKey.TEAM_MANAGE)
                || access.canAtOrg(actor, PermissionKey.ORG_MANAGE);

        if (!canReview) {
            log.warn("User {} lacks review permission for project {}", actor.userId(), project.getId());
            throw PermissionService.forbidden();
        }

        // Rule: Optimistic locking on project version
        if (req.expectedProjectVersion() == null || !req.expectedProjectVersion().equals(project.getVersion())) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_VERSION",
                    "Project version mismatch. The project was modified since the review began.");
        }

        // Rule: Must be in PENDING status
        if (!"PENDING".equalsIgnoreCase(acceptanceReq.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_DECIDED",
                    "This acceptance request has already been decided (status: " + acceptanceReq.getStatus() + ").");
        }

        String rawDecision = req.decision() != null ? req.decision().trim().toUpperCase(Locale.ROOT) : "";
        if (!List.of("ACCEPTED", "REJECTED", "CHANGES_REQUESTED").contains(rawDecision)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DECISION",
                    "Decision must be ACCEPTED, REJECTED, or CHANGES_REQUESTED.");
        }

        // Rule: Critical unwaived blockers prevent ACCEPTED decision
        if ("ACCEPTED".equals(rawDecision)) {
            List<ProjectBlockerEntity> criticalOpen = blockerRepository.findByOrgIdAndProjectIdAndStatusAndSeverity(
                    actor.orgId(), project.getId(), "OPEN", "CRITICAL");

            for (ProjectBlockerEntity blocker : criticalOpen) {
                Optional<ProjectBlockerWaiverEntity> waiver = waiverRepository.findByOrgIdAndProjectIdAndBlockerRef(
                        actor.orgId(), project.getId(), blocker.getId());
                if (waiver.isEmpty()) {
                    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "UNWAIVED_CRITICAL_BLOCKERS",
                            "Cannot accept delivery while critical blockers remain open without approved waivers. Blocker: "
                                    + blocker.getTitle());
                }
            }
        }

        Instant now = Instant.now();
        String decId = "accdec-" + UUID.randomUUID().toString().substring(0, 8);

        AcceptanceDecisionEntity decisionEntity = new AcceptanceDecisionEntity();
        decisionEntity.setId(decId);
        decisionEntity.setOrgId(actor.orgId());
        decisionEntity.setRequestId(acceptanceReq.getId());
        decisionEntity.setProjectId(project.getId());
        decisionEntity.setDecision(rawDecision);
        decisionEntity.setActorId(actor.userId());
        decisionEntity.setActorName(actor.principal().email() != null ? actor.principal().email() : actor.userId());
        decisionEntity.setReason(req.reason() != null ? req.reason().trim() : null);
        decisionEntity.setDecidedAt(now);

        AcceptanceDecisionEntity savedDecision = acceptanceDecisionRepository.save(decisionEntity);

        // Update acceptance request
        acceptanceReq.setStatus(rawDecision);
        acceptanceReq.setUpdatedAt(now);
        acceptanceRequestRepository.save(acceptanceReq);

        // Transition project lifecycle
        String prevLifecycle = project.getLifecycle();
        String nextLifecycle = "ACCEPTED".equals(rawDecision) ? "DELIVERED" : "ACTIVE";
        project.setLifecycle(nextLifecycle);
        project.setStatus(nextLifecycle);
        project.setUpdatedAt(now);
        projectRepository.save(project);

        // Record lifecycle transition
        ProjectLifecycleHistoryEntity history = new ProjectLifecycleHistoryEntity();
        history.setId("lh-" + UUID.randomUUID().toString().substring(0, 8));
        history.setOrgId(actor.orgId());
        history.setProjectId(project.getId());
        history.setPreviousLifecycle(prevLifecycle);
        history.setNewLifecycle(nextLifecycle);
        history.setReason(req.reason() != null ? req.reason().trim() : ("Delivery " + rawDecision.toLowerCase(Locale.ROOT)));
        history.setActorId(actor.userId());
        history.setActorName(actor.principal().email() != null ? actor.principal().email() : actor.userId());
        history.setCreatedAt(now);
        lifecycleHistoryRepository.save(history);

        // Audit & outbox
        Map<String, Object> meta = new HashMap<>();
        meta.put("project_id", project.getId());
        meta.put("acceptance_request_id", acceptanceReq.getId());
        meta.put("decision", rawDecision);
        meta.put("reason", req.reason());
        changeRecorder.recordChange(
                actor.orgId(),
                tryParseUuid(actor.userId()),
                "delivery.acceptance.decided",
                "PROJECT",
                project.getId(),
                meta,
                "Project",
                project.getId(),
                "DeliveryAcceptanceDecidedEvent",
                project.getVersion(),
                meta
        );

        return toAcceptanceDecisionResponse(savedDecision);
    }

    // =========================================================================
    // 3. CLOSE DELIVERED PROJECT
    // =========================================================================
    @Transactional
    public DeliveryDTOs.ProjectClosureResponse closeProject(
            Actor actor,
            String projectId,
            DeliveryDTOs.CloseProjectRequest req) {

        ProjectEntity project = findVisibleProject(actor, projectId);

        // Rule: cannot perform actions on archived project
        if (project.isArchived()) {
            throw new ApiException(HttpStatus.CONFLICT, "PROJECT_ARCHIVED",
                    "Actions cannot be performed on an archived project. Restore it first.");
        }

        // Rule: Closure authorization check (Manager / Team Lead / Org Owner)
        boolean canClose = access.canAtOrg(actor, PermissionKey.ORG_MANAGE)
                || access.can(actor, project.getId(), PermissionKey.TEAM_MANAGE)
                || (project.getProjectManagerId() != null && actor.userId().equals(project.getProjectManagerId()));
        if (!canClose) {
            throw PermissionService.forbidden();
        }

        // Rule: Project must be DELIVERED to be closed
        if (!"DELIVERED".equalsIgnoreCase(project.getLifecycle())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_LIFECYCLE_STATE",
                    "Only DELIVERED projects can be closed. Current lifecycle: " + project.getLifecycle());
        }

        // Rule: Optimistic locking
        if (req.expectedProjectVersion() == null || !req.expectedProjectVersion().equals(project.getVersion())) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_VERSION", "Project version mismatch.");
        }

        // Mandatory fields
        if (req.handoverNote() == null || req.handoverNote().trim().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MISSING_HANDOVER_NOTE",
                    "A handover note is required to close the project.");
        }
        if (req.reason() == null || req.reason().trim().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MISSING_CLOSURE_REASON",
                    "A closure reason is required to close the project.");
        }

        Instant now = Instant.now();
        String closureId = "closure-" + UUID.randomUUID().toString().substring(0, 8);

        ProjectClosureEntity closure = new ProjectClosureEntity();
        closure.setId(closureId);
        closure.setOrgId(actor.orgId());
        closure.setProjectId(project.getId());
        closure.setActorId(actor.userId());
        closure.setActorName(actor.principal().email() != null ? actor.principal().email() : actor.userId());
        closure.setHandoverNote(req.handoverNote().trim());
        closure.setReason(req.reason().trim());
        closure.setClosedAt(now);

        ProjectClosureEntity saved = closureRepository.save(closure);

        // Transition project lifecycle to CLOSED
        String prevLifecycle = project.getLifecycle();
        project.setLifecycle("CLOSED");
        project.setStatus("CLOSED");
        project.setUpdatedAt(now);
        projectRepository.save(project);

        // Record lifecycle transition
        ProjectLifecycleHistoryEntity history = new ProjectLifecycleHistoryEntity();
        history.setId("lh-" + UUID.randomUUID().toString().substring(0, 8));
        history.setOrgId(actor.orgId());
        history.setProjectId(project.getId());
        history.setPreviousLifecycle(prevLifecycle);
        history.setNewLifecycle("CLOSED");
        history.setReason(req.reason().trim());
        history.setActorId(actor.userId());
        history.setActorName(actor.principal().email() != null ? actor.principal().email() : actor.userId());
        history.setCreatedAt(now);
        lifecycleHistoryRepository.save(history);

        // Audit & outbox
        Map<String, Object> meta = new HashMap<>();
        meta.put("project_id", project.getId());
        meta.put("closure_id", saved.getId());
        meta.put("reason", req.reason());
        meta.put("handover_note", req.handoverNote());
        changeRecorder.recordChange(
                actor.orgId(),
                tryParseUuid(actor.userId()),
                "project.closed",
                "PROJECT",
                project.getId(),
                meta,
                "Project",
                project.getId(),
                "ProjectClosedEvent",
                project.getVersion(),
                meta
        );

        return toProjectClosureResponse(saved);
    }

    // =========================================================================
    // 4. REOPEN CLOSED / DELIVERED PROJECT
    // =========================================================================
    @Transactional
    public DeliveryDTOs.ProjectDeliveryStatusResponse reopenProject(
            Actor actor,
            String projectId,
            DeliveryDTOs.ReopenProjectRequest req) {

        ProjectEntity project = findVisibleProject(actor, projectId);

        if (project.isArchived()) {
            throw new ApiException(HttpStatus.CONFLICT, "PROJECT_ARCHIVED",
                    "Actions cannot be performed on an archived project. Restore it first.");
        }

        boolean canReopen = access.can(actor, project.getId(), PermissionKey.PROJECT_EDIT)
                || access.canAtOrg(actor, PermissionKey.ORG_MANAGE);
        if (!canReopen) {
            throw PermissionService.forbidden();
        }

        if (!"CLOSED".equalsIgnoreCase(project.getLifecycle()) && !"DELIVERED".equalsIgnoreCase(project.getLifecycle())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_LIFECYCLE_STATE",
                    "Only CLOSED or DELIVERED projects can be reopened. Current: " + project.getLifecycle());
        }

        if (req.expectedProjectVersion() == null || !req.expectedProjectVersion().equals(project.getVersion())) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_VERSION", "Project version mismatch.");
        }

        if (req.reason() == null || req.reason().trim().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MISSING_REOPEN_REASON",
                    "A reason is required to reopen the project.");
        }

        Instant now = Instant.now();
        String prevLifecycle = project.getLifecycle();
        project.setLifecycle("ACTIVE");
        project.setStatus("ACTIVE");
        project.setUpdatedAt(now);
        projectRepository.save(project);

        ProjectLifecycleHistoryEntity history = new ProjectLifecycleHistoryEntity();
        history.setId("lh-" + UUID.randomUUID().toString().substring(0, 8));
        history.setOrgId(actor.orgId());
        history.setProjectId(project.getId());
        history.setPreviousLifecycle(prevLifecycle);
        history.setNewLifecycle("ACTIVE");
        history.setReason(req.reason().trim());
        history.setActorId(actor.userId());
        history.setActorName(actor.principal().email() != null ? actor.principal().email() : actor.userId());
        history.setCreatedAt(now);
        lifecycleHistoryRepository.save(history);

        Map<String, Object> meta = new HashMap<>();
        meta.put("project_id", project.getId());
        meta.put("reason", req.reason());
        meta.put("previous_lifecycle", prevLifecycle);
        changeRecorder.recordChange(
                actor.orgId(),
                tryParseUuid(actor.userId()),
                "project.reopened",
                "PROJECT",
                project.getId(),
                meta,
                "Project",
                project.getId(),
                "ProjectReopenedEvent",
                project.getVersion(),
                meta
        );

        return getDeliveryStatus(actor, projectId);
    }

    // =========================================================================
    // 5. TRANSITION LIFECYCLE (E.G. ON_HOLD / ACTIVE)
    // =========================================================================
    @Transactional
    public DeliveryDTOs.ProjectDeliveryStatusResponse transitionLifecycle(
            Actor actor,
            String projectId,
            DeliveryDTOs.TransitionLifecycleRequest req) {

        ProjectEntity project = findVisibleProject(actor, projectId);

        if (project.isArchived()) {
            throw new ApiException(HttpStatus.CONFLICT, "PROJECT_ARCHIVED",
                    "Actions cannot be performed on an archived project. Restore it first.");
        }

        boolean canTransition = access.can(actor, project.getId(), PermissionKey.PROJECT_EDIT)
                || access.canAtOrg(actor, PermissionKey.ORG_MANAGE);
        if (!canTransition) {
            throw PermissionService.forbidden();
        }

        if (req.expectedProjectVersion() == null || !req.expectedProjectVersion().equals(project.getVersion())) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_VERSION", "Project version mismatch.");
        }

        String target = req.targetLifecycle() != null ? req.targetLifecycle().trim().toUpperCase(Locale.ROOT) : "";
        String current = project.getLifecycle();

        // Supported transitions: ACTIVE -> ON_HOLD, ON_HOLD -> ACTIVE
        if ("ON_HOLD".equals(target)) {
            if (!"ACTIVE".equalsIgnoreCase(current)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TRANSITION",
                        "Project can only transition to ON_HOLD from ACTIVE. Current: " + current);
            }
        } else if ("ACTIVE".equals(target)) {
            if (!"ON_HOLD".equalsIgnoreCase(current)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TRANSITION",
                        "Cannot transition to ACTIVE from " + current + " via this endpoint.");
            }
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TARGET_LIFECYCLE",
                    "Target lifecycle must be ON_HOLD or ACTIVE.");
        }

        if (req.reason() == null || req.reason().trim().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MISSING_TRANSITION_REASON",
                    "A reason is required to change project lifecycle.");
        }

        Instant now = Instant.now();
        project.setLifecycle(target);
        project.setStatus(target);
        project.setUpdatedAt(now);
        projectRepository.save(project);

        ProjectLifecycleHistoryEntity history = new ProjectLifecycleHistoryEntity();
        history.setId("lh-" + UUID.randomUUID().toString().substring(0, 8));
        history.setOrgId(actor.orgId());
        history.setProjectId(project.getId());
        history.setPreviousLifecycle(current);
        history.setNewLifecycle(target);
        history.setReason(req.reason().trim());
        history.setActorId(actor.userId());
        history.setActorName(actor.principal().email() != null ? actor.principal().email() : actor.userId());
        history.setCreatedAt(now);
        lifecycleHistoryRepository.save(history);

        Map<String, Object> meta = new HashMap<>();
        meta.put("project_id", project.getId());
        meta.put("previous_lifecycle", current);
        meta.put("new_lifecycle", target);
        meta.put("reason", req.reason().trim());
        changeRecorder.recordChange(
                actor.orgId(),
                tryParseUuid(actor.userId()),
                "project.lifecycle.changed",
                "PROJECT",
                project.getId(),
                meta,
                "Project",
                project.getId(),
                "ProjectLifecycleChangedEvent",
                project.getVersion(),
                meta
        );

        return getDeliveryStatus(actor, projectId);
    }

    // =========================================================================
    // 6. BLOCKERS & WAIVERS
    // =========================================================================
    @Transactional
    public DeliveryDTOs.ProjectBlockerResponse createBlocker(
            Actor actor,
            String projectId,
            DeliveryDTOs.CreateBlockerRequest req) {

        ProjectEntity project = findVisibleProject(actor, projectId);

        if (project.isArchived()) {
            throw new ApiException(HttpStatus.CONFLICT, "PROJECT_ARCHIVED",
                    "Actions cannot be performed on an archived project. Restore it first.");
        }

        if (req.title() == null || req.title().trim().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MISSING_TITLE", "Blocker title is required.");
        }

        String severity = req.severity() != null ? req.severity().trim().toUpperCase(Locale.ROOT) : "NORMAL";
        if (!List.of("NORMAL", "CRITICAL").contains(severity)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SEVERITY", "Severity must be NORMAL or CRITICAL.");
        }

        Instant now = Instant.now();
        ProjectBlockerEntity entity = new ProjectBlockerEntity();
        entity.setId("blk-" + UUID.randomUUID().toString().substring(0, 8));
        entity.setOrgId(actor.orgId());
        entity.setProjectId(project.getId());
        entity.setTitle(req.title().trim());
        entity.setDescription(req.description() != null ? req.description().trim() : null);
        entity.setSeverity(severity);
        entity.setStatus("OPEN");
        entity.setCreatedBy(actor.userId());
        entity.setCreatedAt(now);

        ProjectBlockerEntity saved = blockerRepository.save(entity);
        return toBlockerResponse(saved, null);
    }

    @Transactional
    public DeliveryDTOs.ProjectBlockerResponse waiveBlocker(
            Actor actor,
            String projectId,
            String blockerId,
            DeliveryDTOs.CreateWaiverRequest req) {

        ProjectEntity project = findVisibleProject(actor, projectId);

        if (project.isArchived()) {
            throw new ApiException(HttpStatus.CONFLICT, "PROJECT_ARCHIVED",
                    "Actions cannot be performed on an archived project. Restore it first.");
        }

        // Authorization check: Reviewer / PM / Owner / Admin
        boolean canWaive = access.can(actor, project.getId(), PermissionKey.PROJECT_EDIT)
                || access.can(actor, project.getId(), PermissionKey.PROJECT_PROGRESS_OVERRIDE)
                || access.can(actor, project.getId(), PermissionKey.TEAM_MANAGE)
                || access.can(actor, project.getId(), PermissionKey.TASK_REVIEW)
                || access.can(actor, project.getId(), PermissionKey.TASK_ASSIGN)
                || access.canAtOrg(actor, PermissionKey.ORG_MANAGE);
        if (!canWaive) {
            throw PermissionService.forbidden();
        }

        ProjectBlockerEntity blocker = blockerRepository.findByIdAndOrgId(blockerId, actor.orgId())
                .orElseThrow(() -> access.notFound(actor, "BLOCKER", blockerId));

        if (!project.getId().equals(blocker.getProjectId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BLOCKER_MISMATCH", "Blocker does not belong to this project.");
        }

        if (req.reason() == null || req.reason().trim().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MISSING_WAIVER_REASON", "Waiver reason is required.");
        }

        Instant now = Instant.now();
        ProjectBlockerWaiverEntity waiver = new ProjectBlockerWaiverEntity();
        waiver.setId("waiv-" + UUID.randomUUID().toString().substring(0, 8));
        waiver.setOrgId(actor.orgId());
        waiver.setProjectId(project.getId());
        waiver.setBlockerRef(blocker.getId());
        waiver.setActorId(actor.userId());
        waiver.setActorName(actor.principal().email() != null ? actor.principal().email() : actor.userId());
        waiver.setReason(req.reason().trim());
        waiver.setWaivedAt(now);

        ProjectBlockerWaiverEntity savedWaiver = waiverRepository.save(waiver);

        blocker.setStatus("WAIVED");
        ProjectBlockerEntity savedBlocker = blockerRepository.save(blocker);

        return toBlockerResponse(savedBlocker, savedWaiver);
    }

    @Transactional
    public DeliveryDTOs.ProjectBlockerResponse resolveBlocker(
            Actor actor,
            String projectId,
            String blockerId) {

        ProjectEntity project = findVisibleProject(actor, projectId);

        if (project.isArchived()) {
            throw new ApiException(HttpStatus.CONFLICT, "PROJECT_ARCHIVED",
                    "Actions cannot be performed on an archived project. Restore it first.");
        }

        ProjectBlockerEntity blocker = blockerRepository.findByIdAndOrgId(blockerId, actor.orgId())
                .orElseThrow(() -> access.notFound(actor, "BLOCKER", blockerId));

        if (!project.getId().equals(blocker.getProjectId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "BLOCKER_MISMATCH", "Blocker does not belong to this project.");
        }

        blocker.setStatus("RESOLVED");
        blocker.setResolvedAt(Instant.now());
        ProjectBlockerEntity saved = blockerRepository.save(blocker);

        Optional<ProjectBlockerWaiverEntity> waiver = waiverRepository.findByOrgIdAndProjectIdAndBlockerRef(
                actor.orgId(), project.getId(), saved.getId());

        return toBlockerResponse(saved, waiver.orElse(null));
    }

    // =========================================================================
    // 7. GET DELIVERY STATUS & HISTORIES
    // =========================================================================
    @Transactional(readOnly = true)
    public DeliveryDTOs.ProjectDeliveryStatusResponse getDeliveryStatus(Actor actor, String projectId) {
        ProjectEntity project = findVisibleProject(actor, projectId);

        Optional<AcceptanceRequestEntity> latestReq = acceptanceRequestRepository
                .findByOrgIdAndProjectIdOrderByCreatedAtDesc(actor.orgId(), project.getId())
                .stream().findFirst();

        DeliveryDTOs.AcceptanceRequestResponse latestReqDto = latestReq.map(r -> {
            List<AcceptanceDecisionEntity> decisions = acceptanceDecisionRepository
                    .findByOrgIdAndRequestIdOrderByDecidedAtDesc(actor.orgId(), r.getId());
            return toAcceptanceRequestResponse(r, decisions);
        }).orElse(null);

        Optional<ProjectClosureEntity> latestClosure = closureRepository
                .findFirstByOrgIdAndProjectIdOrderByClosedAtDesc(actor.orgId(), project.getId());
        DeliveryDTOs.ProjectClosureResponse latestClosureDto = latestClosure.map(this::toProjectClosureResponse).orElse(null);

        List<ProjectBlockerEntity> criticalOpen = blockerRepository.findByOrgIdAndProjectIdAndStatusAndSeverity(
                actor.orgId(), project.getId(), "OPEN", "CRITICAL");

        int unwaivedCount = 0;
        for (ProjectBlockerEntity b : criticalOpen) {
            Optional<ProjectBlockerWaiverEntity> w = waiverRepository.findByOrgIdAndProjectIdAndBlockerRef(
                    actor.orgId(), project.getId(), b.getId());
            if (w.isEmpty()) {
                unwaivedCount++;
            }
        }

        boolean canSubmit = !project.isArchived()
                && "ACTIVE".equalsIgnoreCase(project.getLifecycle())
                && project.getLastProgressPercent() != null
                && project.getLastProgressPercent().compareTo(BigDecimal.valueOf(100)) >= 0;

        boolean canApprove = !project.isArchived()
                && "AWAITING_ACCEPTANCE".equalsIgnoreCase(project.getLifecycle())
                && (access.can(actor, project.getId(), PermissionKey.PROJECT_EDIT)
                || access.can(actor, project.getId(), PermissionKey.PROJECT_PROGRESS_OVERRIDE)
                || access.can(actor, project.getId(), PermissionKey.TEAM_MANAGE)
                || access.can(actor, project.getId(), PermissionKey.TASK_REVIEW)
                || access.can(actor, project.getId(), PermissionKey.TASK_ASSIGN)
                || access.canAtOrg(actor, PermissionKey.ORG_MANAGE))
                && (latestReq.isEmpty() || !actor.userId().equals(latestReq.get().getCreatedBy()))
                && (project.getAccountableDeveloperId() == null || !actor.userId().equals(project.getAccountableDeveloperId()));

        boolean canClose = !project.isArchived()
                && "DELIVERED".equalsIgnoreCase(project.getLifecycle())
                && (access.canAtOrg(actor, PermissionKey.ORG_MANAGE)
                || access.can(actor, project.getId(), PermissionKey.TEAM_MANAGE)
                || (project.getProjectManagerId() != null && actor.userId().equals(project.getProjectManagerId())));

        boolean canArchive = !project.isArchived()
                && (access.can(actor, project.getId(), PermissionKey.PROJECT_ARCHIVE)
                || access.canAtOrg(actor, PermissionKey.PROJECT_ARCHIVE));

        boolean canRestore = project.isArchived()
                && (access.can(actor, project.getId(), PermissionKey.PROJECT_ARCHIVE)
                || access.canAtOrg(actor, PermissionKey.PROJECT_ARCHIVE));

        return new DeliveryDTOs.ProjectDeliveryStatusResponse(
                project.getId(),
                project.getLifecycle(),
                project.getPreviousLifecycle(),
                project.isArchived(),
                project.getLastProgressPercent() != null ? project.getLastProgressPercent() : BigDecimal.ZERO,
                project.getVersion(),
                latestReqDto,
                latestClosureDto,
                criticalOpen.size(),
                unwaivedCount,
                canSubmit,
                canApprove,
                canClose,
                canArchive,
                canRestore
        );
    }

    @Transactional(readOnly = true)
    public List<DeliveryDTOs.AcceptanceRequestResponse> getAcceptanceRequests(Actor actor, String projectId) {
        ProjectEntity project = findVisibleProject(actor, projectId);
        List<AcceptanceRequestEntity> requests = acceptanceRequestRepository
                .findByOrgIdAndProjectIdOrderByCreatedAtDesc(actor.orgId(), project.getId());

        List<DeliveryDTOs.AcceptanceRequestResponse> res = new ArrayList<>();
        for (AcceptanceRequestEntity req : requests) {
            List<AcceptanceDecisionEntity> decisions = acceptanceDecisionRepository
                    .findByOrgIdAndRequestIdOrderByDecidedAtDesc(actor.orgId(), req.getId());
            res.add(toAcceptanceRequestResponse(req, decisions));
        }
        return res;
    }

    @Transactional(readOnly = true)
    public List<DeliveryDTOs.ProjectBlockerResponse> getBlockers(Actor actor, String projectId) {
        ProjectEntity project = findVisibleProject(actor, projectId);
        List<ProjectBlockerEntity> blockers = blockerRepository
                .findByOrgIdAndProjectIdOrderByCreatedAtDesc(actor.orgId(), project.getId());

        List<DeliveryDTOs.ProjectBlockerResponse> res = new ArrayList<>();
        for (ProjectBlockerEntity b : blockers) {
            Optional<ProjectBlockerWaiverEntity> waiver = waiverRepository.findByOrgIdAndProjectIdAndBlockerRef(
                    actor.orgId(), project.getId(), b.getId());
            res.add(toBlockerResponse(b, waiver.orElse(null)));
        }
        return res;
    }

    @Transactional(readOnly = true)
    public List<DeliveryDTOs.ProjectLifecycleHistoryResponse> getLifecycleHistory(Actor actor, String projectId) {
        ProjectEntity project = findVisibleProject(actor, projectId);
        List<ProjectLifecycleHistoryEntity> list = lifecycleHistoryRepository
                .findByOrgIdAndProjectIdOrderByCreatedAtDesc(actor.orgId(), project.getId());

        return list.stream().map(h -> new DeliveryDTOs.ProjectLifecycleHistoryResponse(
                h.getId(),
                h.getProjectId(),
                h.getPreviousLifecycle(),
                h.getNewLifecycle(),
                h.getReason(),
                h.getActorId(),
                h.getActorName(),
                h.getCreatedAt()
        )).toList();
    }

    @Transactional(readOnly = true)
    public List<DeliveryDTOs.ProjectClosureResponse> getClosures(Actor actor, String projectId) {
        ProjectEntity project = findVisibleProject(actor, projectId);
        List<ProjectClosureEntity> list = closureRepository
                .findByOrgIdAndProjectIdOrderByClosedAtDesc(actor.orgId(), project.getId());

        return list.stream().map(this::toProjectClosureResponse).toList();
    }

    // =========================================================================
    // HELPER MAPPERS & UTILS
    // =========================================================================
    private ProjectEntity findVisibleProject(Actor actor, String projectId) {
        ProjectEntity project = projectRepository.findByIdAndOrgId(projectId, actor.orgId())
                .orElseThrow(() -> access.notFound(actor, "PROJECT", projectId));
        access.requireVisible(actor, "PROJECT", projectId, projectId);
        return project;
    }

    private DeliveryDTOs.AcceptanceRequestResponse toAcceptanceRequestResponse(
            AcceptanceRequestEntity entity,
            List<AcceptanceDecisionEntity> decisions) {

        List<DeliveryDTOs.ChecklistItem> checklist = fromJson(
                entity.getChecklist(),
                new TypeReference<List<DeliveryDTOs.ChecklistItem>>() {}
        );
        List<DeliveryDTOs.EvidenceItem> evidence = fromJson(
                entity.getEvidenceItems(),
                new TypeReference<List<DeliveryDTOs.EvidenceItem>>() {}
        );

        List<DeliveryDTOs.AcceptanceDecisionResponse> decResponses = (decisions != null ? decisions : List.<AcceptanceDecisionEntity>of())
                .stream()
                .map(this::toAcceptanceDecisionResponse)
                .toList();

        return new DeliveryDTOs.AcceptanceRequestResponse(
                entity.getId(),
                entity.getOrgId(),
                entity.getProjectId(),
                entity.getBoundCheckinId(),
                checklist != null ? checklist : List.of(),
                entity.getEvidenceSummary(),
                evidence != null ? evidence : List.of(),
                entity.getStatus(),
                entity.getVersion(),
                entity.getCreatedBy(),
                entity.getCreatedByName(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                decResponses
        );
    }

    private DeliveryDTOs.AcceptanceDecisionResponse toAcceptanceDecisionResponse(AcceptanceDecisionEntity entity) {
        return new DeliveryDTOs.AcceptanceDecisionResponse(
                entity.getId(),
                entity.getRequestId(),
                entity.getProjectId(),
                entity.getDecision(),
                entity.getActorId(),
                entity.getActorName(),
                entity.getReason(),
                entity.getDecidedAt()
        );
    }

    private DeliveryDTOs.ProjectBlockerResponse toBlockerResponse(
            ProjectBlockerEntity blocker,
            ProjectBlockerWaiverEntity waiver) {

        DeliveryDTOs.ProjectBlockerWaiverResponse waiverDto = null;
        if (waiver != null) {
            waiverDto = new DeliveryDTOs.ProjectBlockerWaiverResponse(
                    waiver.getId(),
                    waiver.getProjectId(),
                    waiver.getBlockerRef(),
                    waiver.getActorId(),
                    waiver.getActorName(),
                    waiver.getReason(),
                    waiver.getWaivedAt()
            );
        }

        return new DeliveryDTOs.ProjectBlockerResponse(
                blocker.getId(),
                blocker.getProjectId(),
                blocker.getTitle(),
                blocker.getDescription(),
                blocker.getSeverity(),
                blocker.getStatus(),
                blocker.getCreatedBy(),
                blocker.getCreatedAt(),
                blocker.getResolvedAt(),
                waiverDto
        );
    }

    private DeliveryDTOs.ProjectClosureResponse toProjectClosureResponse(ProjectClosureEntity entity) {
        return new DeliveryDTOs.ProjectClosureResponse(
                entity.getId(),
                entity.getProjectId(),
                entity.getActorId(),
                entity.getActorName(),
                entity.getHandoverNote(),
                entity.getReason(),
                entity.getClosedAt()
        );
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            log.error("Failed to serialize to JSON", e);
            return "[]";
        }
    }

    private <T> T fromJson(String json, TypeReference<T> ref) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, ref);
        } catch (Exception e) {
            log.error("Failed to parse JSON: {}", json, e);
            return null;
        }
    }

    private UUID tryParseUuid(String s) {
        if (s == null) return null;
        try {
            return UUID.fromString(s);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
