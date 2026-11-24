package com.prowise.superadmin.users;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;
import com.prowise.identity.AccountTokenService;
import com.prowise.identity.AuthAuditLogEntity;
import com.prowise.identity.AuthAuditLogRepository;
import com.prowise.identity.EmailCredentialService;
import com.prowise.identity.UserEntity;
import com.prowise.identity.UserLoginHistoryEntity;
import com.prowise.identity.UserLoginHistoryRepository;
import com.prowise.identity.UserRepository;
import com.prowise.identity.UserRoleEntity;
import com.prowise.identity.UserRoleRepository;
import com.prowise.operator.operations.EmailDeliveryLogEntity;
import com.prowise.operator.operations.EmailDeliveryLogRepository;

/**
 * Platform user provisioning (approved decisions 2 to 6).
 * <ul>
 *   <li>New accounts start in PENDING_ACTIVATION with a random password hash that nobody knows.</li>
 *   <li>The owner sets a password through a 72-hour single-use setup link; no password is ever returned or emailed.</li>
 *   <li>A failed setup email keeps the pending account; administrators see the status and can resend.</li>
 *   <li>Platform roles (Super Admin, Platform Operator) cannot be assigned here; attempts are audited.</li>
 * </ul>
 */
@Service
@Transactional
public class SuperAdminUserService {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminUserService.class);
    private static final ObjectMapper JSON = new ObjectMapper();

    static final String STATUS_ACTIVE = "ACTIVE";
    static final String STATUS_DISABLED = "DISABLED";
    static final String STATUS_PENDING = "PENDING_ACTIVATION";

    /** Platform authorities that only Operator Management or the (not yet specified) bootstrap process may grant. */
    private static final Set<String> NON_ASSIGNABLE_ROLES = Set.of("SUPER_ADMIN", "PLATFORM_SUPER_ADMIN", "PLATFORM_OPERATOR");

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final UserLoginHistoryRepository loginHistoryRepository;
    private final AuthAuditLogRepository auditLogRepository;
    private final EmailCredentialService emailCredentialService;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbc;
    private final AccountTokenService accountTokenService;
    private final EmailDeliveryLogRepository deliveryLogRepository;

    public SuperAdminUserService(
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            UserLoginHistoryRepository loginHistoryRepository,
            AuthAuditLogRepository auditLogRepository,
            EmailCredentialService emailCredentialService,
            PasswordEncoder passwordEncoder,
            JdbcTemplate jdbc,
            AccountTokenService accountTokenService,
            EmailDeliveryLogRepository deliveryLogRepository
    ) {
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.loginHistoryRepository = loginHistoryRepository;
        this.auditLogRepository = auditLogRepository;
        this.emailCredentialService = emailCredentialService;
        this.passwordEncoder = passwordEncoder;
        this.jdbc = jdbc;
        this.accountTokenService = accountTokenService;
        this.deliveryLogRepository = deliveryLogRepository;
    }

    /** Every refusal below happens before any write, so the denial audit row can commit on its own. */
    @Transactional(noRollbackFor = ApiException.class)
    public UserDTOs.UserResponse createUser(UserDTOs.CreateUserRequest request, UUID actorId, String actorEmail, String ipAddress) {
        if (request == null || request.email() == null || !request.email().contains("@")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "A valid email address is required.");
        }
        String normalizedEmail = request.email().trim().toLowerCase(Locale.ROOT);
        String role = normalizeRole(request.role());
        requireAssignable(role, actorId, actorEmail, null, ipAddress);

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_IN_USE", "A user account already exists with this email address.");
        }

        String name = (request.name() != null && !request.name().isBlank()) ? request.name().trim() : normalizedEmail.split("@")[0];
        UUID userId = UUID.randomUUID();
        // The hash protects a random value that is never shown to anyone, so the account has no usable password.
        UserEntity user = new UserEntity(userId, normalizedEmail, passwordEncoder.encode(AccountTokenService.randomToken()),
                name, role, STATUS_PENDING, false);
        user.setDepartment(request.department());
        user.setOrganizationId(request.organizationId());
        user.setPhone(request.phone());
        // Flush now: the setup token and membership rows below are written with JDBC and reference this row.
        user = userRepository.saveAndFlush(user);

        userRoleRepository.save(new UserRoleEntity(userId, role));

        if (request.organizationId() != null) {
            Integer orgExists = jdbc.queryForObject("SELECT count(*) FROM organizations WHERE id = ?",
                    Integer.class, request.organizationId());
            if (orgExists != null && orgExists > 0) {
                UUID membershipId = jdbc.queryForObject("""
                        INSERT INTO memberships (id, org_id, user_id, role_template, status)
                        VALUES (?, ?, ?, ?, 'ACTIVE')
                        ON CONFLICT (org_id, user_id) DO UPDATE SET role_template = EXCLUDED.role_template
                        RETURNING id
                        """, UUID.class, UUID.randomUUID(), request.organizationId(), userId, role);
                // A role name grants nothing by itself (rule 12): the membership also gets the matching template role
                // at organization scope, or the person could sign in and then be refused on every page.
                jdbc.update("""
                        INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by)
                        SELECT ?, ?, ?, r.id, 'ORG', COALESCE((SELECT u.id FROM users u WHERE u.id = ?), ?)
                        FROM roles r
                        WHERE r.is_template AND r.name = ?
                          AND NOT EXISTS (SELECT 1 FROM grants g WHERE g.membership_id = ? AND g.template_role_id = r.id
                                          AND g.scope = 'ORG')
                        """, UUID.randomUUID(), request.organizationId(), membershipId, actorId, userId, role, membershipId);
            } else {
                log.warn("Organization {} not found; user {} created without a membership", request.organizationId(), userId);
            }
        }

        EmailCredentialService.EmailDeliveryResult delivery = null;
        if (request.sendEmail() == null || request.sendEmail()) {
            delivery = sendSetupLink(user);
        }

        audit("USER_CREATED", actorId, actorEmail, userId, ipAddress, Map.of(
                "role", role,
                "emailStatus", delivery != null ? delivery.status() : "NOT_REQUESTED"));

        return toResponse(user,
                delivery != null ? delivery.status() : "NOT_REQUESTED",
                delivery != null ? delivery.message() : "No setup email was requested. Use Resend to send one.");
    }

    @Transactional(readOnly = true)
    public Page<UserDTOs.UserResponse> listUsers(
            String search, String role, String department, String status, UUID organizationId, int page, int size
    ) {
        String safeSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;
        String safeRole = (role != null && !role.equals("ALL")) ? role : null;
        String safeDept = (department != null && !department.equals("ALL")) ? department : null;
        String safeStatus = (status != null && !status.equals("ALL")) ? status : null;

        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<UserEntity> userPage = userRepository.searchUsers(safeSearch, safeRole, safeDept, safeStatus, organizationId, pageRequest);
        return userPage.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public UserDTOs.UserResponse getUser(UUID userId) {
        return toResponse(findUser(userId));
    }

    @Transactional(noRollbackFor = ApiException.class)
    public UserDTOs.UserResponse updateUser(UUID userId, UserDTOs.UpdateUserRequest request, UUID actorId, String actorEmail, String ip) {
        UserEntity user = findUser(userId);
        String newRole = (request.role() != null && !request.role().isBlank()) ? normalizeRole(request.role()) : null;
        if (newRole != null) {
            requireAssignable(newRole, actorId, actorEmail, userId, ip);
        }

        if (request.name() != null && !request.name().isBlank()) user.setName(request.name().trim());
        if (request.department() != null) user.setDepartment(request.department().trim());
        if (request.phone() != null) user.setPhone(request.phone().trim());
        if (request.organizationId() != null) user.setOrganizationId(request.organizationId());

        if (newRole != null) {
            user.setRole(newRole);
            userRoleRepository.deleteByUserId(userId);
            userRoleRepository.save(new UserRoleEntity(userId, newRole));

            if (user.getOrganizationId() != null) {
                jdbc.update("UPDATE memberships SET role_template = ? WHERE org_id = ? AND user_id = ?",
                        newRole, user.getOrganizationId(), userId);
            }
        }

        user.setUpdatedAt(Instant.now());
        userRepository.save(user);
        audit("USER_UPDATED", actorId, actorEmail, userId, ip, Map.of());
        return getUser(userId);
    }

    public void updateStatus(UUID userId, String status, UUID actorId, String actorEmail, String ip) {
        UserEntity user = findUser(userId);
        String target = STATUS_DISABLED.equalsIgnoreCase(status) ? STATUS_DISABLED : STATUS_ACTIVE;

        if (STATUS_ACTIVE.equals(target) && STATUS_PENDING.equals(user.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "ACCOUNT_PENDING_ACTIVATION",
                    "This account becomes active when its owner completes setup. Resend the setup link instead.");
        }

        user.setStatus(target);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        if (STATUS_DISABLED.equals(target)) {
            jdbc.update("UPDATE sessions SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL", userId);
        }
        audit("USER_STATUS_CHANGED", actorId, actorEmail, userId, ip, Map.of("newStatus", target));
    }

    /** Sends a 30-minute reset link to an active account and signs it out everywhere. No password is set or returned. */
    public UserDTOs.CredentialDeliveryResponse resetPassword(UUID userId, UUID actorId, String actorEmail, String ip) {
        UserEntity user = findUser(userId);
        if (STATUS_PENDING.equals(user.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "ACCOUNT_PENDING_ACTIVATION",
                    "This account has not been set up yet. Resend the setup link instead.");
        }
        if (STATUS_DISABLED.equals(user.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "ACCOUNT_DISABLED",
                    "This account is disabled. Activate it before sending a reset link.");
        }

        jdbc.update("UPDATE sessions SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL", userId);
        String token = accountTokenService.issue(userId, AccountTokenService.Purpose.RESET);
        EmailCredentialService.EmailDeliveryResult delivery =
                emailCredentialService.sendPasswordResetEmail(userId, user.getEmail(), user.getName(), token);

        audit("PASSWORD_RESET_LINK_SENT", actorId, actorEmail, userId, ip, Map.of("emailStatus", delivery.status()));
        return new UserDTOs.CredentialDeliveryResponse(userId, user.getEmail(), delivery.status(), delivery.message());
    }

    /** Issues a new setup link for a pending account; earlier setup links stop working. */
    public UserDTOs.CredentialDeliveryResponse resendInvitation(UUID userId, UUID actorId, String actorEmail, String ip) {
        UserEntity user = findUser(userId);
        if (!STATUS_PENDING.equals(user.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "ACCOUNT_ALREADY_ACTIVE",
                    "This account is already set up. Send a password reset link instead.");
        }

        EmailCredentialService.EmailDeliveryResult delivery = sendSetupLink(user);
        audit("SETUP_LINK_RESENT", actorId, actorEmail, userId, ip, Map.of("emailStatus", delivery.status()));
        return new UserDTOs.CredentialDeliveryResponse(userId, user.getEmail(), delivery.status(), delivery.message());
    }

    @Transactional(readOnly = true)
    public List<UserDTOs.LoginHistoryResponse> getLoginHistory(UUID userId) {
        List<UserLoginHistoryEntity> history = loginHistoryRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return history.stream().map(h -> new UserDTOs.LoginHistoryResponse(
                h.getId(),
                h.getUserId(),
                h.getEmail(),
                h.getIpAddress(),
                h.getUserAgent(),
                h.getStatus(),
                h.getFailureReason(),
                h.getCreatedAt()
        )).toList();
    }

    private EmailCredentialService.EmailDeliveryResult sendSetupLink(UserEntity user) {
        String token = accountTokenService.issue(user.getId(), AccountTokenService.Purpose.SETUP);
        return emailCredentialService.sendAccountSetupEmail(user.getId(), user.getEmail(), user.getName(), token);
    }

    private void requireAssignable(String role, UUID actorId, String actorEmail, UUID targetUserId, String ip) {
        if (NON_ASSIGNABLE_ROLES.contains(role)) {
            audit("PRIVILEGED_ROLE_ASSIGNMENT_DENIED", actorId, actorEmail, targetUserId, ip, Map.of("requestedRole", role));
            throw new ApiException(HttpStatus.BAD_REQUEST, "ROLE_NOT_ASSIGNABLE",
                    "Platform roles cannot be assigned here. Create operators through Operator Management.");
        }
    }

    private static String normalizeRole(String role) {
        String value = (role != null && !role.isBlank()) ? role.trim().toUpperCase(Locale.ROOT) : "VIEWER";
        return value.replaceAll("[^A-Z0-9_]", "");
    }

    private UserEntity findUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "User not found."));
    }

    private UserDTOs.UserResponse toResponse(UserEntity user) {
        String status = null;
        String message = null;
        if (STATUS_PENDING.equals(user.getStatus())) {
            EmailDeliveryLogEntity latest = deliveryLogRepository
                    .findFirstByUserIdAndEmailTypeOrderByCreatedAtDesc(user.getId(), EmailCredentialService.TYPE_ACCOUNT_SETUP)
                    .orElse(null);
            if (latest != null) {
                status = latest.getStatus();
                message = switch (latest.getStatus()) {
                    case EmailCredentialService.STATUS_ACCEPTED -> "Setup email accepted by the SMTP server at " + latest.getSentAt() + ".";
                    case EmailCredentialService.STATUS_NOT_SENT -> EmailCredentialService.NOT_CONFIGURED_MESSAGE;
                    default -> EmailCredentialService.SAFE_FAILURE_MESSAGE;
                };
            } else {
                status = "NOT_REQUESTED";
                message = "No setup email has been sent. Use Resend to send one.";
            }
        }
        return toResponse(user, status, message);
    }

    private UserDTOs.UserResponse toResponse(UserEntity user, String emailStatus, String emailMessage) {
        return new UserDTOs.UserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getRole(),
                user.getDepartment(),
                user.getOrganizationId(),
                lookupOrgName(user.getOrganizationId()),
                user.getPhone(),
                user.getStatus(),
                user.getMustChangePassword(),
                user.getLastLoginAt(),
                user.getCreatedAt(),
                emailStatus,
                emailMessage
        );
    }

    private void audit(String action, UUID actorId, String actorEmail, UUID targetUserId, String ip, Map<String, Object> details) {
        Map<String, Object> payload = new LinkedHashMap<>(details);
        if (actorEmail != null) payload.put("actor", actorEmail);
        String json;
        try {
            json = JSON.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            json = "{}";
        }
        auditLogRepository.save(new AuthAuditLogEntity(action, actorId, actorEmail, targetUserId, json, ip));
    }

    private String lookupOrgName(UUID orgId) {
        if (orgId == null) return null;
        List<String> names = jdbc.query("SELECT name FROM organizations WHERE id = ?",
                (rs, rowNum) -> rs.getString("name"), orgId);
        return names.isEmpty() ? null : names.get(0);
    }
}
