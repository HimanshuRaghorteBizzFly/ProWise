package com.prowise.superadmin.users;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.Map;
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

import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;
import com.prowise.identity.AuthAuditLogEntity;
import com.prowise.identity.AuthAuditLogRepository;
import com.prowise.identity.EmailCredentialService;
import com.prowise.identity.UserEntity;
import com.prowise.identity.UserLoginHistoryEntity;
import com.prowise.identity.UserLoginHistoryRepository;
import com.prowise.identity.UserRepository;
import com.prowise.identity.UserRoleEntity;
import com.prowise.identity.UserRoleRepository;

@Service
@Transactional
public class SuperAdminUserService {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminUserService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final UserLoginHistoryRepository loginHistoryRepository;
    private final AuthAuditLogRepository auditLogRepository;
    private final EmailCredentialService emailCredentialService;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbc;

    public SuperAdminUserService(
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            UserLoginHistoryRepository loginHistoryRepository,
            AuthAuditLogRepository auditLogRepository,
            EmailCredentialService emailCredentialService,
            PasswordEncoder passwordEncoder,
            JdbcTemplate jdbc
    ) {
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.loginHistoryRepository = loginHistoryRepository;
        this.auditLogRepository = auditLogRepository;
        this.emailCredentialService = emailCredentialService;
        this.passwordEncoder = passwordEncoder;
        this.jdbc = jdbc;
    }

