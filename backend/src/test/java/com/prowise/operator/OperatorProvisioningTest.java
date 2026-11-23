package com.prowise.operator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.prowise.common.api.ApiException;
import com.prowise.identity.EmailCredentialService;
import com.prowise.identity.JwtService;
import com.prowise.notification.EmailSender;
import com.prowise.operator.auth.OperatorAuthService;

/** Approved decisions 2 and 3 applied to operators: no shared default password, a 72-hour emailed invitation. */
@Tag("NFR-06")
class OperatorProvisioningTest {

    private static final String PUBLISHED_DEFAULT = "Operator2026!";

    private PlatformOperatorRepository operatorRepository;
    private OperatorInvitationRepository invitationRepository;
    private OperatorAuditLogRepository auditLogRepository;
    private EmailCredentialService emailCredentialService;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private OperatorService operatorService;

    @BeforeEach
    void setUp() {
        operatorRepository = mock(PlatformOperatorRepository.class);
        invitationRepository = mock(OperatorInvitationRepository.class);
        auditLogRepository = mock(OperatorAuditLogRepository.class);
        emailCredentialService = mock(EmailCredentialService.class);
        when(operatorRepository.save(any(PlatformOperatorEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(emailCredentialService.sendOperatorInvitationEmail(anyString(), anyString(), anyString()))
                .thenReturn(new EmailCredentialService.EmailDeliveryResult(true, "SMTP_ACCEPTED", "Invitation email sent."));

        operatorService = new OperatorService(
                operatorRepository, mock(OperatorDepartmentRepository.class), mock(OperatorDepartmentPermissionRepository.class),
                mock(OperatorOverrideRepository.class), mock(OperatorSessionRepository.class), auditLogRepository,
                invitationRepository, passwordEncoder, emailCredentialService);
    }

    @Test
    void newOperatorHasNoUsablePasswordAndReceivesA72HourInvitation() {
        when(operatorRepository.findByEmailIgnoreCase("new.op@prowise.io")).thenReturn(Optional.empty());

        operatorService.createOperator(new OperatorDTOs.CreateOperatorRequest(
                "New Op", "new.op@prowise.io", null, "DEPARTMENT_OPERATOR", "site-reliability", null, true, false, null),
                "superadmin@prowise.com");

        ArgumentCaptor<PlatformOperatorEntity> saved = ArgumentCaptor.forClass(PlatformOperatorEntity.class);
        verify(operatorRepository).save(saved.capture());
        assertThat(passwordEncoder.matches(PUBLISHED_DEFAULT, saved.getValue().getPasswordHash())).isFalse();
        assertThat(saved.getValue().isPasswordSetupCompleted()).isFalse();

        ArgumentCaptor<OperatorInvitationEntity> invite = ArgumentCaptor.forClass(OperatorInvitationEntity.class);
        verify(invitationRepository).save(invite.capture());
        assertThat(Duration.between(Instant.now(), invite.getValue().getExpiresAt()))
                .isBetween(Duration.ofHours(71), Duration.ofHours(72));

        ArgumentCaptor<String> rawToken = ArgumentCaptor.forClass(String.class);
        verify(emailCredentialService).sendOperatorInvitationEmail(eq("new.op@prowise.io"), eq("New Op"), rawToken.capture());
        assertThat(OperatorAuthService.hash(rawToken.getValue())).isEqualTo(invite.getValue().getTokenHash());
    }

    @Test
    void resendExpiresEarlierInvitationsAndEmailsANewOne() {
        PlatformOperatorEntity op = new PlatformOperatorEntity();
        op.setId("op-x");
        op.setName("Op X");
        op.setEmail("op.x@prowise.io");
        op.setStatus("INVITED");
        when(operatorRepository.findById("op-x")).thenReturn(Optional.of(op));
        OperatorInvitationEntity older = new OperatorInvitationEntity("op-x", "op.x@prowise.io", "old-hash",
                Instant.now().plus(Duration.ofHours(10)));
        when(invitationRepository.findByOperatorIdAndAcceptedAtIsNull("op-x")).thenReturn(List.of(older));

        operatorService.resendInvitation("op-x", "superadmin@prowise.com");

        assertThat(older.getExpiresAt()).isBeforeOrEqualTo(Instant.now());
        verify(emailCredentialService).sendOperatorInvitationEmail(eq("op.x@prowise.io"), eq("Op X"), anyString());
    }

    @Test
    void operatorWhoHasNotCompletedSetupCannotSignIn() {
        PlatformOperatorEntity op = new PlatformOperatorEntity();
        op.setId("op-y");
        op.setEmail("op.y@prowise.io");
        op.setStatus("ACTIVE");
        op.setPasswordHash(passwordEncoder.encode("Known-Pass-123!"));
        op.setPasswordSetupCompleted(false);
        when(operatorRepository.findByEmailIgnoreCase("op.y@prowise.io")).thenReturn(Optional.of(op));

        OperatorAuthService authService = new OperatorAuthService(
                operatorRepository, mock(OperatorSessionRepository.class), invitationRepository,
                mock(OperatorPasswordResetRepository.class), mock(OperatorLoginHistoryRepository.class),
                mock(OperatorDepartmentPermissionRepository.class), mock(OperatorOverrideRepository.class),
                passwordEncoder, new JwtService("unit-test-signing-key-with-at-least-32-bytes!", 15),
                mock(EmailSender.class), 30, 15);

        assertThatThrownBy(() -> authService.login("op.y@prowise.io", "Known-Pass-123!", false, "127.0.0.1", "test"))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo("ACCOUNT_SETUP_INCOMPLETE");
    }
}
