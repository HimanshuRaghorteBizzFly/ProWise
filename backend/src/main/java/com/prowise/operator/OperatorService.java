package com.prowise.operator;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;
import com.prowise.operator.auth.OperatorAuthService;

@Service
@Transactional
public class OperatorService {

    private final PlatformOperatorRepository operatorRepository;
    private final OperatorDepartmentRepository departmentRepository;
    private final OperatorDepartmentPermissionRepository departmentPermissionRepository;
    private final OperatorOverrideRepository overrideRepository;
    private final OperatorSessionRepository sessionRepository;
    private final OperatorAuditLogRepository auditLogRepository;
    private final OperatorInvitationRepository invitationRepository;
    private final PasswordEncoder passwordEncoder;

    public OperatorService(
            PlatformOperatorRepository operatorRepository,
            OperatorDepartmentRepository departmentRepository,
            OperatorDepartmentPermissionRepository departmentPermissionRepository,
            OperatorOverrideRepository overrideRepository,
            OperatorSessionRepository sessionRepository,
            OperatorAuditLogRepository auditLogRepository
    ) {
        this(
                operatorRepository,
                departmentRepository,
                departmentPermissionRepository,
                overrideRepository,
                sessionRepository,
                auditLogRepository,
                null,
                new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder()
        );
    }

    public OperatorService(
            PlatformOperatorRepository operatorRepository,
            OperatorDepartmentRepository departmentRepository,
            OperatorDepartmentPermissionRepository departmentPermissionRepository,
            OperatorOverrideRepository overrideRepository,
            OperatorSessionRepository sessionRepository,
            OperatorAuditLogRepository auditLogRepository,
            OperatorInvitationRepository invitationRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.operatorRepository = operatorRepository;
        this.departmentRepository = departmentRepository;
        this.departmentPermissionRepository = departmentPermissionRepository;
        this.overrideRepository = overrideRepository;
        this.sessionRepository = sessionRepository;
        this.auditLogRepository = auditLogRepository;
        this.invitationRepository = invitationRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<OperatorDTOs.OperatorResponse> listOperators(String search, String department, String roleId, String status) {
        String safeQuery = (search != null && !search.trim().isEmpty()) ? search.trim() : null;
        String safeDept = (department != null && !department.equals("ALL")) ? department : null;
        String safeRole = (roleId != null && !roleId.equals("ALL")) ? roleId : null;
        String safeStatus = (status != null && !status.equals("ALL")) ? status : null;

        List<PlatformOperatorEntity> list = operatorRepository.searchOperators(safeDept, safeRole, safeStatus, safeQuery);
        return list.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public OperatorDTOs.OperatorResponse getOperator(String id) {
        PlatformOperatorEntity op = operatorRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Operator not found: " + id));
        return toResponse(op);
    }

    public OperatorDTOs.OperatorResponse createOperator(OperatorDTOs.CreateOperatorRequest req, String actor) {
        if (req.email() == null || !req.email().contains("@")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "Valid corporate email is required.");
        }
        if (operatorRepository.findByEmailIgnoreCase(req.email().trim()).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, ErrorCodes.VALIDATION_FAILED, "Operator with this email already exists.");
        }

        OperatorAccessLevel accessLevel = OperatorAccessLevel.fromString(req.accessLevel());
        String deptId = (accessLevel == OperatorAccessLevel.MAIN_PLATFORM_OPERATOR && (req.department() == null || req.department().isBlank()))
                ? null
                : OperatorDepartment.fromId(req.department()).getId();

        PlatformOperatorEntity entity = new PlatformOperatorEntity();
        entity.setId("op-" + UUID.randomUUID().toString().substring(0, 8));
        entity.setName(req.name() != null ? req.name().trim() : "New Operator");
        entity.setEmail(req.email().trim().toLowerCase());
        entity.setRoleId(req.roleId() != null ? req.roleId() : "role-platform-operator");
        entity.setAccessLevel(accessLevel);
        entity.setDepartmentId(deptId);
        entity.setStatus(req.status() != null ? req.status() : "INVITED");
        entity.setMfaEnabled(req.mfaEnabled() != null ? req.mfaEnabled() : true);
        entity.setOnCall(req.onCall() != null ? req.onCall() : false);
        entity.setShiftName(req.shiftName() != null ? req.shiftName() : "Americas Primary (08:00 - 17:00)");
        if (passwordEncoder != null) {
            entity.setPasswordHash(passwordEncoder.encode("Operator2026!"));
            entity.setPasswordSetupCompleted(false);
        }
        entity.setLastActiveAt(Instant.now());
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());

        PlatformOperatorEntity saved = operatorRepository.save(entity);

        if (invitationRepository != null) {
            String rawInviteToken = OperatorAuthService.randomToken();
            invitationRepository.save(new OperatorInvitationEntity(
                    saved.getId(),
                    saved.getEmail(),
                    OperatorAuthService.hash(rawInviteToken),
                    Instant.now().plus(7, ChronoUnit.DAYS)
            ));
        }

        auditLogRepository.save(new OperatorAuditLogEntity(
                saved.getId(), actor, "OPERATOR_CREATED", "operators",
                "Created new operator " + saved.getName() + " in department " + saved.getDepartmentId()
        ));