    public UserDTOs.UserResponse createUser(UserDTOs.CreateUserRequest request, UUID actorId, String actorEmail, String ipAddress) {
        if (request == null || request.email() == null || !request.email().contains("@")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "A valid email address is required.");
        }
        String normalizedEmail = request.email().trim().toLowerCase(java.util.Locale.ROOT);

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_IN_USE", "A user account already exists with this email address.");
        }

        String rawPassword;
        if (request.customPassword() != null && request.customPassword().trim().length() >= 8) {
            rawPassword = request.customPassword().trim();
        } else {
            rawPassword = generateSecurePassword(14);
        }

        String role = (request.role() != null && !request.role().isBlank()) ? request.role().trim().toUpperCase() : "VIEWER";
        String name = (request.name() != null && !request.name().isBlank()) ? request.name().trim() : normalizedEmail.split("@")[0];

        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity(
                userId,
                normalizedEmail,
                passwordEncoder.encode(rawPassword),
                name,
                role,
                "ACTIVE",
                true
        );
        user.setDepartment(request.department());
        user.setOrganizationId(request.organizationId());
        user.setPhone(request.phone());
        user = userRepository.save(user);

        userRoleRepository.save(new UserRoleEntity(userId, role));

        // Sync organization membership if assigned to an organization
        if (request.organizationId() != null) {
            try {
                jdbc.update("""
                        INSERT INTO memberships (id, org_id, user_id, role_template, status)
                        VALUES (?, ?, ?, ?, 'ACTIVE')
                        ON CONFLICT (org_id, user_id) DO UPDATE SET role_template = EXCLUDED.role_template
                        """, UUID.randomUUID(), request.organizationId(), userId, role);
            } catch (Exception ex) {
                log.warn("Could not insert membership for user {}: {}", userId, ex.getMessage());
            }
        }

        // Sync to platform_operators table if assigned PLATFORM_OPERATOR role
        if ("PLATFORM_OPERATOR".equalsIgnoreCase(role)) {
            try {
                jdbc.update("""
                        INSERT INTO platform_operators (id, name, email, department, role, access_level, status, password_hash)
                        VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
                        ON CONFLICT (email) DO NOTHING
                        """, "op_" + userId.toString().substring(0, 8), name, normalizedEmail,
                        request.department() != null ? request.department() : "Platform Operations",
                        "Platform Operator", "DEPARTMENT_OPERATOR", user.getPasswordHash());
            } catch (Exception ex) {
                log.warn("Could not sync operator record: {}", ex.getMessage());
            }
        }

        // Email delivery
        EmailCredentialService.EmailDeliveryResult emailResult = null;
        boolean sendEmail = request.sendEmail() == null || request.sendEmail();
        if (sendEmail) {
            emailResult = emailCredentialService.sendWelcomeCredentials(normalizedEmail, name, rawPassword, null);
        }

        // Audit log
        auditLogRepository.save(new AuthAuditLogEntity(
                "USER_CREATED",
                actorId,
                actorEmail,
                userId,
                "{\"role\":\"" + role + "\", \"emailSent\":" + (emailResult != null && emailResult.success()) + "}",
                ipAddress
        ));

        String orgName = lookupOrgName(request.organizationId());
        return new UserDTOs.UserResponse(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getRole(),
                user.getDepartment(),
                user.getOrganizationId(),
                orgName,
                user.getPhone(),
                user.getStatus(),
                user.getMustChangePassword(),
                user.getLastLoginAt(),
                user.getCreatedAt(),
                rawPassword,
                emailResult != null ? emailResult.status() : "NOT_REQUESTED",
                emailResult != null ? emailResult.message() : "Email delivery was not requested."
        );
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

        return userPage.map(u -> new UserDTOs.UserResponse(
                u.getId(),
                u.getEmail(),
                u.getName(),
                u.getRole(),
                u.getDepartment(),
                u.getOrganizationId(),
                lookupOrgName(u.getOrganizationId()),
                u.getPhone(),
                u.getStatus(),
                u.getMustChangePassword(),
                u.getLastLoginAt(),
                u.getCreatedAt(),
                null,
                null,
                null
        ));
    }

    @Transactional(readOnly = true)
    public UserDTOs.UserResponse getUser(UUID userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "User not found."));

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
                null,
                null,
                null
        );
    }

    public UserDTOs.UserResponse updateUser(UUID userId, UserDTOs.UpdateUserRequest request, UUID actorId, String actorEmail, String ip) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "User not found."));

        if (request.name() != null && !request.name().isBlank()) user.setName(request.name().trim());
        if (request.department() != null) user.setDepartment(request.department().trim());
        if (request.phone() != null) user.setPhone(request.phone().trim());
        if (request.organizationId() != null) user.setOrganizationId(request.organizationId());

        if (request.role() != null && !request.role().isBlank()) {
            String newRole = request.role().trim().toUpperCase();
            user.setRole(newRole);
            userRoleRepository.deleteByUserId(userId);
            userRoleRepository.save(new UserRoleEntity(userId, newRole));

            if (user.getOrganizationId() != null) {
                jdbc.update("UPDATE memberships SET role_template = ? WHERE org_id = ? AND user_id = ?",
                        newRole, user.getOrganizationId(), userId);
            }
        }

        user.setUpdatedAt(Instant.now());
        user = userRepository.save(user);

        auditLogRepository.save(new AuthAuditLogEntity(
                "USER_UPDATED", actorId, actorEmail, userId, "{\"updatedBy\":\"" + actorEmail + "\"}", ip
        ));

        return getUser(userId);
    }

    public void updateStatus(UUID userId, String status, UUID actorId, String actorEmail, String ip) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "User not found."));

        String safeStatus = "DISABLED".equalsIgnoreCase(status) ? "DISABLED" : "ACTIVE";
        user.setStatus(safeStatus);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        if ("DISABLED".equals(safeStatus)) {
            // Immediately invalidate all active sessions
            jdbc.update("UPDATE sessions SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL", userId);
        }

        auditLogRepository.save(new AuthAuditLogEntity(
                "USER_STATUS_CHANGED", actorId, actorEmail, userId, "{\"newStatus\":\"" + safeStatus + "\"}", ip
        ));
    }

    public UserDTOs.ResetPasswordResponse resetPassword(UUID userId, UUID actorId, String actorEmail, String ip) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "User not found."));

        String newTempPassword = generateSecurePassword(14);
        user.setPasswordHash(passwordEncoder.encode(newTempPassword));
        user.setMustChangePassword(true);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        // Revoke existing sessions
        jdbc.update("UPDATE sessions SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL", userId);

        EmailCredentialService.EmailDeliveryResult emailResult = emailCredentialService.sendWelcomeCredentials(
                user.getEmail(), user.getName(), newTempPassword, null
        );

        auditLogRepository.save(new AuthAuditLogEntity(
                "PASSWORD_RESET_ADMIN", actorId, actorEmail, userId,
                "{\"resetBy\":\"" + actorEmail + "\", \"emailSent\":" + emailResult.success() + "}", ip
        ));

        return new UserDTOs.ResetPasswordResponse(
                userId,
                user.getEmail(),
                newTempPassword,
                emailResult.status(),
                emailResult.message()
        );
    }

    public UserDTOs.ResetPasswordResponse resendInvitation(UUID userId, UUID actorId, String actorEmail, String ip) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "User not found."));

        String newTempPassword = generateSecurePassword(14);
        user.setPasswordHash(passwordEncoder.encode(newTempPassword));
        user.setMustChangePassword(true);
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        EmailCredentialService.EmailDeliveryResult emailResult = emailCredentialService.sendWelcomeCredentials(
                user.getEmail(), user.getName(), newTempPassword, null
        );

        auditLogRepository.save(new AuthAuditLogEntity(
                "INVITATION_RESENT", actorId, actorEmail, userId,
                "{\"resentBy\":\"" + actorEmail + "\", \"emailSent\":" + emailResult.success() + "}", ip
        ));

        return new UserDTOs.ResetPasswordResponse(
                userId,
                user.getEmail(),
                newTempPassword,
                emailResult.status(),
                emailResult.message()
        );
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

    private String lookupOrgName(UUID orgId) {
        if (orgId == null) return null;
        try {
            List<String> names = jdbc.query("SELECT name FROM organizations WHERE id = ?",
                    (rs, rowNum) -> rs.getString("name"), orgId);
            return names.isEmpty() ? null : names.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    private static String generateSecurePassword(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(PASSWORD_CHARS.charAt(RANDOM.nextInt(PASSWORD_CHARS.length())));
        }
        return sb.toString();
    }
}
