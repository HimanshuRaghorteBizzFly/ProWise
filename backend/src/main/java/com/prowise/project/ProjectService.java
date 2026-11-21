package com.prowise.project;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.authz.SecurityEvidenceService;
import com.prowise.common.api.ApiException;
import com.prowise.common.audit.ChangeRecorder;
import com.prowise.developer.ProjectEntity;
import com.prowise.developer.ProjectRepository;
import com.prowise.identity.AuthPrincipal;

@Service
public class ProjectService {

    private static final Set<String> VALID_LIFECYCLES = Set.of(
            "PLANNED", "ACTIVE", "ON_HOLD", "AWAITING_ACCEPTANCE", "DELIVERED", "CLOSED", "CANCELLED"
    );

    private static final Set<String> VALID_PRIORITIES = Set.of(
            "LOW", "MEDIUM", "HIGH", "CRITICAL"
    );

    private static final Set<String> VALID_MODES = Set.of(
            "INDIVIDUAL", "STRUCTURED"
    );

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository memberRepository;
    private final ProjectDateHistoryRepository dateHistoryRepository;
    private final ProjectOwnershipHistoryRepository ownershipHistoryRepository;
    private final PermissionService permissionService;
    private final SecurityEvidenceService evidenceService;
    private final ChangeRecorder changeRecorder;
    private final JdbcTemplate jdbc;

    public ProjectService(
            ProjectRepository projectRepository,
            ProjectMemberRepository memberRepository,
            ProjectDateHistoryRepository dateHistoryRepository,
            ProjectOwnershipHistoryRepository ownershipHistoryRepository,
            PermissionService permissionService,
            SecurityEvidenceService evidenceService,
            ChangeRecorder changeRecorder,
            JdbcTemplate jdbc) {
        this.projectRepository = projectRepository;
        this.memberRepository = memberRepository;
        this.dateHistoryRepository = dateHistoryRepository;
        this.ownershipHistoryRepository = ownershipHistoryRepository;
        this.permissionService = permissionService;
        this.evidenceService = evidenceService;
        this.changeRecorder = changeRecorder;
        this.jdbc = jdbc;
    }

    /* ------------------------------------------------------------------
     * 1. Create Project (T09, T11)
     * ------------------------------------------------------------------ */

    @Transactional
    public ProjectDTOs.ProjectResponse createProject(
            UUID orgId,
            Authentication auth,
            ProjectDTOs.CreateProjectRequest request) {

        permissionService.require(auth, orgId, PermissionKey.PROJECT_CREATE.value());
        AuthPrincipal principal = permissionService.principal(auth);

        String rawKey = request.key() != null ? request.key().trim().toUpperCase(Locale.ROOT) : "";
        if (rawKey.length() < 2 || rawKey.length() > 20) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Project key must be between 2 and 20 characters.");
        }