        return toResponse(saved);
    }

    public OperatorDTOs.OperatorResponse updateOperator(String id, OperatorDTOs.UpdateOperatorRequest req, String actor) {
        PlatformOperatorEntity op = operatorRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Operator not found: " + id));

        // Prevent deactivating or changing role of last active super admin
        if ("role-super-admin".equalsIgnoreCase(op.getRoleId())) {
            if (req.status() != null && !"ACTIVE".equalsIgnoreCase(req.status())) {
                assertNotLastActiveSuperAdmin(id);
            }
        }

        if (req.name() != null && !req.name().trim().isEmpty()) {
            op.setName(req.name().trim());
        }
        if (req.email() != null && !req.email().trim().isEmpty()) {
            op.setEmail(req.email().trim().toLowerCase());
        }
        if (req.roleId() != null && !req.roleId().trim().isEmpty()) {
            op.setRoleId(req.roleId().trim());
        }
        if (req.accessLevel() != null && !req.accessLevel().trim().isEmpty()) {
            OperatorAccessLevel newLevel = OperatorAccessLevel.fromString(req.accessLevel());
            if (op.getAccessLevel() != newLevel) {
                op.setAccessLevel(newLevel);
                if (newLevel == OperatorAccessLevel.MAIN_PLATFORM_OPERATOR && (req.department() == null || req.department().isBlank())) {
                    op.setDepartmentId(null);
                }
                sessionRepository.revokeAllByOperatorId(id, "ACCESS_LEVEL_CHANGED: " + newLevel);
                auditLogRepository.save(new OperatorAuditLogEntity(
                        id, actor, "ACCESS_LEVEL_CHANGED", "access_level",
                        "Access level changed to " + newLevel
                ));
            }
        }
        if (req.department() != null && !req.department().trim().isEmpty()) {
            String oldDept = op.getDepartmentId();
            String newDept = OperatorDepartment.fromId(req.department()).getId();
            if (oldDept == null || !oldDept.equals(newDept)) {
                op.setDepartmentId(newDept);
                sessionRepository.revokeAllByOperatorId(id, "DEPARTMENT_CHANGED: " + newDept);
                auditLogRepository.save(new OperatorAuditLogEntity(
                        id, actor, "DEPARTMENT_CHANGED", "department",
                        "Department changed from " + oldDept + " to " + newDept
                ));
            }
        }
        if (req.status() != null) {
            op.setStatus(req.status());
        }
        if (req.mfaEnabled() != null) {
            op.setMfaEnabled(req.mfaEnabled());
        }
        if (req.onCall() != null) {
            op.setOnCall(req.onCall());
        }
        if (req.shiftName() != null) {
            op.setShiftName(req.shiftName());
        }
        op.setUpdatedAt(Instant.now());

        PlatformOperatorEntity updated = operatorRepository.save(op);

        auditLogRepository.save(new OperatorAuditLogEntity(
                id, actor, "OPERATOR_UPDATED", "operators", "Updated details for " + updated.getName()
        ));

        return toResponse(updated);
    }

    public OperatorDTOs.OperatorResponse updateAccessLevel(String id, String targetLevel, String actor) {
        PlatformOperatorEntity op = operatorRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Operator not found: " + id));

        OperatorAccessLevel newLevel = OperatorAccessLevel.fromString(targetLevel);
        if (op.getAccessLevel() != newLevel) {
            op.setAccessLevel(newLevel);
            if (newLevel == OperatorAccessLevel.MAIN_PLATFORM_OPERATOR) {
                op.setDepartmentId(null);
            }
            op.setUpdatedAt(Instant.now());
            PlatformOperatorEntity saved = operatorRepository.save(op);
            sessionRepository.revokeAllByOperatorId(id, "ACCESS_LEVEL_CHANGED: " + newLevel);
            auditLogRepository.save(new OperatorAuditLogEntity(
                    id, actor, "ACCESS_LEVEL_CHANGED", "access_level",
                    "Access level changed to " + newLevel
            ));
            return toResponse(saved);
        }
        return toResponse(op);
    }

    public OperatorDTOs.OperatorResponse updateDepartment(String id, String newDepartment, String actor) {
        PlatformOperatorEntity op = operatorRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Operator not found: " + id));

        String targetDept = OperatorDepartment.fromId(newDepartment).getId();
        if (op.getDepartmentId() == null || !op.getDepartmentId().equals(targetDept)) {
            op.setDepartmentId(targetDept);
            op.setUpdatedAt(Instant.now());
            PlatformOperatorEntity saved = operatorRepository.save(op);
            sessionRepository.revokeAllByOperatorId(id, "DEPARTMENT_CHANGED: " + targetDept);
            auditLogRepository.save(new OperatorAuditLogEntity(
                    id, actor, "DEPARTMENT_CHANGED", "department",
                    "Department changed to " + targetDept
            ));
            return toResponse(saved);
        }
        return toResponse(op);
    }

    public OperatorDTOs.OperatorResponse toggleOperatorStatus(String id, String actor) {
        PlatformOperatorEntity op = operatorRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Operator not found: " + id));

        String targetStatus = "ACTIVE".equalsIgnoreCase(op.getStatus()) ? "INACTIVE" : "ACTIVE";

        if ("INACTIVE".equals(targetStatus)) {
            assertNotLastActiveSuperAdmin(id);
            sessionRepository.revokeAllByOperatorId(id, actor);
        }

        op.setStatus(targetStatus);
        op.setUpdatedAt(Instant.now());
        PlatformOperatorEntity saved = operatorRepository.save(op);

        auditLogRepository.save(new OperatorAuditLogEntity(
                id, actor, "STATUS_TOGGLED", "operators", "Operator status changed to " + targetStatus
        ));

        return toResponse(saved);
    }

    public void deleteOperator(String id, String actor) {
        PlatformOperatorEntity op = operatorRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Operator not found: " + id));

        assertNotLastActiveSuperAdmin(id);

        sessionRepository.revokeAllByOperatorId(id, actor);
        overrideRepository.deleteByOperatorId(id);
        operatorRepository.delete(op);

        auditLogRepository.save(new OperatorAuditLogEntity(
                id, actor, "OPERATOR_DELETED", "operators", "Operator " + op.getName() + " (" + op.getEmail() + ") deleted"
        ));
    }

    private void assertNotLastActiveSuperAdmin(String targetOperatorId) {
        PlatformOperatorEntity op = operatorRepository.findById(targetOperatorId).orElse(null);
        if (op != null && "role-super-admin".equalsIgnoreCase(op.getRoleId())) {
            long superAdminCount = operatorRepository.countByRoleIdAndStatus("role-super-admin", "ACTIVE");
            if (superAdminCount <= 1 && "ACTIVE".equalsIgnoreCase(op.getStatus())) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        ErrorCodes.VALIDATION_FAILED,
                        "Action rejected: Cannot delete or deactivate the last active Super Administrator."
                );
            }
        }
    }

    @Transactional(readOnly = true)
    public OperatorDTOs.EffectivePermissionsResponse getEffectivePermissions(String operatorId) {
        PlatformOperatorEntity op = operatorRepository.findById(operatorId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Operator not found: " + operatorId));

        OperatorDepartment dept = OperatorDepartment.fromId(op.getDepartmentId());
        boolean isMain = op.getAccessLevel() == OperatorAccessLevel.MAIN_PLATFORM_OPERATOR;
        String deptDisplayName = (isMain && op.getDepartmentId() == null) ? "All Operational Departments" : dept.getDisplayName();

        // Get department defaults
        List<OperatorDepartmentPermissionEntity> deptPerms = departmentPermissionRepository.findByDepartmentId(dept.getId());
        Set<String> deptDefaultActionPairs = new HashSet<>();
        for (OperatorDepartmentPermissionEntity p : deptPerms) {
            deptDefaultActionPairs.add(p.getModuleKey() + ":" + p.getPermissionAction());
        }

        // Get individual overrides
        List<OperatorPermissionOverrideEntity> overrides = overrideRepository.findByOperatorId(operatorId);
        Map<String, String> overrideMap = new HashMap<>(); // "module:action" -> "GRANT" / "DENY"
        for (OperatorPermissionOverrideEntity ov : overrides) {
            overrideMap.put(ov.getModuleKey() + ":" + ov.getPermissionAction(), ov.getOverrideType());
        }

        List<OperatorDTOs.PermissionItem> items = new ArrayList<>();
        int allowedCount = 0;
        int deniedCount = 0;
        int grantCount = 0;

        // Modules catalog
        List<String> allModules = List.of(
                "operations.dashboard", "operations.org_status", "operations.monitoring",
                "incidents.management", "support.tickets", "support.access_requests",
                "integrations.health", "integrations.github", "integrations.webhooks",
                "integrations.failed_events", "integrations.sync_jobs", "integrations.api_errors",
                "communications.email_delivery", "communications.email_drafts", "communications.announcements",
                "billing.subscriptions", "billing.payment_failures", "billing.invoices",
                "system.backups", "system.maintenance", "system.alerts",
                "audit.activity_logs", "audit.security_monitoring", "account.settings"
        );

        List<String> actions = List.of("view", "create", "edit", "delete", "execute");

        for (String mod : allModules) {
            for (String act : actions) {
                String pair = mod + ":" + act;
                boolean isDeptDefault = isMain || deptDefaultActionPairs.contains(pair);
                String overrideType = overrideMap.get(pair);

                String state = "NOT_ASSIGNED";
                boolean allowed = false;

                if ("DENY".equals(overrideType)) {
                    state = "INDIVIDUAL_DENY";
                    allowed = false;
                    deniedCount++;
                } else if ("GRANT".equals(overrideType)) {
                    state = "INDIVIDUAL_GRANT";
                    allowed = true;
                    grantCount++;
                    allowedCount++;
                } else if (isDeptDefault) {
                    state = "DEPARTMENT_DEFAULT";
                    allowed = true;
                    allowedCount++;
                }

                items.add(new OperatorDTOs.PermissionItem(mod, act, state, allowed));
            }
        }

        return new OperatorDTOs.EffectivePermissionsResponse(
                op.getId(), op.getName(), deptDisplayName,
                items, allowedCount, deniedCount, grantCount
        );
    }

    public OperatorDTOs.EffectivePermissionsResponse updatePermissions(
            String operatorId, OperatorDTOs.UpdatePermissionsPayload payload, String actor
    ) {
        PlatformOperatorEntity op = operatorRepository.findById(operatorId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Operator not found: " + operatorId));

        if (payload.resetToDefaults()) {
            overrideRepository.deleteByOperatorId(operatorId);
            auditLogRepository.save(new OperatorAuditLogEntity(
                    operatorId, actor, "PERMISSIONS_RESET", "permissions",
                    "Reset permissions to department defaults for " + op.getName()
            ));
        } else if (payload.overrides() != null) {
            for (OperatorDTOs.PermissionOverrideRequest req : payload.overrides()) {
                if ("RESET".equalsIgnoreCase(req.overrideType())) {
                    overrideRepository.findByOperatorIdAndModuleKeyAndPermissionAction(
                            operatorId, req.moduleKey(), req.action()
                    ).ifPresent(overrideRepository::delete);
                } else {
                    Optional<OperatorPermissionOverrideEntity> existing = overrideRepository
                            .findByOperatorIdAndModuleKeyAndPermissionAction(operatorId, req.moduleKey(), req.action());

                    if (existing.isPresent()) {
                        OperatorPermissionOverrideEntity ov = existing.get();
                        ov.setOverrideType(req.overrideType().toUpperCase());
                        ov.setReason(req.reason());
                        ov.setGrantedBy(actor);
                        overrideRepository.save(ov);
                    } else {
                        overrideRepository.save(new OperatorPermissionOverrideEntity(
                                operatorId, req.moduleKey(), req.action(),
                                req.overrideType().toUpperCase(), actor, req.reason()
                        ));
                    }
                }
            }

            auditLogRepository.save(new OperatorAuditLogEntity(
                    operatorId, actor, "PERMISSIONS_UPDATED", "permissions",
                    "Custom permission overrides updated for " + op.getName()
            ));
        }

        // Revoke active sessions to enforce permission cache invalidation
        sessionRepository.revokeAllByOperatorId(operatorId, actor);

        return getEffectivePermissions(operatorId);
    }

    public void revokeActiveSessions(String operatorId, String actor) {
        int count = sessionRepository.revokeAllByOperatorId(operatorId, actor);
        auditLogRepository.save(new OperatorAuditLogEntity(
                operatorId, actor, "SESSIONS_REVOKED", "security",
                "Revoked all active sessions (" + count + " sessions invalidated) for operator " + operatorId
        ));
    }

    public void resendInvitation(String operatorId, String actor) {
        PlatformOperatorEntity op = operatorRepository.findById(operatorId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Operator not found: " + operatorId));

        if (invitationRepository != null) {
            String rawInviteToken = OperatorAuthService.randomToken();
            invitationRepository.save(new OperatorInvitationEntity(
                    op.getId(),
                    op.getEmail(),
                    OperatorAuthService.hash(rawInviteToken),
                    Instant.now().plus(7, ChronoUnit.DAYS)
            ));
        }

        auditLogRepository.save(new OperatorAuditLogEntity(
                operatorId, actor, "INVITATION_RESENT", "operators",
                "Resent platform operator invitation email to " + op.getEmail()
        ));
    }

    public OperatorDTOs.OperatorResponse updateOperatorStatus(String id, String targetStatus, String actor) {
        PlatformOperatorEntity op = operatorRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Operator not found: " + id));

        String status = (targetStatus != null && !targetStatus.isBlank()) ? targetStatus.trim().toUpperCase() : "ACTIVE";

        if ("INACTIVE".equalsIgnoreCase(status) || "SUSPENDED".equalsIgnoreCase(status)) {
            assertNotLastActiveSuperAdmin(id);
            sessionRepository.revokeAllByOperatorId(id, actor);
        }

        op.setStatus(status);
        op.setUpdatedAt(Instant.now());
        PlatformOperatorEntity saved = operatorRepository.save(op);

        auditLogRepository.save(new OperatorAuditLogEntity(
                id, actor, "STATUS_UPDATED", "operators", "Operator status set to " + status
        ));

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public OperatorDTOs.OperatorResponse getCurrentOperatorProfile(String email) {
        PlatformOperatorEntity op = operatorRepository.findByEmailIgnoreCase(email)
                .or(() -> operatorRepository.findById("op-2"))
                .orElseGet(() -> operatorRepository.findAll().stream().findFirst()
                        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "No operator profile available")));
        return toResponse(op);
    }

    @Transactional(readOnly = true)
    public OperatorDTOs.OperatorNavigationResponse getNavigationRoutes(String email) {
        PlatformOperatorEntity op = operatorRepository.findByEmailIgnoreCase(email)
                .or(() -> operatorRepository.findById("op-2"))
                .orElse(null);

        boolean isMain = op != null && op.getAccessLevel() == OperatorAccessLevel.MAIN_PLATFORM_OPERATOR;
        String deptId = (op != null && op.getDepartmentId() != null) ? op.getDepartmentId() : "platform-operations";
        OperatorDepartment dept = OperatorDepartment.fromId(deptId);
        List<String> authorizedModules;

        if (isMain) {
            Set<String> allModules = new HashSet<>();
            for (OperatorDepartment d : OperatorDepartment.values()) {
                allModules.addAll(d.getAuthorizedModules());
            }
            authorizedModules = new ArrayList<>(allModules);
        } else {
            authorizedModules = new ArrayList<>(dept.getAuthorizedModules());
            // Also check if any overrides grant additional view modules
            if (op != null) {
                List<OperatorPermissionOverrideEntity> overrides = overrideRepository.findByOperatorId(op.getId());
                for (OperatorPermissionOverrideEntity ov : overrides) {
                    if ("GRANT".equalsIgnoreCase(ov.getOverrideType()) && "view".equalsIgnoreCase(ov.getPermissionAction())) {
                        if (!authorizedModules.contains(ov.getModuleKey())) {
                            authorizedModules.add(ov.getModuleKey());
                        }
                    } else if ("DENY".equalsIgnoreCase(ov.getOverrideType()) && "view".equalsIgnoreCase(ov.getPermissionAction())) {
                        authorizedModules.remove(ov.getModuleKey());
                    }
                }
            }
        }

        List<OperatorDTOs.NavigationSection> sections = new ArrayList<>();

        // Operations
        List<OperatorDTOs.NavigationModuleItem> opItems = new ArrayList<>();
        if (authorizedModules.contains("operations.dashboard")) {
            opItems.add(new OperatorDTOs.NavigationModuleItem("dashboard", "Operations Dashboard", "/platform-operator/dashboard", "LayoutDashboard", true));
        }
        if (authorizedModules.contains("operations.org_status")) {
            opItems.add(new OperatorDTOs.NavigationModuleItem("org-status", "Organization Service Status", "/platform-operator/organization-status", "Building2", true));
        }
        if (authorizedModules.contains("operations.monitoring")) {
            opItems.add(new OperatorDTOs.NavigationModuleItem("monitoring", "System Monitoring", "/platform-operator/monitoring", "Server", true));
        }
        if (!opItems.isEmpty()) {
            sections.add(new OperatorDTOs.NavigationSection("Operations Overview", opItems));
        }

        // Incidents & Support
        List<OperatorDTOs.NavigationModuleItem> incItems = new ArrayList<>();
        if (authorizedModules.contains("incidents.management")) {
            incItems.add(new OperatorDTOs.NavigationModuleItem("incidents", "Incident Management", "/platform-operator/incidents", "AlertTriangle", true));
        }
        if (authorizedModules.contains("support.tickets")) {
            incItems.add(new OperatorDTOs.NavigationModuleItem("support-tickets", "Support Tickets", "/platform-operator/support-tickets", "LifeBuoy", true));
        }
        if (authorizedModules.contains("support.access_requests")) {
            incItems.add(new OperatorDTOs.NavigationModuleItem("access-requests", "Support Access Requests", "/platform-operator/access-requests", "KeyRound", true));
        }
        if (!incItems.isEmpty()) {
            sections.add(new OperatorDTOs.NavigationSection("Incidents & Support", incItems));
        }

        // Integrations
        List<OperatorDTOs.NavigationModuleItem> intItems = new ArrayList<>();
        if (authorizedModules.contains("integrations.health")) {
            intItems.add(new OperatorDTOs.NavigationModuleItem("integration-health", "Integration Health", "/platform-operator/integration-health", "Plug", true));
        }
        if (authorizedModules.contains("integrations.github")) {
            intItems.add(new OperatorDTOs.NavigationModuleItem("github-monitoring", "GitHub App Monitoring", "/platform-operator/github-monitoring", "GitBranch", true));
        }
        if (authorizedModules.contains("integrations.webhooks")) {
            intItems.add(new OperatorDTOs.NavigationModuleItem("webhook-logs", "Webhook Delivery Logs", "/platform-operator/webhook-logs", "Webhook", true));
        }
        if (authorizedModules.contains("integrations.failed_events")) {
            intItems.add(new OperatorDTOs.NavigationModuleItem("failed-events", "Failed Events & Retries", "/platform-operator/failed-events", "RotateCcw", true));
        }
        if (authorizedModules.contains("integrations.sync_jobs")) {
            intItems.add(new OperatorDTOs.NavigationModuleItem("sync-jobs", "Sync Jobs & Queues", "/platform-operator/sync-jobs", "RefreshCw", true));
        }
        if (authorizedModules.contains("integrations.api_errors")) {
            intItems.add(new OperatorDTOs.NavigationModuleItem("api-errors", "API Error Monitoring", "/platform-operator/api-errors", "Activity", true));
        }
        if (!intItems.isEmpty()) {
            sections.add(new OperatorDTOs.NavigationSection("Integration Operations", intItems));
        }

        // Communications
        List<OperatorDTOs.NavigationModuleItem> commItems = new ArrayList<>();
        if (authorizedModules.contains("communications.email_delivery")) {
            commItems.add(new OperatorDTOs.NavigationModuleItem("email-delivery", "Email Delivery & SMTP Health", "/platform-operator/email-delivery", "Mail", true));
        }
        if (authorizedModules.contains("communications.email_drafts")) {
            commItems.add(new OperatorDTOs.NavigationModuleItem("email-drafts", "Email Template Drafts", "/platform-operator/email-drafts", "MailPlus", true));
        }
        if (authorizedModules.contains("communications.announcements")) {
            commItems.add(new OperatorDTOs.NavigationModuleItem("announcement-drafts", "Announcement Drafts", "/platform-operator/announcement-drafts", "Megaphone", true));
        }
        if (!commItems.isEmpty()) {
            sections.add(new OperatorDTOs.NavigationSection("Communication Operations", commItems));
        }

        // Billing
        List<OperatorDTOs.NavigationModuleItem> billItems = new ArrayList<>();
        if (authorizedModules.contains("billing.subscriptions")) {
            billItems.add(new OperatorDTOs.NavigationModuleItem("subscription-status", "Subscription Status", "/platform-operator/subscription-status", "ShieldCheck", true));
        }
        if (authorizedModules.contains("billing.payment_failures")) {
            billItems.add(new OperatorDTOs.NavigationModuleItem("payment-failures", "Payment Failures", "/platform-operator/payment-failures", "FileWarning", true));
        }
        if (authorizedModules.contains("billing.invoices")) {
            billItems.add(new OperatorDTOs.NavigationModuleItem("invoice-delivery", "Invoice Delivery", "/platform-operator/invoice-delivery", "CreditCard", true));
        }
        if (!billItems.isEmpty()) {
            sections.add(new OperatorDTOs.NavigationSection("Billing Operations", billItems));
        }

        // System
        List<OperatorDTOs.NavigationModuleItem> sysItems = new ArrayList<>();
        if (authorizedModules.contains("system.backups")) {
            sysItems.add(new OperatorDTOs.NavigationModuleItem("backups", "Backup Monitoring", "/platform-operator/backups", "DatabaseBackup", true));
        }
        if (authorizedModules.contains("system.maintenance")) {
            sysItems.add(new OperatorDTOs.NavigationModuleItem("maintenance", "Maintenance Operations", "/platform-operator/maintenance", "Wrench", true));
        }
        if (authorizedModules.contains("system.alerts")) {
            sysItems.add(new OperatorDTOs.NavigationModuleItem("alerts", "Alerts & Notifications", "/platform-operator/alerts", "Bell", true));
        }
        if (!sysItems.isEmpty()) {
            sections.add(new OperatorDTOs.NavigationSection("System Operations", sysItems));
        }

        // Account & Audit
        List<OperatorDTOs.NavigationModuleItem> auditItems = new ArrayList<>();
        if (authorizedModules.contains("audit.activity_logs")) {
            auditItems.add(new OperatorDTOs.NavigationModuleItem("activity-logs", "Operational Activity Logs", "/platform-operator/activity-logs", "History", true));
        }
        auditItems.add(new OperatorDTOs.NavigationModuleItem("settings", "Operator Settings", "/platform-operator/settings", "Settings", true));
        sections.add(new OperatorDTOs.NavigationSection("Account & Audit", auditItems));

        return new OperatorDTOs.OperatorNavigationResponse(
                (op != null) ? op.getId() : "op-2",
                dept.getDisplayName(),
                sections
        );
    }

    @Transactional(readOnly = true)
    public OperatorDTOs.OperatorDashboardResponse getDashboardSummary(String email) {
        PlatformOperatorEntity op = operatorRepository.findByEmailIgnoreCase(email)
                .or(() -> operatorRepository.findById("op-2"))
                .orElse(null);

        String deptId = (op != null) ? op.getDepartmentId() : "site-reliability";
        OperatorDepartment dept = OperatorDepartment.fromId(deptId);

        List<OperatorDTOs.DashboardMetric> kpis = new ArrayList<>();
        Map<String, Object> data = new HashMap<>();

        switch (dept) {
            case SITE_RELIABILITY -> {
                kpis.add(new OperatorDTOs.DashboardMetric("System Uptime", "99.98%", "+0.02%", "emerald"));
                kpis.add(new OperatorDTOs.DashboardMetric("p99 API Latency", "142 ms", "-18 ms", "emerald"));
                kpis.add(new OperatorDTOs.DashboardMetric("Failed Webhooks", "4", "2 Retrying", "amber"));
                kpis.add(new OperatorDTOs.DashboardMetric("Active Incidents", "1", "Sev-2 Investigating", "rose"));
                data.put("backupStatus", "All 6 database snapshots verified OK");
                data.put("queueLag", "18 ms avg processing delay");
            }
            case LIFECYCLE_MESSAGING -> {
                kpis.add(new OperatorDTOs.DashboardMetric("Emails Delivered", "148,290", "99.4% rate", "emerald"));
                kpis.add(new OperatorDTOs.DashboardMetric("SMTP Bounce Rate", "0.38%", "-0.05%", "emerald"));
                kpis.add(new OperatorDTOs.DashboardMetric("Pending Drafts", "3", "Awaiting review", "blue"));
                kpis.add(new OperatorDTOs.DashboardMetric("Active Alerts", "0", "All relays healthy", "emerald"));
                data.put("relayHealth", "SendGrid & AWS SES clusters optimal");
            }
            case REVENUE_OPERATIONS -> {
                kpis.add(new OperatorDTOs.DashboardMetric("Active Subscriptions", "428", "+14 this month", "blue"));
                kpis.add(new OperatorDTOs.DashboardMetric("Failed Payments", "3", "$4,850 at risk", "rose"));
                kpis.add(new OperatorDTOs.DashboardMetric("Pending Invoices", "8", "6 delivered", "amber"));
                kpis.add(new OperatorDTOs.DashboardMetric("Billing Incidents", "0", "Normal processing", "emerald"));
                data.put("recoveryRate", "82% recovered within 48h retry");
            }
            case CUSTOMER_COMMUNICATIONS -> {
                kpis.add(new OperatorDTOs.DashboardMetric("Open Tickets", "12", "3 urgent", "amber"));
                kpis.add(new OperatorDTOs.DashboardMetric("SLA Compliance", "96.4%", "Target > 95%", "emerald"));
                kpis.add(new OperatorDTOs.DashboardMetric("Pending Access Requests", "2", "Require sign-off", "violet"));
                kpis.add(new OperatorDTOs.DashboardMetric("Avg Response Time", "14 min", "-3 min", "emerald"));
                data.put("activeEscalations", "CloudPulse webhook delay ticket in progress");
            }
            case FINANCE_TAX -> {
                kpis.add(new OperatorDTOs.DashboardMetric("Processed Invoices", "$184,200", "Current billing cycle", "emerald"));
                kpis.add(new OperatorDTOs.DashboardMetric("Payment Retries", "3", "Automated smart retry", "amber"));
                kpis.add(new OperatorDTOs.DashboardMetric("Tax Settlements", "100%", "Stripe Tax verified", "emerald"));
                kpis.add(new OperatorDTOs.DashboardMetric("Billing Alerts", "0", "No open gateway faults", "emerald"));
                data.put("auditState", "Ready for Q4 reconciliation");
            }
            case TRUST_COMPLIANCE -> {
                kpis.add(new OperatorDTOs.DashboardMetric("Security Alerts", "1", "Investigating origin", "amber"));
                kpis.add(new OperatorDTOs.DashboardMetric("MFA Enforcement", "100%", "All operators compliant", "emerald"));
                kpis.add(new OperatorDTOs.DashboardMetric("Tenant Access Audits", "14", "Dual-custody verified", "blue"));
                kpis.add(new OperatorDTOs.DashboardMetric("Audit Log Health", "Active", "Zero tampering detected", "emerald"));
                data.put("complianceStatus", "SOC 2 Type II audit controls active");
            }
            default -> {
                kpis.add(new OperatorDTOs.DashboardMetric("Global Availability", "99.96%", "Optimal", "emerald"));
                kpis.add(new OperatorDTOs.DashboardMetric("Active Organizations", "8", "All reporting OK", "blue"));
                kpis.add(new OperatorDTOs.DashboardMetric("Open Incidents", "1", "Under investigation", "amber"));
                kpis.add(new OperatorDTOs.DashboardMetric("Maintenance Mode", "Normal", "Next window Sunday", "emerald"));
                data.put("operationalStatus", "Core Web API & databases operating within thresholds");
            }
        }

        return new OperatorDTOs.OperatorDashboardResponse(
                dept.getId(),
                dept.getDisplayName(),
                kpis,
                dept.getAuthorizedModules(),
                data
        );
    }

    @Transactional(readOnly = true)
    public List<OperatorDTOs.DepartmentResponse> listDepartments() {
        return departmentRepository.findAll().stream().map(d -> {
            int permCount = departmentPermissionRepository.findByDepartmentId(d.getId()).size();
            return new OperatorDTOs.DepartmentResponse(d.getId(), d.getName(), d.getDescription(), permCount);
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<OperatorDTOs.RoleResponse> listRoles() {
        return List.of(
                new OperatorDTOs.RoleResponse("role-super-admin", "Super Administrator", "Full root access across all departments, operators, and platform policies"),
                new OperatorDTOs.RoleResponse("role-platform-operator", "Platform Operator", "Standard department-scoped operator privileges with shift assignment"),
                new OperatorDTOs.RoleResponse("role-incident-commander", "Incident Commander", "Elevated incident response, maintenance window, and status page controls"),
                new OperatorDTOs.RoleResponse("role-compliance-auditor", "Compliance Auditor", "Read-only access to audit logs, security events, and tenant access requests")
        );
    }

    @Transactional(readOnly = true)
    public List<OperatorDTOs.PermissionCatalogItem> listPermissionCatalog() {
        List<String> actions = List.of("view", "create", "edit", "delete", "execute");
        return List.of(
                new OperatorDTOs.PermissionCatalogItem("operations.dashboard", "Operations Dashboard", "Operations", "/platform-operator/dashboard", List.of("view", "execute"), "Main operational telemetry and health overview"),
                new OperatorDTOs.PermissionCatalogItem("operations.org_status", "Organization Service Status", "Operations", "/platform-operator/organization-status", List.of("view", "edit"), "Multi-tenant workspace availability and status tracking"),
                new OperatorDTOs.PermissionCatalogItem("operations.monitoring", "System Monitoring", "Operations", "/platform-operator/monitoring", List.of("view", "execute"), "Cluster latency, resource utilization, and worker queue depths"),
                new OperatorDTOs.PermissionCatalogItem("incidents.management", "Incident Management", "Incidents & Support", "/platform-operator/incidents", List.of("view", "create", "edit", "execute"), "Track Sev-1 through Sev-4 operational platform incidents"),
                new OperatorDTOs.PermissionCatalogItem("support.tickets", "Support Tickets", "Incidents & Support", "/platform-operator/support-tickets", List.of("view", "create", "edit", "execute"), "Escalated customer support tickets and SLA timers"),
                new OperatorDTOs.PermissionCatalogItem("support.access_requests", "Support Access Requests", "Incidents & Support", "/platform-operator/access-requests", List.of("view", "create", "edit", "execute"), "Temporary break-glass tenant support access authorizations"),
                new OperatorDTOs.PermissionCatalogItem("integrations.health", "Integration Health", "Integrations", "/platform-operator/integration-health", List.of("view", "execute"), "Live connectivity for GitHub, Stripe, and SMTP gateways"),
                new OperatorDTOs.PermissionCatalogItem("integrations.github", "GitHub App Monitoring", "Integrations", "/platform-operator/github-monitoring", List.of("view", "execute"), "Installed GitHub Apps, OAuth tokens, and rate limits"),
                new OperatorDTOs.PermissionCatalogItem("integrations.webhooks", "Webhook Delivery Logs", "Integrations", "/platform-operator/webhook-logs", List.of("view", "execute"), "Delivery attempts, HTTP payloads, and signature logs"),
                new OperatorDTOs.PermissionCatalogItem("integrations.failed_events", "Failed Events & Retries", "Integrations", "/platform-operator/failed-events", List.of("view", "execute"), "Dead-letter queues and automated idempotent retries"),
                new OperatorDTOs.PermissionCatalogItem("integrations.sync_jobs", "Sync Jobs & Queues", "Integrations", "/platform-operator/sync-jobs", List.of("view", "execute"), "Background worker queues and scheduled ingestion jobs"),
                new OperatorDTOs.PermissionCatalogItem("integrations.api_errors", "API Error Monitoring", "Integrations", "/platform-operator/api-errors", List.of("view", "execute"), "Endpoint 4xx/5xx burst monitors and latency percentiles"),
                new OperatorDTOs.PermissionCatalogItem("communications.email_delivery", "Email Delivery & SMTP Health", "Communications", "/platform-operator/email-delivery", List.of("view", "execute"), "SendGrid & SES outbound transactional email monitoring"),
                new OperatorDTOs.PermissionCatalogItem("communications.email_drafts", "Email Template Drafts", "Communications", "/platform-operator/email-drafts", actions, "Drafting and testing system notification templates"),
                new OperatorDTOs.PermissionCatalogItem("communications.announcements", "Announcement Drafts", "Communications", "/platform-operator/announcement-drafts", List.of("view", "create", "edit", "delete"), "Authoring platform broadcasts and maintenance notices"),
                new OperatorDTOs.PermissionCatalogItem("billing.subscriptions", "Subscription Status", "Billing Operations", "/platform-operator/subscription-status", List.of("view", "edit"), "Active tenant tiers, renewals, and grace periods"),
                new OperatorDTOs.PermissionCatalogItem("billing.payment_failures", "Payment Failures", "Billing Operations", "/platform-operator/payment-failures", List.of("view", "execute"), "Dunning queues, declined charges, and smart retry triggers"),
                new OperatorDTOs.PermissionCatalogItem("billing.invoices", "Invoice Delivery", "Billing Operations", "/platform-operator/invoice-delivery", List.of("view", "execute"), "Monthly PDF invoice delivery confirmation and receipts"),
                new OperatorDTOs.PermissionCatalogItem("system.backups", "Backup Monitoring", "System Operations", "/platform-operator/backups", List.of("view", "execute"), "PostgreSQL WAL archiving, daily snapshots, and RTO checks"),
                new OperatorDTOs.PermissionCatalogItem("system.maintenance", "Maintenance Operations", "System Operations", "/platform-operator/maintenance", actions, "Live downtime banner coordination and window execution"),
                new OperatorDTOs.PermissionCatalogItem("system.alerts", "Alerts & Notifications", "System Operations", "/platform-operator/alerts", List.of("view", "edit", "execute"), "Operational metric alarm thresholds and notification routes"),
                new OperatorDTOs.PermissionCatalogItem("audit.activity_logs", "Operational Activity Logs", "Account & Audit", "/platform-operator/activity-logs", List.of("view"), "Chronological audit logs of operator interventions"),
                new OperatorDTOs.PermissionCatalogItem("audit.security_monitoring", "Security Monitoring", "Account & Audit", "/platform-operator/monitoring", List.of("view"), "MFA enforcement state and unauthorized sign-in attempts"),
                new OperatorDTOs.PermissionCatalogItem("account.settings", "Operator Settings", "Account & Audit", "/platform-operator/settings", List.of("view", "edit"), "Personal notification frequencies and session preferences")
        );
    }

    private OperatorDTOs.OperatorResponse toResponse(PlatformOperatorEntity op) {
        int activeSessions = sessionRepository.findByOperatorIdAndRevokedFalse(op.getId()).size();
        OperatorDepartment dept = OperatorDepartment.fromId(op.getDepartmentId());
        boolean isMain = op.getAccessLevel() == OperatorAccessLevel.MAIN_PLATFORM_OPERATOR;
        int totalPerms = isMain ? 120 : dept.getAuthorizedModules().size() * 5; // default actions
        String deptName = (isMain && op.getDepartmentId() == null) ? "All Operational Departments" : dept.getDisplayName();
        String accessLevel = (op.getAccessLevel() != null) ? op.getAccessLevel().name() : OperatorAccessLevel.DEPARTMENT_OPERATOR.name();

        return new OperatorDTOs.OperatorResponse(
                op.getId(),
                op.getName(),
                op.getEmail(),
                op.getRoleId(),
                accessLevel,
                deptName,
                op.getStatus(),
                op.isMfaEnabled(),
                op.isOnCall(),
                op.getShiftName(),
                activeSessions,
                totalPerms,
                op.getLastActiveAt(),
                op.getCreatedAt()
        );
    }
}
