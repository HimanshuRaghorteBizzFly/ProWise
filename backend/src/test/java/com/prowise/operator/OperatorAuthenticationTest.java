package com.prowise.operator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.prowise.common.api.ApiException;
import com.prowise.identity.AuthPrincipal;
import com.prowise.identity.JwtService;
import com.prowise.notification.EmailSender;
import com.prowise.operator.auth.OperatorAuthDTOs;
import com.prowise.operator.auth.OperatorAuthService;

class OperatorAuthenticationTest {

    private PlatformOperatorRepository operatorRepository;
    private OperatorSessionRepository sessionRepository;
    private OperatorInvitationRepository invitationRepository;
    private OperatorPasswordResetRepository passwordResetRepository;
    private OperatorLoginHistoryRepository loginHistoryRepository;
    private OperatorDepartmentPermissionRepository departmentPermissionRepository;
    private OperatorOverrideRepository overrideRepository;
    private PasswordEncoder passwordEncoder;
    private JwtService jwtService;
    private EmailSender emailSender;
    private OperatorAuthService authService;

    private PlatformOperatorEntity testOperator;

    @BeforeEach
    void setUp() {
        operatorRepository = mock(PlatformOperatorRepository.class);
        sessionRepository = mock(OperatorSessionRepository.class);
        invitationRepository = mock(OperatorInvitationRepository.class);
        passwordResetRepository = mock(OperatorPasswordResetRepository.class);
        loginHistoryRepository = mock(OperatorLoginHistoryRepository.class);
        departmentPermissionRepository = mock(OperatorDepartmentPermissionRepository.class);
        overrideRepository = mock(OperatorOverrideRepository.class);
        passwordEncoder = new BCryptPasswordEncoder();
        jwtService = new JwtService("a-very-long-secret-key-that-is-at-least-32-bytes-long!", 15);
        emailSender = mock(EmailSender.class);

        authService = new OperatorAuthService(
                operatorRepository,
                sessionRepository,
                invitationRepository,
                passwordResetRepository,
                loginHistoryRepository,
                departmentPermissionRepository,
                overrideRepository,
                passwordEncoder,
                jwtService,
                emailSender,
                30,
                15
        );

        testOperator = new PlatformOperatorEntity();
        testOperator.setId("op-1");
        testOperator.setName("Taylor Vance");
        testOperator.setEmail("operator@prowise.io");
        testOperator.setRoleId("role-platform-operator");
        testOperator.setDepartmentId("platform-operations");
        testOperator.setStatus("ACTIVE");
        testOperator.setMfaEnabled(true);
        testOperator.setPasswordHash(passwordEncoder.encode("SecretPass123!"));
        testOperator.setPasswordSetupCompleted(true);
    }

    @Test
    void successfulLoginIssuesTokensAndRecordsTelemetry() {
        when(operatorRepository.findByEmailIgnoreCase("operator@prowise.io"))
                .thenReturn(Optional.of(testOperator));

        OperatorSessionEntity savedSession = new OperatorSessionEntity(
                "op-1", "hash", "127.0.0.1", "TestAgent", Instant.now().plus(30, ChronoUnit.DAYS)
        );
        // Set id
        when(sessionRepository.save(any(OperatorSessionEntity.class))).thenAnswer(invocation -> {
            OperatorSessionEntity entity = invocation.getArgument(0);
            return entity;
        });

        when(departmentPermissionRepository.findByDepartmentId("platform-operations"))
                .thenReturn(List.of(new OperatorDepartmentPermissionEntity("platform-operations", "operations.dashboard", "view")));
        when(overrideRepository.findByOperatorId("op-1")).thenReturn(Collections.emptyList());

        OperatorAuthDTOs.OperatorAuthResponse response = authService.login(
                "operator@prowise.io", "SecretPass123!", true, "127.0.0.1", "TestAgent"
        );

        assertThat(response).isNotNull();
        assertThat(response.accessToken()).isNotBlank();
        assertThat(response.refreshToken()).isNotBlank();
        assertThat(response.operator().email()).isEqualTo("operator@prowise.io");
        assertThat(response.operator().departmentName()).isEqualTo("Platform Operations");
        assertThat(response.authorizedModules()).contains("operations.dashboard");

        // Verify login history was recorded with SUCCESS
        verify(loginHistoryRepository).save(any(OperatorLoginHistoryEntity.class));
        verify(sessionRepository).save(any(OperatorSessionEntity.class));
    }

