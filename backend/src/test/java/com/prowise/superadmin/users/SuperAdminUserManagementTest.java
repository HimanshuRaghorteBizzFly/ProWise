package com.prowise.superadmin.users;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.prowise.common.api.ApiException;
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
import com.prowise.operator.operations.EmailDeliveryLogRepository;

@DisplayName("Super Admin User Management Service Tests")
class SuperAdminUserManagementTest {

    private UserRepository userRepository;
    private UserRoleRepository userRoleRepository;
    private UserLoginHistoryRepository loginHistoryRepository;
    private AuthAuditLogRepository auditLogRepository;
    private EmailCredentialService emailCredentialService;
    private PasswordEncoder passwordEncoder;
    private JdbcTemplate jdbc;
    private AccountTokenService accountTokenService;
    private EmailDeliveryLogRepository deliveryLogRepository;
    private SuperAdminUserService userService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        userRoleRepository = mock(UserRoleRepository.class);
        loginHistoryRepository = mock(UserLoginHistoryRepository.class);
        auditLogRepository = mock(AuthAuditLogRepository.class);
        emailCredentialService = mock(EmailCredentialService.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jdbc = mock(JdbcTemplate.class);
        accountTokenService = mock(AccountTokenService.class);
        deliveryLogRepository = mock(EmailDeliveryLogRepository.class);

        when(passwordEncoder.encode(anyString())).thenAnswer(inv -> "encoded_" + inv.getArgument(0));

        userService = new SuperAdminUserService(
                userRepository,
                userRoleRepository,
                loginHistoryRepository,
                auditLogRepository,
                emailCredentialService,
                passwordEncoder,
                jdbc,
                accountTokenService,
                deliveryLogRepository
        );
    }

