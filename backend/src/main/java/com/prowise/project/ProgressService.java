package com.prowise.project;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.authz.SecurityEvidenceService;
import com.prowise.common.api.ApiException;
import com.prowise.common.audit.ChangeRecorder;
import com.prowise.developer.DeveloperAccess;
import com.prowise.developer.DeveloperAccess.Actor;
import com.prowise.developer.GitHubActivityEntity;
import com.prowise.developer.GitHubActivityRepository;
import com.prowise.developer.ProjectCheckInEntity;
import com.prowise.developer.ProjectCheckInRepository;
import com.prowise.developer.ProjectEntity;
import com.prowise.developer.ProjectRepository;
import com.prowise.project.ProgressDTOs.*;

@Service
public class ProgressService {

    private static final Logger log = LoggerFactory.getLogger(ProgressService.class);

    private final ProjectRepository projectRepository;
    private final ProjectCheckInRepository checkInRepository;
    private final GitHubActivityRepository gitHubActivityRepository;
    private final ProjectRepositoryLinkRepository repoLinkRepository;
    private final DeveloperAccess access;
    private final SecurityEvidenceService evidence;
    private final ChangeRecorder changeRecorder;
    private final ObjectMapper objectMapper;

    public ProgressService(
            ProjectRepository projectRepository,
            ProjectCheckInRepository checkInRepository,
            GitHubActivityRepository gitHubActivityRepository,
            ProjectRepositoryLinkRepository repoLinkRepository,
            DeveloperAccess access,
            SecurityEvidenceService evidence,
            ChangeRecorder changeRecorder,
            ObjectMapper objectMapper) {
        this.projectRepository = projectRepository;
        this.checkInRepository = checkInRepository;
        this.gitHubActivityRepository = gitHubActivityRepository;
        this.repoLinkRepository = repoLinkRepository;
        this.access = access;
        this.evidence = evidence;
        this.changeRecorder = changeRecorder;
        this.objectMapper = objectMapper;
    }