        // T09: Reject duplicate key in the same organization
        if (projectRepository.existsByOrgIdAndKey(orgId, rawKey)) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_KEY", "A project with key '" + rawKey + "' already exists in this organization.");
        }

        // T09: Validate date range
        Instant start = request.startDate() != null ? request.startDate() : Instant.now();
        Instant target = request.targetDate();
        if (target != null && target.isBefore(start)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "Target delivery date cannot be before start date.");
        }

        // Validate timezone
        String timezone = request.timezone() != null && !request.timezone().isBlank() ? request.timezone().trim() : "America/New_York";
        try {
            ZoneId.of(timezone);
        } catch (Exception e) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_TIMEZONE", "Invalid IANA timezone: " + timezone);
        }

        // Validate mode
        String mode = request.mode() != null ? request.mode().trim().toUpperCase(Locale.ROOT) : "STRUCTURED";
        if (!VALID_MODES.contains(mode)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Mode must be INDIVIDUAL or STRUCTURED.");
        }

        // Validate lifecycle
        String lifecycle = request.lifecycle() != null ? request.lifecycle().trim().toUpperCase(Locale.ROOT) : "ACTIVE";
        if (!VALID_LIFECYCLES.contains(lifecycle)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Lifecycle must be one of: " + VALID_LIFECYCLES);
        }

        // Validate priority
        String priority = request.priority() != null ? request.priority().trim().toUpperCase(Locale.ROOT) : "MEDIUM";
        if (!VALID_PRIORITIES.contains(priority)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Priority must be one of: " + VALID_PRIORITIES);
        }

        // Validate owners/members belong to this org (reject foreign owners)
        String pmId = resolveAndValidateOrgMember(orgId, request.projectManagerId(), "project_manager");
        String accDevId = resolveAndValidateOrgMember(orgId, request.accountableDeveloperId(), "accountable_developer");

        // T11: For Individual mode, one accountable developer is required
        if ("INDIVIDUAL".equals(mode) && (accDevId == null || accDevId.isBlank())) {
            // Default to caller if caller is a developer or member in this org
            accDevId = principal.userId().toString();
        }

        // Generate unique project ID
        String projectId = "proj-" + rawKey.toLowerCase(Locale.ROOT) + "-" + UUID.randomUUID().toString().substring(0, 6);

        // Build project entity
        ProjectEntity project = new ProjectEntity();
        project.setId(projectId);
        project.setOrgId(orgId);
        project.setKey(rawKey);
        project.setName(request.name().trim());
        project.setDescription(request.description() != null ? request.description().trim() : null);
        project.setMode(mode);
        project.setLifecycle(lifecycle);
        project.setPriority(priority);
        project.setProjectManagerId(pmId);
        project.setAccountableDeveloperId(accDevId);
        project.setStartDate(start);
        project.setTargetDate(target);
        project.setTimezone(timezone);
        // T11: ZERO tasks and NO invented percentage
        project.setLastProgressPercent(BigDecimal.ZERO);
        project.setHealth("ON_TRACK");
        project.setArchived(false);
        project.setVersion(0L);

        // Validate and attach members
        List<String> memberIds = new ArrayList<>();
        if (request.memberIds() != null) {
            for (String rawMember : request.memberIds()) {
                String validated = resolveAndValidateOrgMember(orgId, rawMember, "member");
                if (validated != null && !memberIds.contains(validated)) {
                    memberIds.add(validated);
                }
            }
        }
        if (accDevId != null && !memberIds.contains(accDevId)) {
            memberIds.add(accDevId);
        }
        if (pmId != null && !memberIds.contains(pmId)) {
            memberIds.add(pmId);
        }
        project.setMemberIds(String.join(",", memberIds));

        if (request.teamIds() != null && !request.teamIds().isEmpty()) {
            project.setTeamIds(String.join(",", request.teamIds()));
        }

        projectRepository.save(project);

        // Persist project memberships in project_members table
        for (String mId : memberIds) {
            UUID membershipUuid = lookupMembershipId(orgId, mId);
            if (membershipUuid != null) {
                String role = mId.equals(pmId) ? "PROJECT_MANAGER" : (mId.equals(accDevId) ? "ACCOUNTABLE_DEVELOPER" : "MEMBER");
                ProjectMemberEntity pm = new ProjectMemberEntity(orgId, projectId, membershipUuid, role);
                memberRepository.save(pm);
            }
        }

        // Rule 4: Business change + audit row + outbox event in ONE @Transactional method
        Map<String, Object> auditMeta = new HashMap<>();
        auditMeta.put("key", rawKey);
        auditMeta.put("name", project.getName());
        auditMeta.put("mode", mode);
        auditMeta.put("lifecycle", lifecycle);
        auditMeta.put("accountable_developer_id", accDevId);
        auditMeta.put("project_manager_id", pmId);

        changeRecorder.recordChange(
                orgId,
                principal.userId(),
                "project.create",
                "PROJECT",
                projectId,
                auditMeta,
                "Project",
                projectId,
                "ProjectCreated",
                0L,
                auditMeta
        );

        return toResponse(project, List.of());
    }

    /* ------------------------------------------------------------------
     * 2. List Projects (with cursor pagination, filtering, search)
     * ------------------------------------------------------------------ */

    @Transactional(readOnly = true)
    public ProjectDTOs.ProjectListResponse listProjects(
            UUID orgId,
            Authentication auth,
            String search,
            String owner,
            String team,
            String health,
            String status,
            String mode,
            Boolean archived,
            String cursor,
            int limit) {

        permissionService.require(auth, orgId, PermissionKey.PROJECT_READ.value());

        boolean showArchived = Boolean.TRUE.equals(archived);
        List<ProjectEntity> allInOrg = projectRepository.findByOrgIdAndArchivedOrderByCreatedAtDesc(orgId, showArchived);

        // Security filter: return ONLY projects the user may read
        List<ProjectEntity> readable = allInOrg.stream()
                .filter(p -> permissionService.canOnProject(auth, orgId, p.getId(), PermissionKey.PROJECT_READ.value()))
                .toList();

        // Apply filters
        String q = search != null ? search.trim().toLowerCase(Locale.ROOT) : "";
        List<ProjectEntity> filtered = readable.stream().filter(p -> {
            if (!q.isEmpty()) {
                boolean matchName = p.getName() != null && p.getName().toLowerCase(Locale.ROOT).contains(q);
                boolean matchKey = p.getKey() != null && p.getKey().toLowerCase(Locale.ROOT).contains(q);
                boolean matchDesc = p.getDescription() != null && p.getDescription().toLowerCase(Locale.ROOT).contains(q);
                if (!matchName && !matchKey && !matchDesc) return false;
            }
            if (owner != null && !owner.isBlank() && !"ALL".equalsIgnoreCase(owner)) {
                boolean matchOwner = (p.getAccountableDeveloperId() != null && p.getAccountableDeveloperId().equals(owner))
                        || (p.getAccountableOwnerId() != null && p.getAccountableOwnerId().equals(owner));
                if (!matchOwner) return false;
            }
            if (team != null && !team.isBlank() && !"ALL".equalsIgnoreCase(team)) {
                if (p.getTeamIds() == null || !Arrays.asList(p.getTeamIds().split(",")).contains(team)) return false;
            }
            if (health != null && !health.isBlank() && !"ALL".equalsIgnoreCase(health)) {
                if (!health.equalsIgnoreCase(p.getHealth())) return false;
            }
            if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                if (!status.equalsIgnoreCase(p.getLifecycle())) return false;
            }
            if (mode != null && !mode.isBlank() && !"ALL".equalsIgnoreCase(mode)) {
                if (!mode.equalsIgnoreCase(p.getMode())) return false;
            }
            return true;
        }).toList();

        int pageSize = limit > 0 && limit <= 100 ? limit : 50;

        // Cursor pagination (deterministic order by createdAt DESC, id ASC)
        int startIndex = 0;
        if (cursor != null && !cursor.isBlank()) {
            for (int i = 0; i < filtered.size(); i++) {
                if (filtered.get(i).getId().equals(cursor)) {
                    startIndex = i + 1;
                    break;
                }
            }
        }

        List<ProjectEntity> page = filtered.stream().skip(startIndex).limit(pageSize).toList();
        String nextCursor = page.size() == pageSize && (startIndex + pageSize) < filtered.size()
                ? page.get(page.size() - 1).getId()
                : null;
        boolean hasMore = nextCursor != null;

        List<ProjectDTOs.ProjectResponse> dtos = page.stream()
                .map(p -> toResponse(p, List.of()))
                .toList();

        return new ProjectDTOs.ProjectListResponse(dtos, nextCursor, hasMore, filtered.size());
    }

    /* ------------------------------------------------------------------
     * 3. Get Single Project
     * ------------------------------------------------------------------ */

    @Transactional(readOnly = true)
    public ProjectDTOs.ProjectResponse getProject(UUID orgId, String projectId, Authentication auth) {
        ProjectEntity project = findVisibleProject(orgId, projectId, auth);
        List<ProjectDateHistoryEntity> dateHistories = dateHistoryRepository.findByOrgIdAndProjectIdOrderByChangedAtDesc(orgId, project.getId());
        List<ProjectDTOs.ProjectDateHistoryDTO> historyDtos = dateHistories.stream()
                .map(h -> new ProjectDTOs.ProjectDateHistoryDTO(h.getId(), h.getOldTargetDate(), h.getNewTargetDate(), h.getReason(), h.getActorId(), h.getChangedAt()))
                .toList();
        return toResponse(project, historyDtos);
    }

    /* ------------------------------------------------------------------
     * 4. Update Project (with optimistic locking & target date reason)
     * ------------------------------------------------------------------ */

    @Transactional
    public ProjectDTOs.ProjectResponse updateProject(
            UUID orgId,
            String projectId,
            Authentication auth,
            ProjectDTOs.UpdateProjectRequest request) {

        AuthPrincipal principal = permissionService.principal(auth);
        ProjectEntity project = findVisibleProject(orgId, projectId, auth);

        // Check project.edit permission
        if (!permissionService.canOnProject(auth, orgId, project.getId(), PermissionKey.PROJECT_EDIT.value())) {
            throw PermissionService.forbidden();
        }

        // Rule: cannot edit an archived project
        if (project.isArchived()) {
            throw new ApiException(HttpStatus.CONFLICT, "PROJECT_ARCHIVED", "Edits cannot be made to an archived project. Restore it first.");
        }

        // Optimistic locking via JPA @Version
        if (request.expectedVersion() == null || !request.expectedVersion().equals(project.getVersion())) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_VERSION", "The project was modified by another transaction. Reload and retry.");
        }

        boolean updated = false;

        if (request.name() != null && !request.name().isBlank()) {
            project.setName(request.name().trim());
            updated = true;
        }

        if (request.description() != null) {
            project.setDescription(request.description().trim());
            project.setScopeDescription(request.description().trim());
            updated = true;
        }

        if (request.priority() != null && !request.priority().isBlank()) {
            String p = request.priority().trim().toUpperCase(Locale.ROOT);
            if (!VALID_PRIORITIES.contains(p)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Priority must be one of: " + VALID_PRIORITIES);
            }
            project.setPriority(p);
            updated = true;
        }

        if (request.lifecycle() != null && !request.lifecycle().isBlank()) {
            String lc = request.lifecycle().trim().toUpperCase(Locale.ROOT);
            if (!VALID_LIFECYCLES.contains(lc)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Lifecycle must be one of: " + VALID_LIFECYCLES);
            }
            project.setLifecycle(lc);
            project.setStatus(lc);
            updated = true;
        }

        if (request.timezone() != null && !request.timezone().isBlank()) {
            try {
                ZoneId.of(request.timezone().trim());
                project.setTimezone(request.timezone().trim());
                updated = true;
            } catch (Exception e) {
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_TIMEZONE", "Invalid IANA timezone");
            }
        }

        // Change in target date requires target_date_reason and logs project_date_history
        if (request.targetDate() != null && !Objects.equals(request.targetDate(), project.getTargetDate())) {
            if (!permissionService.canOnProject(auth, orgId, project.getId(), PermissionKey.PROJECT_DEADLINE_EDIT.value())
                    && !permissionService.canOnProject(auth, orgId, project.getId(), PermissionKey.PROJECT_EDIT.value())) {
                throw PermissionService.forbidden();
            }

            if (request.targetDateReason() == null || request.targetDateReason().isBlank()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "MISSING_DEADLINE_REASON", "A reason is required when changing the target delivery date.");
            }

            Instant oldTarget = project.getTargetDate();
            Instant newTarget = request.targetDate();
            if (project.getStartDate() != null && newTarget.isBefore(project.getStartDate())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DATE_RANGE", "Target date cannot be before start date.");
            }

            project.setTargetDate(newTarget);
            project.setTargetCompletionDate(newTarget);

            ProjectDateHistoryEntity dateHistory = new ProjectDateHistoryEntity(
                    orgId, project.getId(), oldTarget, newTarget, request.targetDateReason().trim(), principal.userId()
            );
            dateHistoryRepository.save(dateHistory);

            changeRecorder.recordChange(
                    orgId, principal.userId(), "project.deadline.change", "PROJECT", project.getId(),
                    Map.of("old_target_date", String.valueOf(oldTarget), "new_target_date", String.valueOf(newTarget), "reason", request.targetDateReason().trim()),
                    "Project", project.getId(), "DeadlineChanged", project.getVersion() + 1,
                    Map.of("project_id", project.getId(), "new_target_date", String.valueOf(newTarget))
            );
            updated = true;
        }

        // Change in accountable developer logs ownership history
        if (request.accountableDeveloperId() != null && !Objects.equals(request.accountableDeveloperId(), project.getAccountableDeveloperId())) {
            String newOwner = resolveAndValidateOrgMember(orgId, request.accountableDeveloperId(), "accountable_developer");
            String oldOwner = project.getAccountableDeveloperId();

            project.setAccountableDeveloperId(newOwner);
            project.setAccountableOwnerId(newOwner);

            ProjectOwnershipHistoryEntity oh = new ProjectOwnershipHistoryEntity(
                    orgId, project.getId(), oldOwner, newOwner, "Ownership reassigned", principal.userId()
            );
            ownershipHistoryRepository.save(oh);
            updated = true;
        }

        if (request.projectManagerId() != null && !Objects.equals(request.projectManagerId(), project.getProjectManagerId())) {
            String newPm = resolveAndValidateOrgMember(orgId, request.projectManagerId(), "project_manager");
            project.setProjectManagerId(newPm);
            updated = true;
        }

        if (request.memberIds() != null) {
            List<String> validMembers = new ArrayList<>();
            for (String raw : request.memberIds()) {
                String val = resolveAndValidateOrgMember(orgId, raw, "member");
                if (val != null && !validMembers.contains(val)) validMembers.add(val);
            }
            project.setMemberIds(String.join(",", validMembers));
            updated = true;
        }

        project.setUpdatedAt(Instant.now());
        projectRepository.save(project);

        changeRecorder.recordChange(
                orgId, principal.userId(), "project.edit", "PROJECT", project.getId(),
                Map.of("project_id", project.getId(), "version", project.getVersion()),
                "Project", project.getId(), "ProjectUpdated", project.getVersion(),
                Map.of("project_id", project.getId(), "updated_at", String.valueOf(project.getUpdatedAt()))
        );

        List<ProjectDateHistoryEntity> dateHistories = dateHistoryRepository.findByOrgIdAndProjectIdOrderByChangedAtDesc(orgId, project.getId());
        List<ProjectDTOs.ProjectDateHistoryDTO> historyDtos = dateHistories.stream()
                .map(h -> new ProjectDTOs.ProjectDateHistoryDTO(h.getId(), h.getOldTargetDate(), h.getNewTargetDate(), h.getReason(), h.getActorId(), h.getChangedAt()))
                .toList();

        return toResponse(project, historyDtos);
    }

    /* ------------------------------------------------------------------
     * 5. Archive / Restore Project (T14 preparation)
     * ------------------------------------------------------------------ */

    @Transactional
    public ProjectDTOs.ProjectResponse archiveProject(UUID orgId, String projectId, long expectedVersion, Authentication auth) {
        permissionService.require(auth, orgId, PermissionKey.PROJECT_ARCHIVE.value());
        AuthPrincipal principal = permissionService.principal(auth);
        ProjectEntity project = findVisibleProject(orgId, projectId, auth);

        if (expectedVersion != project.getVersion()) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_VERSION", "Project version mismatch.");
        }

        project.setArchived(true);
        project.setPreviousLifecycle(project.getLifecycle());
        project.setUpdatedAt(Instant.now());
        projectRepository.save(project);

        changeRecorder.recordChange(
                orgId, principal.userId(), "project.archive", "PROJECT", project.getId(),
                Map.of("project_id", project.getId()),
                "Project", project.getId(), "ProjectArchived", project.getVersion(),
                Map.of("project_id", project.getId())
        );

        return toResponse(project, List.of());
    }

    @Transactional
    public ProjectDTOs.ProjectResponse restoreProject(UUID orgId, String projectId, long expectedVersion, Authentication auth) {
        permissionService.require(auth, orgId, PermissionKey.PROJECT_ARCHIVE.value());
        AuthPrincipal principal = permissionService.principal(auth);
        ProjectEntity project = findVisibleProject(orgId, projectId, auth);

        if (expectedVersion != project.getVersion()) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_VERSION", "Project version mismatch.");
        }

        project.setArchived(false);
        if (project.getPreviousLifecycle() != null && !project.getPreviousLifecycle().isBlank()) {
            project.setLifecycle(project.getPreviousLifecycle());
            project.setStatus(project.getPreviousLifecycle());
        }
        project.setUpdatedAt(Instant.now());
        projectRepository.save(project);

        changeRecorder.recordChange(
                orgId, principal.userId(), "project.restore", "PROJECT", project.getId(),
                Map.of("project_id", project.getId(), "restored_lifecycle", project.getLifecycle()),
                "Project", project.getId(), "ProjectRestored", project.getVersion(),
                Map.of("project_id", project.getId())
        );

        return toResponse(project, List.of());
    }

    /* ------------------------------------------------------------------
     * 6. Member Management
     * ------------------------------------------------------------------ */

    @Transactional
    public ProjectDTOs.ProjectMemberResponse addMember(
            UUID orgId,
            String projectId,
            ProjectDTOs.ProjectMemberRequest req,
            Authentication auth) {

        permissionService.require(auth, orgId, PermissionKey.PROJECT_EDIT.value());
        AuthPrincipal principal = permissionService.principal(auth);
        ProjectEntity project = findVisibleProject(orgId, projectId, auth);

        // Verify membership belongs to this org
        UUID membershipId = req.membershipId();
        Integer active = jdbc.queryForObject(
                "SELECT count(*) FROM memberships WHERE id = ? AND org_id = ? AND status = 'ACTIVE'",
                Integer.class, membershipId, orgId);
        if (active == null || active == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FOREIGN_OWNER", "Membership does not exist or is not active in this organization.");
        }

        Optional<ProjectMemberEntity> existing = memberRepository.findByOrgIdAndProjectIdAndMembershipId(orgId, projectId, membershipId);
        if (existing.isPresent()) {
            ProjectMemberEntity e = existing.get();
            e.setRole(req.role() != null ? req.role() : "MEMBER");
            memberRepository.save(e);
            return toMemberResponse(e);
        }

        ProjectMemberEntity member = new ProjectMemberEntity(orgId, projectId, membershipId, req.role() != null ? req.role() : "MEMBER");
        memberRepository.save(member);

        // Update member_ids on ProjectEntity
        Set<String> memberSet = project.getMemberIds() != null && !project.getMemberIds().isBlank()
                ? new HashSet<>(Arrays.asList(project.getMemberIds().split(",")))
                : new HashSet<>();
        memberSet.add(membershipId.toString());
        project.setMemberIds(String.join(",", memberSet));
        projectRepository.save(project);

        changeRecorder.recordChange(
                orgId, principal.userId(), "project.member.add", "PROJECT", project.getId(),
                Map.of("membership_id", String.valueOf(membershipId), "role", member.getRole()),
                "Project", project.getId(), "ProjectMemberAdded", project.getVersion(),
                Map.of("membership_id", String.valueOf(membershipId))
        );

        return toMemberResponse(member);
    }

    @Transactional
    public void removeMember(UUID orgId, String projectId, UUID membershipId, Authentication auth) {
        permissionService.require(auth, orgId, PermissionKey.PROJECT_EDIT.value());
        AuthPrincipal principal = permissionService.principal(auth);
        ProjectEntity project = findVisibleProject(orgId, projectId, auth);

        memberRepository.deleteByOrgIdAndProjectIdAndMembershipId(orgId, projectId, membershipId);

        if (project.getMemberIds() != null) {
            List<String> list = Arrays.stream(project.getMemberIds().split(","))
                    .filter(id -> !id.trim().equals(membershipId.toString()))
                    .collect(Collectors.toList());
            project.setMemberIds(String.join(",", list));
            projectRepository.save(project);
        }

        changeRecorder.recordChange(
                orgId, principal.userId(), "project.member.remove", "PROJECT", project.getId(),
                Map.of("membership_id", String.valueOf(membershipId)),
                "Project", project.getId(), "ProjectMemberRemoved", project.getVersion(),
                Map.of("membership_id", String.valueOf(membershipId))
        );
    }

    @Transactional(readOnly = true)
    public List<ProjectDTOs.ProjectMemberResponse> listMembers(UUID orgId, String projectId, Authentication auth) {
        findVisibleProject(orgId, projectId, auth);
        List<ProjectMemberEntity> members = memberRepository.findByOrgIdAndProjectId(orgId, projectId);
        return members.stream().map(this::toMemberResponse).toList();
    }

    /* ------------------------------------------------------------------
     * Helper Methods
     * ------------------------------------------------------------------ */

    public ProjectEntity findVisibleProject(UUID orgId, String projectId, Authentication auth) {
        if (projectId == null || projectId.isBlank()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Project ID is required.");
        }
        ProjectEntity project = projectRepository.findByIdAndOrgId(projectId, orgId).orElse(null);
        if (project == null) {
            evidenceService.recordDenied(
                    permissionService.principal(auth),
                    SecurityEvidenceService.ACCESS_DENIED,
                    "PROJECT",
                    projectId,
                    "Project not found in current organization"
            );
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Project not found.");
        }

        if (!permissionService.canOnProject(auth, orgId, project.getId(), PermissionKey.PROJECT_READ.value())) {
            evidenceService.recordDenied(
                    permissionService.principal(auth),
                    SecurityEvidenceService.ACCESS_DENIED,
                    "PROJECT",
                    projectId,
                    "Caller lacks project.read permission"
            );
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Project not found.");
        }

        return project;
    }

    /**
     * Resolves a user ID or membership ID to an active user ID within the organization.
     * Rejects foreign members/owners (T09).
     */
    private String resolveAndValidateOrgMember(UUID orgId, String candidate, String fieldName) {
        if (candidate == null || candidate.isBlank()) return null;
        UUID parsedUuid;
        try {
            parsedUuid = UUID.fromString(candidate.trim());
        } catch (IllegalArgumentException e) {
            // Check if string matches user email or legacy text id in org
            List<UUID> matching = jdbc.query(
                    "SELECT m.user_id FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND m.status = 'ACTIVE' AND (u.email = ? OR u.name = ?)",
                    (rs, rowNum) -> rs.getObject("user_id", UUID.class),
                    orgId, candidate.trim(), candidate.trim());
            if (!matching.isEmpty()) {
                return matching.get(0).toString();
            }
            throw new ApiException(HttpStatus.BAD_REQUEST, "FOREIGN_OWNER", "User for " + fieldName + " does not belong to this organization.");
        }

        // Check if parsedUuid is a user_id or membership_id in this org
        Integer count = jdbc.queryForObject(
                "SELECT count(*) FROM memberships WHERE org_id = ? AND status = 'ACTIVE' AND (user_id = ? OR id = ?)",
                Integer.class, orgId, parsedUuid, parsedUuid);

        if (count == null || count == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FOREIGN_OWNER", "The " + fieldName + " must belong to this organization.");
        }

        // Return user_id
        List<UUID> userIds = jdbc.query(
                "SELECT user_id FROM memberships WHERE org_id = ? AND status = 'ACTIVE' AND (user_id = ? OR id = ?) LIMIT 1",
                (rs, rowNum) -> rs.getObject("user_id", UUID.class),
                orgId, parsedUuid, parsedUuid);

        return userIds.isEmpty() ? parsedUuid.toString() : userIds.get(0).toString();
    }

    private UUID lookupMembershipId(UUID orgId, String userIdOrMembershipId) {
        try {
            UUID id = UUID.fromString(userIdOrMembershipId);
            List<UUID> mIds = jdbc.query(
                    "SELECT id FROM memberships WHERE org_id = ? AND (id = ? OR user_id = ?) LIMIT 1",
                    (rs, rowNum) -> rs.getObject("id", UUID.class),
                    orgId, id, id);
            return mIds.isEmpty() ? null : mIds.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    private ProjectDTOs.ProjectResponse toResponse(ProjectEntity p, List<ProjectDTOs.ProjectDateHistoryDTO> dateHistories) {
        List<String> teamIds = p.getTeamIds() != null && !p.getTeamIds().isBlank()
                ? Arrays.asList(p.getTeamIds().split(","))
                : List.of();
        List<String> memberIds = p.getMemberIds() != null && !p.getMemberIds().isBlank()
                ? Arrays.asList(p.getMemberIds().split(","))
                : List.of();

        return new ProjectDTOs.ProjectResponse(
                p.getId(),
                p.getOrgId(),
                p.getKey(),
                p.getName(),
                p.getDescription(),
                p.getMode(),
                p.getLifecycle(),
                p.getPriority(),
                p.getProjectManagerId(),
                p.getAccountableDeveloperId(),
                teamIds,
                memberIds,
                p.getStartDate(),
                p.getTargetDate(),
                p.getTimezone(),
                p.getLastProgressPercent() != null ? p.getLastProgressPercent() : BigDecimal.ZERO,
                p.getHealth() != null ? p.getHealth() : "ON_TRACK",
                p.isArchived(),
                p.getVersion() != null ? p.getVersion() : 0L,
                p.getCreatedAt(),
                p.getUpdatedAt(),
                dateHistories
        );
    }

    private ProjectDTOs.ProjectMemberResponse toMemberResponse(ProjectMemberEntity m) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT m.user_id, u.name, u.email
                FROM memberships m
                LEFT JOIN users u ON u.id = m.user_id
                WHERE m.id = ?
                """, m.getMembershipId());

        UUID userId = null;
        String name = "Member";
        String email = "";
        if (!rows.isEmpty()) {
            userId = (UUID) rows.get(0).get("user_id");
            name = (String) rows.get(0).get("name");
            email = (String) rows.get(0).get("email");
        }

        return new ProjectDTOs.ProjectMemberResponse(
                m.getId(),
                m.getProjectId(),
                m.getMembershipId(),
                userId,
                name,
                email,
                m.getRole(),
                m.getCreatedAt()
        );
    }

    /* ------------------------------------------------------------------
     * 10. Get Eligible Members for Project Roles
     * ------------------------------------------------------------------ */

    @Transactional(readOnly = true)
    public ProjectDTOs.EligibleMembersResponse getEligibleMembers(UUID orgId, Authentication auth) {
        permissionService.require(auth, orgId, PermissionKey.PROJECT_READ.value());

        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT m.user_id, u.name, u.email, COALESCE(r.name, m.role_template, u.role, 'Member') as role_name
                FROM memberships m
                JOIN users u ON u.id = m.user_id
                LEFT JOIN roles r ON r.id = m.role_id
                WHERE m.org_id = ? AND m.status = 'ACTIVE'
                ORDER BY u.name ASC
                """, orgId);

        List<ProjectDTOs.EligibleMemberDTO> owners = new ArrayList<>();
        List<ProjectDTOs.EligibleMemberDTO> managers = new ArrayList<>();
        List<ProjectDTOs.EligibleMemberDTO> developers = new ArrayList<>();
        List<ProjectDTOs.EligibleMemberDTO> allMembers = new ArrayList<>();

        for (Map<String, Object> row : rows) {
            String userId = row.get("user_id") != null ? row.get("user_id").toString() : "";
            String name = (String) row.get("name");
            String email = (String) row.get("email");
            String roleName = row.get("role_name") != null ? (String) row.get("role_name") : "Member";

            ProjectDTOs.EligibleMemberDTO dto = new ProjectDTOs.EligibleMemberDTO(userId, name, email, roleName, roleName);
            allMembers.add(dto);

            String lowerRole = roleName.toLowerCase(Locale.ROOT);
            if (lowerRole.contains("owner") || lowerRole.contains("admin")) {
                owners.add(dto);
                managers.add(dto);
            } else if (lowerRole.contains("manager") || lowerRole.contains("lead")) {
                managers.add(dto);
            } else if (lowerRole.contains("developer") || lowerRole.contains("engineer")) {
                developers.add(dto);
            } else {
                developers.add(dto);
                managers.add(dto);
            }
        }

        if (owners.isEmpty()) owners.addAll(allMembers);
        if (managers.isEmpty()) managers.addAll(allMembers);
        if (developers.isEmpty()) developers.addAll(allMembers);

        return new ProjectDTOs.EligibleMembersResponse(owners, managers, developers, allMembers);
    }
}