    @Test
    @DisplayName("Create user stores a pending account, emails a setup link and returns no password")
    void testCreateUserSuccess() {
        UUID orgId = UUID.randomUUID();
        UserDTOs.CreateUserRequest request = new UserDTOs.CreateUserRequest(
                "Jane Doe", "jane.doe@example.com", "DEVELOPER", null, orgId, "+1234567890", true);

        when(userRepository.existsByEmailIgnoreCase("jane.doe@example.com")).thenReturn(false);
        when(userRepository.saveAndFlush(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(accountTokenService.issue(any(), eq(AccountTokenService.Purpose.SETUP))).thenReturn("raw-setup-token");
        when(emailCredentialService.sendAccountSetupEmail(any(), eq("jane.doe@example.com"), eq("Jane Doe"), eq("raw-setup-token")))
                .thenReturn(new EmailCredentialService.EmailDeliveryResult(true, "SMTP_ACCEPTED", "Setup email sent."));

        UserDTOs.UserResponse response = userService.createUser(request, UUID.randomUUID(), "superadmin@prowise.com", "127.0.0.1");

        assertEquals("jane.doe@example.com", response.email());
        assertEquals("DEVELOPER", response.role());
        assertEquals("PENDING_ACTIVATION", response.status());
        assertFalse(response.mustChangePassword());
        assertEquals("SMTP_ACCEPTED", response.emailDeliveryStatus());
        assertFalse(Arrays.stream(UserDTOs.UserResponse.class.getRecordComponents())
                .anyMatch(c -> c.getName().toLowerCase().contains("password") && !c.getName().equals("mustChangePassword")));

        ArgumentCaptor<UserEntity> saved = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).saveAndFlush(saved.capture());
        assertNotNull(saved.getValue().getPasswordHash());
        assertFalse(response.toString().contains("raw-setup-token"));
        verify(userRoleRepository).save(any(UserRoleEntity.class));
        verify(accountTokenService).issue(saved.getValue().getId(), AccountTokenService.Purpose.SETUP);
    }

    @Test
    @DisplayName("Create user keeps the pending account when the setup email fails")
    void testCreateUserEmailFailureKeepsPendingAccount() {
        when(userRepository.existsByEmailIgnoreCase(any())).thenReturn(false);
        when(userRepository.saveAndFlush(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(accountTokenService.issue(any(), any())).thenReturn("raw-setup-token");
        when(emailCredentialService.sendAccountSetupEmail(any(), any(), any(), any()))
                .thenReturn(new EmailCredentialService.EmailDeliveryResult(false, "FAILED", EmailCredentialService.SAFE_FAILURE_MESSAGE));

        UserDTOs.UserResponse response = userService.createUser(
                new UserDTOs.CreateUserRequest("Fail", "fail@example.com", "VIEWER", null, null, null, true),
                UUID.randomUUID(), "superadmin@prowise.com", "127.0.0.1");

        assertEquals("PENDING_ACTIVATION", response.status());
        assertEquals("FAILED", response.emailDeliveryStatus());
        verify(userRepository).saveAndFlush(any(UserEntity.class));
    }

    @Test
    @DisplayName("Create user refuses platform roles and records the attempt")
    void testCreateUserRejectsPrivilegedRoles() {
        for (String role : List.of("SUPER_ADMIN", "PLATFORM_SUPER_ADMIN", "PLATFORM_OPERATOR", "platform_operator")) {
            ApiException ex = assertThrows(ApiException.class, () -> userService.createUser(
                    new UserDTOs.CreateUserRequest("X", UUID.randomUUID() + "@example.com", role, null, null, null, true),
                    UUID.randomUUID(), "superadmin@prowise.com", "127.0.0.1"));
            assertEquals("ROLE_NOT_ASSIGNABLE", ex.code());
        }
        verify(userRepository, never()).saveAndFlush(any(UserEntity.class));
        ArgumentCaptor<AuthAuditLogEntity> audit = ArgumentCaptor.forClass(AuthAuditLogEntity.class);
        verify(auditLogRepository, org.mockito.Mockito.times(4)).save(audit.capture());
        audit.getAllValues().forEach(a -> assertEquals("PRIVILEGED_ROLE_ASSIGNMENT_DENIED", a.getAction()));
    }

    @Test
    @DisplayName("Create user with duplicate email throws 409 Conflict")
    void testCreateUserDuplicateEmailFails() {
        when(userRepository.existsByEmailIgnoreCase("existing@example.com")).thenReturn(true);

        ApiException ex = assertThrows(ApiException.class, () -> userService.createUser(
                new UserDTOs.CreateUserRequest("Jane Doe", "existing@example.com", "DEVELOPER", null, null, null, true),
                UUID.randomUUID(), "superadmin@prowise.com", "127.0.0.1"));

        assertEquals("EMAIL_IN_USE", ex.code());
    }

    @Test
    @DisplayName("Create user with invalid email throws 400 Bad Request")
    void testCreateUserInvalidEmailFails() {
        assertThrows(ApiException.class, () -> userService.createUser(
                new UserDTOs.CreateUserRequest("Jane Doe", "invalid-email", "DEVELOPER", null, null, null, true),
                UUID.randomUUID(), "superadmin@prowise.com", "127.0.0.1"));
    }

    @Test
    @DisplayName("List users returns paginated UserResponse")
    void testListUsers() {
        UserEntity user = new UserEntity(UUID.randomUUID(), "alex@example.com", "hash", "Alex", "DEVELOPER", "ACTIVE", false);
        Page<UserEntity> entityPage = new PageImpl<>(List.of(user));
        when(userRepository.searchUsers(any(), any(), any(), any(), any(), any(Pageable.class))).thenReturn(entityPage);

        Page<UserDTOs.UserResponse> page = userService.listUsers(null, null, null, null, null, 0, 15);

        assertEquals(1, page.getTotalElements());
        assertEquals("alex@example.com", page.getContent().get(0).email());
        assertEquals("Alex", page.getContent().get(0).name());
    }

    @Test
    @DisplayName("Get user by ID returns user response or throws NOT_FOUND")
    void testGetUser() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity(userId, "test@example.com", "hash", "Test", "VIEWER", "ACTIVE", false);
        UUID missing = UUID.fromString("00000000-0000-0000-0000-000000000099");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.findById(missing)).thenReturn(Optional.empty());

        assertEquals("test@example.com", userService.getUser(userId).email());
        assertThrows(ApiException.class, () -> userService.getUser(missing));
    }

    @Test
    @DisplayName("Update user updates fields and synchronizes user_roles")
    void testUpdateUser() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity(userId, "test@example.com", "hash", "Old Name", "VIEWER", "ACTIVE", false);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        UserDTOs.UserResponse updated = userService.updateUser(userId,
                new UserDTOs.UpdateUserRequest("New Name", "PROJECT_MANAGER", null, null, "+1987654321"),
                UUID.randomUUID(), "superadmin@prowise.com", "127.0.0.1");

        assertEquals("New Name", updated.name());
        assertEquals("PROJECT_MANAGER", updated.role());
        assertEquals("+1987654321", updated.phone());
        verify(userRepository).save(any(UserEntity.class));
    }

    @Test
    @DisplayName("Update user refuses a platform role")
    void testUpdateUserRejectsPrivilegedRole() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity(userId, "test@example.com", "hash", "Name", "VIEWER", "ACTIVE", false);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        ApiException ex = assertThrows(ApiException.class, () -> userService.updateUser(userId,
                new UserDTOs.UpdateUserRequest(null, "SUPER_ADMIN", null, null, null),
                UUID.randomUUID(), "superadmin@prowise.com", "127.0.0.1"));

