package com.prowise.operator.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.HexFormat;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;
import com.prowise.identity.AuthPrincipal;
import com.prowise.identity.JwtService;
import com.prowise.notification.EmailMessage;
import com.prowise.notification.EmailSender;
import com.prowise.operator.OperatorDepartment;
import com.prowise.operator.OperatorDepartmentPermissionEntity;
import com.prowise.operator.OperatorDepartmentPermissionRepository;
import com.prowise.operator.OperatorInvitationEntity;
import com.prowise.operator.OperatorInvitationRepository;
import com.prowise.operator.OperatorLoginHistoryEntity;
import com.prowise.operator.OperatorLoginHistoryRepository;
import com.prowise.operator.OperatorOverrideRepository;
import com.prowise.operator.OperatorPasswordResetEntity;
import com.prowise.operator.OperatorPasswordResetRepository;
import com.prowise.operator.OperatorPermissionOverrideEntity;
import com.prowise.operator.OperatorSessionEntity;
import com.prowise.operator.OperatorSessionRepository;
import com.prowise.operator.PlatformOperatorEntity;
import com.prowise.operator.PlatformOperatorRepository;

@Service
@Transactional
public class OperatorAuthService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int MAX_ATTEMPTS_PER_WINDOW = 10;
    private static final long RATE_WINDOW_MILLIS = 60_000L;
    private static final Map<String, RateAttempt> RATE_ATTEMPTS = new ConcurrentHashMap<>();

    private final PlatformOperatorRepository operatorRepository;
    private final OperatorSessionRepository sessionRepository;
    private final OperatorInvitationRepository invitationRepository;
    private final OperatorPasswordResetRepository passwordResetRepository;
    private final OperatorLoginHistoryRepository loginHistoryRepository;
    private final OperatorDepartmentPermissionRepository departmentPermissionRepository;
    private final OperatorOverrideRepository overrideRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailSender emailSender;
    private final long refreshTokenDays;
    private final long accessTokenMinutes;

    public OperatorAuthService(
            PlatformOperatorRepository operatorRepository,
            OperatorSessionRepository sessionRepository,
            OperatorInvitationRepository invitationRepository,
            OperatorPasswordResetRepository passwordResetRepository,
            OperatorLoginHistoryRepository loginHistoryRepository,
            OperatorDepartmentPermissionRepository departmentPermissionRepository,
            OperatorOverrideRepository overrideRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            EmailSender emailSender,
            @Value("${prowise.auth.refresh-token-days:30}") long refreshTokenDays,
            @Value("${prowise.auth.access-token-minutes:15}") long accessTokenMinutes
    ) {
        this.operatorRepository = operatorRepository;
        this.sessionRepository = sessionRepository;
        this.invitationRepository = invitationRepository;
        this.passwordResetRepository = passwordResetRepository;
        this.loginHistoryRepository = loginHistoryRepository;
        this.departmentPermissionRepository = departmentPermissionRepository;
        this.overrideRepository = overrideRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.emailSender = emailSender;
        this.refreshTokenDays = refreshTokenDays;
        this.accessTokenMinutes = accessTokenMinutes;
    }

    public OperatorAuthDTOs.OperatorAuthResponse login(
            String rawEmail, String password, Boolean rememberMe, String ipAddress, String userAgent
    ) {
        String email = normalize(rawEmail);
        enforceRateLimit("op:login:" + (ipAddress != null ? ipAddress : "") + ":" + email);

        if (email.isBlank() || password == null || password.isBlank()) {
            recordLoginHistory(null, email, "FAILED_MISSING_CREDENTIALS", ipAddress, userAgent, "Empty email or password");
            throw invalidCredentials();
        }

        Optional<PlatformOperatorEntity> opt = operatorRepository.findByEmailIgnoreCase(email);
        if (opt.isEmpty()) {
            recordLoginHistory(null, email, "FAILED_INVALID_CREDENTIALS", ipAddress, userAgent, "No operator matching email");
            throw invalidCredentials();
        }

        PlatformOperatorEntity operator = opt.get();

        if (!"ACTIVE".equalsIgnoreCase(operator.getStatus())) {
            recordLoginHistory(operator.getId(), email, "FAILED_INACTIVE", ipAddress, userAgent, "Account status: " + operator.getStatus());
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_INACTIVE",
                    "Your platform operator account is " + operator.getStatus().toLowerCase() + ". Please contact Super Admin.");
        }

        if (operator.getPasswordHash() == null || !passwordEncoder.matches(password, operator.getPasswordHash())) {
            recordLoginHistory(operator.getId(), email, "FAILED_INVALID_CREDENTIALS", ipAddress, userAgent, "Password mismatch");
            throw invalidCredentials();
        }

        // Credentials valid - update operator timestamps
        operator.setLastLoginAt(Instant.now());
        operator.setLastActiveAt(Instant.now());
        operatorRepository.save(operator);

        // Record successful login
        recordLoginHistory(operator.getId(), email, "SUCCESS", ipAddress, userAgent, null);

        // Issue session
        return issueOperatorSession(operator, ipAddress, userAgent);
    }

    public OperatorAuthDTOs.OperatorAuthResponse refresh(
            String refreshToken, String ipAddress, String userAgent
    ) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw invalidCredentials();
        }
        enforceRateLimit("op:refresh:" + (ipAddress != null ? ipAddress : ""));

        String hash = hash(refreshToken.trim());
        Optional<OperatorSessionEntity> optSession = sessionRepository.findByRefreshTokenHashAndRevokedFalse(hash);

        if (optSession.isEmpty()) {
            // Possible token reuse attack or invalid token
            throw invalidCredentials();
        }

        OperatorSessionEntity currentSession = optSession.get();
        if (currentSession.getExpiresAt().isBefore(Instant.now())) {
            currentSession.setRevoked(true);
            currentSession.setRevokedAt(Instant.now());
            currentSession.setRevokedBy("SESSION_EXPIRED");
            sessionRepository.save(currentSession);
            throw invalidCredentials();
        }

        PlatformOperatorEntity operator = operatorRepository.findById(currentSession.getOperatorId())
                .orElse(null);

        if (operator == null || !"ACTIVE".equalsIgnoreCase(operator.getStatus())) {
            currentSession.setRevoked(true);
            currentSession.setRevokedAt(Instant.now());
            currentSession.setRevokedBy("OPERATOR_INACTIVE");
            sessionRepository.save(currentSession);
            throw invalidCredentials();
        }

        // Revoke current session (token rotation)
        currentSession.setRevoked(true);
        currentSession.setRevokedAt(Instant.now());
        currentSession.setRevokedBy("TOKEN_ROTATED");
        sessionRepository.save(currentSession);

        // Issue new rotated session
        return issueOperatorSession(operator, ipAddress, userAgent);
    }

    public void logout(AuthPrincipal principal) {
        if (principal == null || principal.sessionId() == null) {
            return;
        }
        sessionRepository.findById(principal.sessionId()).ifPresent(session -> {
            session.setRevoked(true);
            session.setRevokedAt(Instant.now());
            session.setRevokedBy(principal.email() != null ? principal.email() : "OPERATOR_LOGOUT");
            sessionRepository.save(session);
        });
    }

    public void logoutAll(AuthPrincipal principal) {
        if (principal == null || principal.operatorId() == null) {
            return;
        }
        String actor = principal.email() != null ? principal.email() : "OPERATOR_LOGOUT_ALL";
        sessionRepository.revokeAllByOperatorId(principal.operatorId(), actor);
    }

    public void forgotPassword(String rawEmail, String ipAddress) {
        String email = normalize(rawEmail);
        enforceRateLimit("op:forgot:" + email);

        if (email.isBlank()) {
            return;
        }

        Optional<PlatformOperatorEntity> opt = operatorRepository.findByEmailIgnoreCase(email);
        if (opt.isPresent() && "ACTIVE".equalsIgnoreCase(opt.get().getStatus())) {
            PlatformOperatorEntity op = opt.get();
            String rawToken = randomToken();
            String tokenHash = hash(rawToken);
            Instant expiresAt = Instant.now().plus(30, ChronoUnit.MINUTES);

            passwordResetRepository.save(new OperatorPasswordResetEntity(op.getId(), op.getEmail(), tokenHash, expiresAt));

            emailSender.send(new EmailMessage(
                    op.getEmail(),
                    "ProWise Platform Operator Password Reset",
                    "A password reset was requested for your Platform Operator account.\n\n"
                            + "Your reset token is: " + rawToken + "\n\n"
                            + "This token will expire in 30 minutes."
            ));
        }
    }

    public void resetPassword(String token, String newPassword) {
        if (token == null || token.isBlank() || newPassword == null || newPassword.length() < 8) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED,
                    "Password reset token and a new password with at least 8 characters are required.");
        }

        String tokenHash = hash(token.trim());
        OperatorPasswordResetEntity reset = passwordResetRepository.findByTokenHashAndUsedAtIsNull(tokenHash)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.INVALID_CREDENTIALS,
                        "Invalid or expired password reset token."));

        if (reset.getExpiresAt().isBefore(Instant.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.INVALID_CREDENTIALS,
                    "Password reset token has expired.");
        }

        PlatformOperatorEntity operator = operatorRepository.findById(reset.getOperatorId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Operator account not found."));

        operator.setPasswordHash(passwordEncoder.encode(newPassword));
        operator.setPasswordSetupCompleted(true);
        operator.setUpdatedAt(Instant.now());
        operatorRepository.save(operator);

        reset.setUsedAt(Instant.now());
        passwordResetRepository.save(reset);

        // Revoke all existing sessions on password change
        sessionRepository.revokeAllByOperatorId(operator.getId(), "PASSWORD_RESET");
    }

    public OperatorAuthDTOs.OperatorAuthResponse acceptInvitation(String token, String newPassword, String name) {
        if (token == null || token.isBlank() || newPassword == null || newPassword.length() < 8) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED,
                    "Invitation token and a password with at least 8 characters are required.");
        }

        String tokenHash = hash(token.trim());
        OperatorInvitationEntity invite = invitationRepository.findByTokenHashAndAcceptedAtIsNull(tokenHash)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.INVALID_CREDENTIALS,
                        "Invalid or expired invitation token."));

        if (invite.getExpiresAt().isBefore(Instant.now())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.INVALID_CREDENTIALS,
                    "Invitation token has expired.");
        }

        PlatformOperatorEntity operator = operatorRepository.findById(invite.getOperatorId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Operator account not found."));

        if (name != null && !name.trim().isEmpty()) {
            operator.setName(name.trim());
        }
        operator.setPasswordHash(passwordEncoder.encode(newPassword));
        operator.setPasswordSetupCompleted(true);
        operator.setStatus("ACTIVE");
        operator.setLastLoginAt(Instant.now());
        operator.setLastActiveAt(Instant.now());
        operator.setUpdatedAt(Instant.now());
        PlatformOperatorEntity saved = operatorRepository.save(operator);

        invite.setAcceptedAt(Instant.now());
        invitationRepository.save(invite);

        // Issue fresh session and immediately sign in
        return issueOperatorSession(saved, null, "Invitation Setup");
    }

    private OperatorAuthDTOs.OperatorAuthResponse issueOperatorSession(
            PlatformOperatorEntity operator, String ipAddress, String userAgent
    ) {
        String rawRefreshToken = randomToken();
        String refreshHash = hash(rawRefreshToken);
        Instant sessionExpires = Instant.now().plus(refreshTokenDays, ChronoUnit.DAYS);

        OperatorSessionEntity session = new OperatorSessionEntity(
                operator.getId(),
                refreshHash,
                ipAddress,
                userAgent,
                sessionExpires
        );
        session.setRefreshTokenHash(refreshHash);
        OperatorSessionEntity savedSession = sessionRepository.save(session);
        UUID sessionId = (savedSession != null && savedSession.getId() != null)
                ? savedSession.getId()
                : (session.getId() != null ? session.getId() : UUID.randomUUID());

        AuthPrincipal principal = AuthPrincipal.forOperator(
                operator.getId(),
                sessionId,
                operator.getEmail(),
                operator.getRoleId(),
                operator.getDepartmentId(),
                operator.getAccessLevel().name()
        );

        String accessToken = jwtService.issueAccessToken(principal);

        boolean isMainOperator = operator.getAccessLevel() == com.prowise.operator.OperatorAccessLevel.MAIN_PLATFORM_OPERATOR;
        String deptId = operator.getDepartmentId();
        String deptDisplayName = "All Operational Departments";

        List<String> authorizedModules = new ArrayList<>();
        List<String> sortedPerms = new ArrayList<>();

        if (isMainOperator) {
            // Main Platform Operator has global operational scope across all 7 departments
            java.util.LinkedHashSet<String> allModules = new java.util.LinkedHashSet<>();
            for (OperatorDepartment d : OperatorDepartment.values()) {
                allModules.addAll(d.getAuthorizedModules());
            }
            allModules.add("team.workload");
            allModules.add("reports.operational");
            authorizedModules.addAll(allModules);

            List<OperatorDepartmentPermissionEntity> allDeptPerms = departmentPermissionRepository.findAll();
            Set<String> effectivePerms = new HashSet<>();
            for (OperatorDepartmentPermissionEntity p : allDeptPerms) {
                effectivePerms.add(p.getModuleKey() + ":" + p.getPermissionAction());
            }
            effectivePerms.add("team.workload:view");
            effectivePerms.add("team.workload:assign");
            effectivePerms.add("reports.operational:view");
            effectivePerms.add("reports.operational:export");
            effectivePerms.add("incidents.management:assign");
            effectivePerms.add("support.tickets:assign");
            sortedPerms = new ArrayList<>(effectivePerms);
            Collections.sort(sortedPerms);

            if (deptId == null) {
                deptId = "platform-operations";
                deptDisplayName = "All Operational Departments (Global)";
            } else {
                deptDisplayName = OperatorDepartment.fromId(deptId).getDisplayName();
            }
        } else {
            OperatorDepartment dept = OperatorDepartment.fromId(operator.getDepartmentId());
            deptId = dept.getId();
            deptDisplayName = dept.getDisplayName();

            // Resolve effective authorized modules
            authorizedModules = new ArrayList<>(dept.getAuthorizedModules());
            List<OperatorPermissionOverrideEntity> overrides = overrideRepository.findByOperatorId(operator.getId());
            for (OperatorPermissionOverrideEntity ov : overrides) {
                if ("GRANT".equalsIgnoreCase(ov.getOverrideType()) && "view".equalsIgnoreCase(ov.getPermissionAction())) {
                    if (!authorizedModules.contains(ov.getModuleKey())) {
                        authorizedModules.add(ov.getModuleKey());
                    }
                } else if ("DENY".equalsIgnoreCase(ov.getOverrideType()) && "view".equalsIgnoreCase(ov.getPermissionAction())) {
                    authorizedModules.remove(ov.getModuleKey());
                }
            }

            // Resolve full effective permissions list
            List<OperatorDepartmentPermissionEntity> deptPerms = departmentPermissionRepository.findByDepartmentId(dept.getId());
            Set<String> effectivePerms = new HashSet<>();
            for (OperatorDepartmentPermissionEntity p : deptPerms) {
                effectivePerms.add(p.getModuleKey() + ":" + p.getPermissionAction());
            }
            for (OperatorPermissionOverrideEntity ov : overrides) {
                String key = ov.getModuleKey() + ":" + ov.getPermissionAction();
                if ("GRANT".equalsIgnoreCase(ov.getOverrideType())) {
                    effectivePerms.add(key);
                } else if ("DENY".equalsIgnoreCase(ov.getOverrideType())) {
                    effectivePerms.remove(key);
                }
            }
            sortedPerms = new ArrayList<>(effectivePerms);
            Collections.sort(sortedPerms);
        }

        OperatorAuthDTOs.OperatorInfo info = new OperatorAuthDTOs.OperatorInfo(
                operator.getId(),
                operator.getName(),
                operator.getEmail(),
                operator.getRoleId(),
                operator.getAccessLevel().name(),
                deptId,
                deptDisplayName,
                operator.getStatus(),
                operator.isMfaEnabled(),
                operator.isOnCall(),
                operator.getShiftName(),
                operator.getLastLoginAt(),
                operator.getCreatedAt()
        );

        return new OperatorAuthDTOs.OperatorAuthResponse(
                accessToken,
                rawRefreshToken,
                "Bearer",
                accessTokenMinutes * 60,
                info,
                authorizedModules,
                sortedPerms
        );
    }

    private void recordLoginHistory(
            String operatorId, String email, String status, String ip, String userAgent, String failureReason
    ) {
        try {
            loginHistoryRepository.save(new OperatorLoginHistoryEntity(
                    operatorId,
                    email != null ? email : "unknown",
                    status,
                    ip,
                    userAgent,
                    failureReason
            ));
        } catch (Exception ignored) {
            // Non-blocking telemetry
        }
    }

    private static String normalize(String email) {
        return (email == null) ? "" : email.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private static ApiException invalidCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, ErrorCodes.INVALID_CREDENTIALS,
                "The email or password entered is incorrect.");
    }

    private static void enforceRateLimit(String key) {
        long now = System.currentTimeMillis();
        RateAttempt attempt = RATE_ATTEMPTS.compute(key, (ignored, current) -> {
            if (current == null || now - current.startedAt() >= RATE_WINDOW_MILLIS) {
                return new RateAttempt(now, 1);
            }
            return new RateAttempt(current.startedAt(), current.count() + 1);
        });
        if (attempt.count() > MAX_ATTEMPTS_PER_WINDOW) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, ErrorCodes.RATE_LIMITED,
                    "Too many operator sign-in attempts. Please wait 1 minute before retrying.");
        }
    }

    public static String randomToken() {
        byte[] bytes = new byte[48];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 algorithm unavailable.", exception);
        }
    }

    private record RateAttempt(long startedAt, int count) {}
}