    @Test
    void loginFailsOnWrongPassword() {
        when(operatorRepository.findByEmailIgnoreCase("operator@prowise.io"))
                .thenReturn(Optional.of(testOperator));

        assertThatThrownBy(() -> authService.login(
                "operator@prowise.io", "WrongPassword!", false, "127.0.0.1", "TestAgent"
        )).isInstanceOf(ApiException.class)
          .hasMessageContaining("email or password");

        verify(loginHistoryRepository).save(any(OperatorLoginHistoryEntity.class));
    }

    @Test
    void loginFailsOnInactiveOperator() {
        testOperator.setStatus("SUSPENDED");
        when(operatorRepository.findByEmailIgnoreCase("operator@prowise.io"))
                .thenReturn(Optional.of(testOperator));

        assertThatThrownBy(() -> authService.login(
                "operator@prowise.io", "SecretPass123!", false, "127.0.0.1", "TestAgent"
        )).isInstanceOf(ApiException.class)
          .hasMessageContaining("suspended");
    }

    @Test
    void refreshRotatesTokenAndRevokesPreviousSession() {
        String rawRefreshToken = "sample-valid-refresh-token";
        String tokenHash = OperatorAuthService.hash(rawRefreshToken);

        OperatorSessionEntity existingSession = new OperatorSessionEntity(
                "op-1", tokenHash, "127.0.0.1", "TestAgent", Instant.now().plus(10, ChronoUnit.DAYS)
        );
        existingSession.setRefreshTokenHash(tokenHash);

        when(sessionRepository.findByRefreshTokenHashAndRevokedFalse(tokenHash))
                .thenReturn(Optional.of(existingSession));
        when(operatorRepository.findById("op-1")).thenReturn(Optional.of(testOperator));
        when(sessionRepository.save(any(OperatorSessionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        OperatorAuthDTOs.OperatorAuthResponse refreshed = authService.refresh(
                rawRefreshToken, "127.0.0.1", "TestAgent"
        );

        assertThat(refreshed).isNotNull();
        assertThat(refreshed.accessToken()).isNotBlank();
        assertThat(refreshed.refreshToken()).isNotEqualTo(rawRefreshToken);

        // Verify old session revoked
        assertThat(existingSession.isRevoked()).isTrue();
        assertThat(existingSession.getRevokedBy()).isEqualTo("TOKEN_ROTATED");
    }

    @Test
    void logoutRevokesSession() {
        UUID sessionId = UUID.randomUUID();
        OperatorSessionEntity session = new OperatorSessionEntity(
                "op-1", "hash", "127.0.0.1", "Agent", Instant.now().plus(1, ChronoUnit.DAYS)
        );
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));

        AuthPrincipal principal = AuthPrincipal.forOperator("op-1", sessionId, "operator@prowise.io", "role-platform-operator", "platform-operations");
        authService.logout(principal);

        assertThat(session.isRevoked()).isTrue();
        assertThat(session.getRevokedBy()).isEqualTo("operator@prowise.io");
        verify(sessionRepository).save(session);
    }

    @Test
    void acceptInvitationActivatesOperatorAndSetsPassword() {
        String rawToken = "invite-token-abc";
        String hash = OperatorAuthService.hash(rawToken);

        OperatorInvitationEntity invite = new OperatorInvitationEntity(
                "op-1", "operator@prowise.io", hash, Instant.now().plus(5, ChronoUnit.DAYS)
        );

        testOperator.setStatus("INVITED");
        testOperator.setPasswordSetupCompleted(false);

        when(invitationRepository.findByTokenHashAndAcceptedAtIsNull(hash)).thenReturn(Optional.of(invite));
        when(operatorRepository.findById("op-1")).thenReturn(Optional.of(testOperator));
        when(operatorRepository.save(any(PlatformOperatorEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(sessionRepository.save(any(OperatorSessionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        OperatorAuthDTOs.OperatorAuthResponse response = authService.acceptInvitation(
                rawToken, "BrandNewPassword123!", "Taylor Vance"
        );

        assertThat(response).isNotNull();
        assertThat(testOperator.getStatus()).isEqualTo("ACTIVE");
        assertThat(testOperator.isPasswordSetupCompleted()).isTrue();
        assertThat(passwordEncoder.matches("BrandNewPassword123!", testOperator.getPasswordHash())).isTrue();
        assertThat(invite.getAcceptedAt()).isNotNull();
    }
}