        assertEquals("ROLE_NOT_ASSIGNABLE", ex.code());
        assertEquals("VIEWER", user.getRole());
        verify(userRepository, never()).save(any(UserEntity.class));
    }

    @Test
    @DisplayName("Update status deactivates user and invalidates active sessions")
    void testUpdateStatusDeactivate() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity(userId, "test@example.com", "hash", "Test", "DEVELOPER", "ACTIVE", false);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        userService.updateStatus(userId, "DISABLED", UUID.randomUUID(), "superadmin@prowise.com", "127.0.0.1");

        assertEquals("DISABLED", user.getStatus());
        verify(jdbc).update(eq("UPDATE sessions SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL"), eq(userId));
    }

    @Test
    @DisplayName("Update status cannot activate a pending account without setup")
    void testUpdateStatusCannotSkipSetup() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity(userId, "p@example.com", "hash", "P", "DEVELOPER", "PENDING_ACTIVATION", false);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        ApiException ex = assertThrows(ApiException.class,
                () -> userService.updateStatus(userId, "ACTIVE", UUID.randomUUID(), "superadmin@prowise.com", "127.0.0.1"));

        assertEquals("ACCOUNT_PENDING_ACTIVATION", ex.code());
        assertEquals("PENDING_ACTIVATION", user.getStatus());
    }

    @Test
    @DisplayName("Admin reset sends a reset link, revokes sessions and keeps the password hash")
    void testResetPassword() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity(userId, "test@example.com", "oldHash", "Test User", "DEVELOPER", "ACTIVE", false);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(accountTokenService.issue(userId, AccountTokenService.Purpose.RESET)).thenReturn("raw-reset-token");
        when(emailCredentialService.sendPasswordResetEmail(userId, "test@example.com", "Test User", "raw-reset-token"))
                .thenReturn(new EmailCredentialService.EmailDeliveryResult(true, "SMTP_ACCEPTED", "Reset email sent."));

        UserDTOs.CredentialDeliveryResponse reset = userService.resetPassword(userId, UUID.randomUUID(), "superadmin@prowise.com", "127.0.0.1");

        assertEquals("test@example.com", reset.email());
        assertEquals("SMTP_ACCEPTED", reset.emailDeliveryStatus());
        assertEquals("oldHash", user.getPasswordHash());
        verify(jdbc).update(eq("UPDATE sessions SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL"), eq(userId));
        verify(passwordEncoder, never()).encode(anyString());
    }

    @Test
    @DisplayName("Admin reset is refused for a pending account")
    void testResetPasswordRefusedForPendingAccount() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.of(
                new UserEntity(userId, "p@example.com", "hash", "P", "DEVELOPER", "PENDING_ACTIVATION", false)));

        ApiException ex = assertThrows(ApiException.class,
                () -> userService.resetPassword(userId, UUID.randomUUID(), "superadmin@prowise.com", "127.0.0.1"));
        assertEquals("ACCOUNT_PENDING_ACTIVATION", ex.code());
        verify(accountTokenService, never()).issue(any(), any());
    }

    @Test
    @DisplayName("Resend issues a fresh setup link only for pending accounts")
    void testResendInvitation() {
        UUID pendingId = UUID.randomUUID();
        when(userRepository.findById(pendingId)).thenReturn(Optional.of(
                new UserEntity(pendingId, "p@example.com", "hash", "P", "DEVELOPER", "PENDING_ACTIVATION", false)));
        when(accountTokenService.issue(pendingId, AccountTokenService.Purpose.SETUP)).thenReturn("raw-setup-token-2");
        when(emailCredentialService.sendAccountSetupEmail(pendingId, "p@example.com", "P", "raw-setup-token-2"))
                .thenReturn(new EmailCredentialService.EmailDeliveryResult(true, "SMTP_ACCEPTED", "Setup email sent."));

        assertEquals("SMTP_ACCEPTED", userService.resendInvitation(pendingId, UUID.randomUUID(), "superadmin@prowise.com", "127.0.0.1")
                .emailDeliveryStatus());

        UUID activeId = UUID.randomUUID();
        when(userRepository.findById(activeId)).thenReturn(Optional.of(
                new UserEntity(activeId, "a@example.com", "hash", "A", "DEVELOPER", "ACTIVE", false)));
        ApiException ex = assertThrows(ApiException.class,
                () -> userService.resendInvitation(activeId, UUID.randomUUID(), "superadmin@prowise.com", "127.0.0.1"));
        assertEquals("ACCOUNT_ALREADY_ACTIVE", ex.code());
    }

    @Test
    @DisplayName("Get login history returns mapped entries")
    void testGetLoginHistory() {
        UUID userId = UUID.randomUUID();
        UserLoginHistoryEntity history = new UserLoginHistoryEntity(
                userId, "test@example.com", "192.168.1.1", "Mozilla/5.0", "SUCCESS", null);
        when(loginHistoryRepository.findByUserIdOrderByCreatedAtDesc(eq(userId))).thenReturn(List.of(history));

        List<UserDTOs.LoginHistoryResponse> result = userService.getLoginHistory(userId);

        assertEquals(1, result.size());
        assertEquals("SUCCESS", result.get(0).status());
        assertEquals("192.168.1.1", result.get(0).ipAddress());
    }
}