    // =========================================================================
    // 1. SUBMIT CHECK-IN (DEVELOPER PROGRESS)
    // =========================================================================
    @Transactional
    public CheckInResponse submitCheckIn(
            Actor actor,
            String projectId,
            CheckInSubmissionRequest request,
            String headerIdempotencyKey) {

        ProjectEntity project = findVisibleProject(actor, projectId);

        // 1. Individual mode only (Domain Rule: structured mode calculates progress from work items)
        if ("STRUCTURED".equalsIgnoreCase(project.getMode())) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_PROJECT_MODE",
                    "Direct percentage check-ins are restricted for Structured Mode projects. Progress is calculated from work items.");
        }

        // 2. Archived projects freeze all edits
        if (project.isArchived()) {
            throw new ApiException(HttpStatus.CONFLICT, "PROJECT_ARCHIVED",
                    "Archived projects cannot accept progress check-ins.");
        }

        // 3. Accountability check: only accountable developer (or PM/Owner with project.progress.report)
        boolean isAccountable = actor.userId().equals(project.getAccountableDeveloperId())
                || actor.userId().equals(project.getAccountableOwnerId());
        boolean hasReportPermission = access.can(actor, project.getId(), PermissionKey.PROJECT_PROGRESS_REPORT);

        if (!isAccountable && !hasReportPermission) {
            log.warn("User {} denied progress submission for project {} (accountable developer: {})",
                    actor.userId(), project.getId(), project.getAccountableDeveloperId());
            throw PermissionService.forbidden();
        }

        // 4. Percentage bounds
        if (request.percent() == null || request.percent().compareTo(BigDecimal.ZERO) < 0
                || request.percent().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PERCENTAGE",
                    "Completion percentage must be between 0 and 100.");
        }

        // 5. Idempotency replay check
        String effectiveIdempotencyKey = headerIdempotencyKey != null && !headerIdempotencyKey.isBlank()
                ? headerIdempotencyKey.trim()
                : (request.idempotencyKey() != null && !request.idempotencyKey().isBlank()
                ? request.idempotencyKey().trim()
                : null);

        if (effectiveIdempotencyKey != null) {
            Optional<ProjectCheckInEntity> existing = checkInRepository.findByOrgIdAndIdempotencyKey(
                    actor.orgId(), effectiveIdempotencyKey);
            if (existing.isPresent()) {
                log.info("Idempotent check-in submission replay detected for key {}", effectiveIdempotencyKey);
                return mapToCheckInResponse(existing.get(), project);
            }
        }

        // 6. Downward revision check (T18: downward correction requires a reason)
        Optional<ProjectCheckInEntity> latestAccepted = checkInRepository
                .findTop1ByOrgIdAndProjectIdAndStatusOrderByRevisionSeqDescCreatedAtDesc(
                        actor.orgId(), project.getId(), "ACCEPTED");

        BigDecimal newPercent = request.percent().setScale(2, RoundingMode.HALF_UP);
        if (latestAccepted.isPresent() && newPercent.compareTo(latestAccepted.get().getPercent()) < 0) {
            if (request.downwardReason() == null || request.downwardReason().trim().isEmpty()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "DOWNWARD_REVISION_REASON_REQUIRED",
                        "downward_reason is required when reducing progress");
            }
        }

        // 7. Calculate revision sequence & link previous check-in
        Optional<ProjectCheckInEntity> latestAny = checkInRepository
                .findTop1ByOrgIdAndProjectIdOrderByRevisionSeqDescCreatedAtDesc(
                        actor.orgId(), project.getId());

        int revisionSeq = latestAny.map(c -> c.getRevisionSeq() + 1).orElse(1);
        String revisionOf = request.revisionOf() != null && !request.revisionOf().isBlank()
                ? request.revisionOf()
                : latestAny.map(ProjectCheckInEntity::getId).orElse(null);

        // 8. Determine initial status based on project.require_verification
        boolean requireVerif = project.isRequireVerification();
        String initialStatus = requireVerif ? "PENDING_VERIFICATION" : "ACCEPTED";

        // 9. Serialize evidence items to JSON if present
        String evidenceJson = serializeEvidence(request.evidenceItems(), request.evidence());

        // 10. Construct entity
        ProjectCheckInEntity checkIn = new ProjectCheckInEntity();
        checkIn.setId("chk-" + UUID.randomUUID().toString().substring(0, 12));
        checkIn.setOrgId(actor.orgId());
        checkIn.setProjectId(project.getId());
        checkIn.setAuthorId(actor.userId());
        checkIn.setAuthorName(resolveUserName(actor));
        checkIn.setRevisionOf(revisionOf);
        checkIn.setRevisionSeq(revisionSeq);
        checkIn.setPercent(newPercent);
        checkIn.setAccomplished(request.accomplished().trim());
        checkIn.setNextSteps(request.nextSteps().trim());
        checkIn.setBlockers(request.blockers() != null ? request.blockers().trim() : null);
        checkIn.setProjectedFinish(request.projectedFinish());
        checkIn.setEvidenceSummary(request.evidence());
        checkIn.setEvidence(evidenceJson);
        checkIn.setDownwardReason(request.downwardReason() != null ? request.downwardReason().trim() : null);
        checkIn.setStatus(initialStatus);
        checkIn.setMethod("DEVELOPER_REPORTED");
        checkIn.setIdempotencyKey(effectiveIdempotencyKey);
        checkIn.setCapturedAt(Instant.now());
        checkIn.setCreatedAt(Instant.now());

        ProjectCheckInEntity saved = checkInRepository.save(checkIn);

        // 11. If auto-accepted, update project record immediately
        if ("ACCEPTED".equals(initialStatus)) {
            project.setLastProgressPercent(saved.getPercent());
            project.setLastProgressMethod("DEVELOPER_REPORTED");
            project.setLastReportedAt(saved.getCapturedAt());
            project.setUpdatedAt(Instant.now());
            // Domain rule: 100% progress must NEVER automatically mark project DELIVERED or CLOSED
            projectRepository.save(project);
        }

        // 12. Record audit log and outbox event
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("percent", saved.getPercent());
        metadata.put("status", saved.getStatus());
        metadata.put("revision_seq", saved.getRevisionSeq());
        metadata.put("require_verification", requireVerif);
        if (saved.getDownwardReason() != null) {
            metadata.put("downward_reason", saved.getDownwardReason());
        }

        changeRecorder.recordChange(
                actor.orgId(),
                tryParseUuid(actor.userId()),
                "CHECKIN_SUBMITTED",
                "PROJECT_CHECKIN",
                saved.getId(),
                metadata,
                "PROJECT",
                project.getId(),
                "ProjectCheckInSubmittedEvent",
                project.getVersion(),
                metadata
        );

        return mapToCheckInResponse(saved, project);
    }

    // =========================================================================
    // 2. VERIFY CHECK-IN (TEAM LEAD / REVIEWER)
    // =========================================================================
    @Transactional
    public CheckInResponse verifyCheckIn(
            Actor actor,
            String checkinId,
            VerificationDecisionRequest request) {

        ProjectCheckInEntity checkIn = checkInRepository.findByIdAndOrgId(checkinId, actor.orgId())
                .orElseThrow(() -> access.notFound(actor, "CHECKIN", checkinId));

        ProjectEntity project = findVisibleProject(actor, checkIn.getProjectId());

        // 1. Separation of duties: Developer cannot verify own submission
        if (actor.userId().equals(checkIn.getAuthorId())) {
            log.warn("User {} attempted self-verification on checkin {}", actor.userId(), checkinId);
            throw PermissionService.forbidden();
        }

        // 2. Reviewer authorization check
        boolean canReview = access.can(actor, project.getId(), PermissionKey.PROJECT_PROGRESS_OVERRIDE)
                || access.can(actor, project.getId(), PermissionKey.TASK_REVIEW)
                || access.can(actor, project.getId(), PermissionKey.PROJECT_EDIT)
                || access.can(actor, project.getId(), PermissionKey.TEAM_MANAGE)
                || access.can(actor, project.getId(), PermissionKey.TASK_ASSIGN)
                || access.canAtOrg(actor, PermissionKey.ORG_MANAGE);

        if (!canReview) {
            log.warn("User {} missing review permission for project {}", actor.userId(), project.getId());
            throw PermissionService.forbidden();
        }

        // 3. Stale review check: only PENDING_VERIFICATION checkins can be reviewed
        if (!"PENDING_VERIFICATION".equalsIgnoreCase(checkIn.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_VERIFIED",
                    "This check-in submission has already been reviewed (current status: " + checkIn.getStatus() + ").");
        }

        // 4. Decision processing
        String decision = request.decision() != null ? request.decision().toUpperCase().trim() : "";
        Instant now = Instant.now();
        checkIn.setVerifiedBy(actor.userId());
        checkIn.setReviewedAt(now);
        checkIn.setReviewComment(request.comment() != null ? request.comment().trim() : null);

        if ("APPROVE".equals(decision)) {
            checkIn.setStatus("ACCEPTED");
            // Verification must NOT change the method from DEVELOPER_REPORTED
            checkIn.setMethod("DEVELOPER_REPORTED");

            // Update project record with the approved progress
            project.setLastProgressPercent(checkIn.getPercent());
            project.setLastProgressMethod("DEVELOPER_REPORTED");
            project.setLastReportedAt(checkIn.getCapturedAt());
            project.setUpdatedAt(now);
            // 100% does NOT automatically close delivery
            projectRepository.save(project);

        } else if ("REQUEST_CHANGES".equals(decision)) {
            checkIn.setStatus("CHANGES_REQUESTED");
            // Project current progress remains unchanged

        } else if ("REJECT".equals(decision)) {
            checkIn.setStatus("REJECTED");
            // Project current progress remains unchanged

        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DECISION",
                    "Decision must be APPROVE, REQUEST_CHANGES, or REJECT.");
        }

        ProjectCheckInEntity saved = checkInRepository.save(checkIn);

        // 5. Record audit & outbox
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("decision", decision);
        metadata.put("status", saved.getStatus());
        metadata.put("verified_by", actor.userId());
        metadata.put("percent", saved.getPercent());
        metadata.put("comment", request.comment());

        changeRecorder.recordChange(
                actor.orgId(),
                tryParseUuid(actor.userId()),
                "CHECKIN_VERIFIED",
                "PROJECT_CHECKIN",
                saved.getId(),
                metadata,
                "PROJECT",
                project.getId(),
                "ProjectCheckInVerifiedEvent",
                project.getVersion(),
                metadata
        );

        return mapToCheckInResponse(saved, project);
    }

    // =========================================================================
    // 3. READ QUERIES
    // =========================================================================

    @Transactional(readOnly = true)
    public List<CheckInResponse> getProjectCheckIns(Actor actor, String projectId) {
        ProjectEntity project = findVisibleProject(actor, projectId);
        List<ProjectCheckInEntity> list = checkInRepository
                .findByOrgIdAndProjectIdOrderByRevisionSeqDescCreatedAtDesc(actor.orgId(), project.getId());
        return list.stream().map(c -> mapToCheckInResponse(c, project)).toList();
    }

    @Transactional(readOnly = true)
    public ProgressSummaryResponse getProjectProgressSummary(Actor actor, String projectId) {
        ProjectEntity project = findVisibleProject(actor, projectId);
        List<ProjectCheckInEntity> all = checkInRepository
                .findByOrgIdAndProjectIdOrderByRevisionSeqDescCreatedAtDesc(actor.orgId(), project.getId());

        CheckInResponse latestAccepted = all.stream()
                .filter(c -> "ACCEPTED".equalsIgnoreCase(c.getStatus()))
                .findFirst()
                .map(c -> mapToCheckInResponse(c, project))
                .orElse(null);

        CheckInResponse pending = all.stream()
                .filter(c -> "PENDING_VERIFICATION".equalsIgnoreCase(c.getStatus()))
                .findFirst()
                .map(c -> mapToCheckInResponse(c, project))
                .orElse(null);

        List<CheckInResponse> history = all.stream()
                .map(c -> mapToCheckInResponse(c, project))
                .toList();

        return new ProgressSummaryResponse(
                project.getId(),
                project.getKey(),
                project.getName(),
                project.getMode(),
                project.getLastProgressPercent() != null ? project.getLastProgressPercent() : BigDecimal.ZERO,
                project.getLastProgressMethod() != null ? project.getLastProgressMethod() : "DEVELOPER_REPORTED",
                project.getLastReportedAt(),
                project.isRequireVerification(),
                latestAccepted,
                pending,
                history
        );
    }

    @Transactional(readOnly = true)
    public List<PendingReviewResponse> getPendingReviews(Actor actor, UUID orgId) {
        if (!actor.orgId().equals(orgId)) {
            evidence.recordDenied(actor.principal(), SecurityEvidenceService.ACCESS_DENIED, "ORGANIZATION",
                    orgId.toString(), "Foreign organization pending review access");
            throw PermissionService.notFound();
        }

        List<ProjectCheckInEntity> pending = checkInRepository
                .findByOrgIdAndStatusOrderByCreatedAtDesc(actor.orgId(), "PENDING_VERIFICATION");

        List<PendingReviewResponse> result = new ArrayList<>();
        for (ProjectCheckInEntity checkin : pending) {
            Optional<ProjectEntity> projOpt = projectRepository.findByIdAndOrgId(checkin.getProjectId(), actor.orgId());
            if (projOpt.isPresent()) {
                ProjectEntity proj = projOpt.get();
                // Check caller can review this project
                if (access.canRead(actor, proj.getId())) {
                    BigDecimal prevAccepted = checkInRepository
                            .findTop1ByOrgIdAndProjectIdAndStatusOrderByRevisionSeqDescCreatedAtDesc(
                                    actor.orgId(), proj.getId(), "ACCEPTED")
                            .map(ProjectCheckInEntity::getPercent)
                            .orElse(BigDecimal.ZERO);

                    result.add(new PendingReviewResponse(
                            mapToCheckInResponse(checkin, proj),
                            proj.getKey(),
                            proj.getName(),
                            checkin.getAuthorName() != null ? checkin.getAuthorName() : "Developer",
                            prevAccepted
                    ));
                }
            }
        }
        return result;
    }

    // =========================================================================
    // 4. GITHUB ACTIVITY & REPOSITORIES
    // =========================================================================

    @Transactional(readOnly = true)
    public List<GitHubActivityEntity> getGitHubActivity(Actor actor, String projectId) {
        ProjectEntity project = findVisibleProject(actor, projectId);
        List<GitHubActivityEntity> byProject = gitHubActivityRepository
                .findByOrgIdAndProjectIdOrderByCreatedAtDesc(actor.orgId(), project.getId());

        if (!byProject.isEmpty()) {
            return byProject;
        }

        // Also search linked repos
        List<ProjectRepositoryLinkEntity> links = repoLinkRepository.findByOrgIdAndProjectId(actor.orgId(), project.getId());
        if (!links.isEmpty()) {
            List<GitHubActivityEntity> combined = new ArrayList<>();
            for (ProjectRepositoryLinkEntity link : links) {
                combined.addAll(gitHubActivityRepository
                        .findByOrgIdAndRepositoryNameOrderByCreatedAtDesc(actor.orgId(), link.getRepoName()));
            }
            combined.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
            return combined;
        }

        // Fallback to recent org git activity
        return gitHubActivityRepository.findByOrgIdOrderByCreatedAtDesc(actor.orgId());
    }

    @Transactional
    public void linkRepository(Actor actor, String projectId, AttachRepoRequest request) {
        ProjectEntity project = findVisibleProject(actor, projectId);
        access.requireAction(actor, project.getId(), PermissionKey.PROJECT_EDIT);

        String repoName = request.repoName().trim();
        Optional<ProjectRepositoryLinkEntity> existing = repoLinkRepository
                .findByOrgIdAndProjectIdAndRepoName(actor.orgId(), project.getId(), repoName);

        if (existing.isEmpty()) {
            ProjectRepositoryLinkEntity link = new ProjectRepositoryLinkEntity(
                    "prl-" + UUID.randomUUID().toString().substring(0, 12),
                    actor.orgId(),
                    project.getId(),
                    repoName,
                    request.defaultBranch() != null ? request.defaultBranch() : "main"
            );
            repoLinkRepository.save(link);
        }
    }

    @Transactional
    public void setRequireVerification(Actor actor, String projectId, boolean requireVerification) {
        ProjectEntity project = findVisibleProject(actor, projectId);
        access.requireAction(actor, project.getId(), PermissionKey.PROJECT_EDIT);
        project.setRequireVerification(requireVerification);
        project.setUpdatedAt(Instant.now());
        projectRepository.save(project);
    }

    // =========================================================================
    // HELPER METHODS
    // =========================================================================

    private ProjectEntity findVisibleProject(Actor actor, String projectId) {
        ProjectEntity project = projectRepository.findByIdAndOrgId(projectId, actor.orgId())
                .orElseThrow(() -> access.notFound(actor, "PROJECT", projectId));
        access.requireVisible(actor, "PROJECT", projectId, project.getId());
        return project;
    }

    private String resolveUserName(Actor actor) {
        if (actor.principal() != null && actor.principal().email() != null) {
            String email = actor.principal().email();
            return email.contains("@") ? email.substring(0, email.indexOf("@")) : email;
        }
        return "Developer";
    }

    private CheckInResponse mapToCheckInResponse(ProjectCheckInEntity c, ProjectEntity p) {
        List<EvidenceItemDTO> items = parseEvidence(c.getEvidence());
        return new CheckInResponse(
                c.getId(),
                c.getOrgId(),
                c.getProjectId(),
                p != null ? p.getKey() : "",
                p != null ? p.getName() : "",
                c.getAuthorId(),
                c.getAuthorName() != null ? c.getAuthorName() : "Developer",
                c.getRevisionOf(),
                c.getRevisionSeq() != null ? c.getRevisionSeq() : 1,
                c.getPercent(),
                c.getAccomplished(),
                c.getNextSteps(),
                c.getBlockers(),
                c.getProjectedFinish(),
                c.getDownwardReason(),
                c.getStatus(),
                c.getMethod() != null ? c.getMethod() : "DEVELOPER_REPORTED",
                c.getEvidenceSummary() != null ? c.getEvidenceSummary() : c.getEvidence(),
                items,
                c.getVerifiedBy(),
                c.getReviewComment(),
                c.getReviewedAt(),
                c.getCapturedAt(),
                c.getCreatedAt(),
                c.getVersion() != null ? c.getVersion() : 0L
        );
    }

    private String serializeEvidence(List<EvidenceItemDTO> items, String fallbackText) {
        if (items != null && !items.isEmpty()) {
            try {
                return objectMapper.writeValueAsString(items);
            } catch (JsonProcessingException e) {
                log.warn("Failed to serialize evidence items: {}", e.getMessage());
            }
        }
        if (fallbackText != null && !fallbackText.isBlank()) {
            String trimmed = fallbackText.trim();
            if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
                return trimmed;
            } else {
                try {
                    return objectMapper.writeValueAsString(List.of(
                            new EvidenceItemDTO("LINK", trimmed, trimmed, null, null, null)));
                } catch (Exception e) {
                    return null;
                }
            }
        }
        return null;
    }

    private List<EvidenceItemDTO> parseEvidence(String evidenceJson) {
        if (evidenceJson == null || evidenceJson.isBlank()) {
            return List.of();
        }
        try {
            if (evidenceJson.trim().startsWith("[")) {
                return objectMapper.readValue(evidenceJson, new TypeReference<List<EvidenceItemDTO>>() {});
            }
        } catch (Exception e) {
            // Text summary, not json array
        }
        return List.of();
    }

    private UUID tryParseUuid(String val) {
        if (val == null) return null;
        try {
            return UUID.fromString(val);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
