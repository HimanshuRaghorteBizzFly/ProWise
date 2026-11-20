package com.prowise.superadmin.users;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.prowise.common.api.ApiException;
import com.prowise.identity.AuthAuditLogRepository;
import com.prowise.identity.EmailCredentialService;
import com.prowise.identity.UserEntity;
import com.prowise.identity.UserLoginHistoryEntity;
import com.prowise.identity.UserLoginHistoryRepository;
import com.prowise.identity.UserRepository;
import com.prowise.identity.UserRoleEntity;
import com.prowise.identity.UserRoleRepository;

@DisplayName("Super Admin User Management Service Tests")
class SuperAdminUserManagementTest {

    private UserRepository userRepository;
    private UserRoleRepository userRoleRepository;
    private UserLoginHistoryRepository loginHistoryRepository;
    private AuthAuditLogRepository auditLogRepository;
    private EmailCredentialService emailCredentialService;
    private PasswordEncoder passwordEncoder;
    private JdbcTemplate jdbc;
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

        when(passwordEncoder.encode(anyString())).thenAnswer(inv -> "encoded_" + inv.getArgument(0));

        userService = new SuperAdminUserService(
                userRepository,
                userRoleRepository,
                loginHistoryRepository,
                auditLogRepository,
                emailCredentialService,
                passwordEncoder,
                jdbc
        );
    }

    @Test
    @DisplayName("Create user with auto-generated secure password and deliver email")
    void testCreateUserSuccess() {
        UUID orgId = UUID.randomUUID();
        UserDTOs.CreateUserRequest request = new UserDTOs.CreateUserRequest(
                "Jane Doe",
                "jane.doe@example.com",
                "DEVELOPER",
                null,
                orgId,
                "+1234567890",
                true,
                null
        );

        when(userRepository.existsByEmailIgnoreCase("jane.doe@example.com")).thenReturn(false);
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(emailCredentialService.sendWelcomeCredentials(any(), any(), any(), isNull()))
                .thenReturn(new EmailCredentialService.EmailDeliveryResult(true, "SENT", "Simulated email sent to jane.doe@example.com"));

        UserDTOs.UserResponse response = userService.createUser(
                request,
                UUID.randomUUID(),
                "superadmin@prowise.com",
                "127.0.0.1"
        );

        assertNotNull(response);
        assertEquals("jane.doe@example.com", response.email());
        assertEquals("Jane Doe", response.name());
        assertEquals("DEVELOPER", response.role());
        assertEquals("ACTIVE", response.status());
        assertTrue(response.mustChangePassword());
        assertNotNull(response.tempPassword());
        assertEquals("SENT", response.emailDeliveryStatus());

        verify(userRepository).save(any(UserEntity.class));
        verify(userRoleRepository).save(any(UserRoleEntity.class));
        verify(emailCredentialService).sendWelcomeCredentials(eq("jane.doe@example.com"), eq("Jane Doe"), anyString(), isNull());
    }

    @Test
    @DisplayName("Create user with duplicate email throws 409 Conflict")
    void testCreateUserDuplicateEmailFails() {
        UserDTOs.CreateUserRequest request = new UserDTOs.CreateUserRequest(
                "Jane Doe",
                "existing@example.com",
                "DEVELOPER",
                null,
                null,
                null,
                true,
                null
        );

        when(userRepository.existsByEmailIgnoreCase("existing@example.com")).thenReturn(true);

        ApiException ex = assertThrows(ApiException.class, () -> userService.createUser(
                request,
                UUID.randomUUID(),
                "superadmin@prowise.com",
                "127.0.0.1"
        ));

        assertEquals("EMAIL_IN_USE", ex.code());
    }

    @Test
    @DisplayName("Create user with invalid email throws 400 Bad Request")
    void testCreateUserInvalidEmailFails() {
        UserDTOs.CreateUserRequest request = new UserDTOs.CreateUserRequest(
                "Jane Doe",
                "invalid-email",
                "DEVELOPER",
                null,
                null,
                null,
                true,
                null
        );

        assertThrows(ApiException.class, () -> userService.createUser(
                request,
                UUID.randomUUID(),
                "superadmin@prowise.com",
                "127.0.0.1"
        ));
    }

    @Test
    @DisplayName("List users returns paginated UserResponse")
    void testListUsers() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity(userId, "alex@example.com", "hash", "Alex", "DEVELOPER", "ACTIVE", false);
        Page<UserEntity> entityPage = new PageImpl<>(List.of(user));

        when(userRepository.searchUsers(any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(entityPage);

        Page<UserDTOs.UserResponse> page = userService.listUsers(null, null, null, null, null, 0, 15);

        assertNotNull(page);
        assertEquals(1, page.getTotalElements());
        assertEquals("alex@example.com", page.getContent().get(0).email());
        assertEquals("Alex", page.getContent().get(0).name());
    }

    @Test
    @DisplayName("Get user by ID returns user response or throws NOT_FOUND")
    void testGetUser() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity(userId, "test@example.com", "hash", "Test", "VIEWER", "ACTIVE", false);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.findById(UUID.fromString("00000000-0000-0000-0000-000000000099"))).thenReturn(Optional.empty());

        UserDTOs.UserResponse found = userService.getUser(userId);
        assertNotNull(found);
        assertEquals("test@example.com", found.email());

        assertThrows(ApiException.class, () ->
                userService.getUser(UUID.fromString("00000000-0000-0000-0000-000000000099")));
    }

    @Test
    @DisplayName("Update user updates fields and synchronizes user_roles")
    void testUpdateUser() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity(userId, "test@example.com", "hash", "Old Name", "VIEWER", "ACTIVE", false);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        UserDTOs.UpdateUserRequest updateReq = new UserDTOs.UpdateUserRequest(
                "New Name",
                "PROJECT_MANAGER",
                null,
                null,
                "+1987654321"
        );

        UserDTOs.UserResponse updated = userService.updateUser(
                userId,
                updateReq,
                UUID.randomUUID(),
                "superadmin@prowise.com",
                "127.0.0.1"
        );

        assertEquals("New Name", updated.name());
        assertEquals("PROJECT_MANAGER", updated.role());
        assertEquals("+1987654321", updated.phone());
        verify(userRepository).save(any(UserEntity.class));
    }

    @Test
    @DisplayName("Update status deactivates user and invalidates active sessions")
    void testUpdateStatusDeactivate() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity(userId, "test@example.com", "hash", "Test", "DEVELOPER", "ACTIVE", false);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        userService.updateStatus(
                userId,
                "DISABLED",
                UUID.randomUUID(),
                "superadmin@prowise.com",
                "127.0.0.1"
        );

        assertEquals("DISABLED", user.getStatus());
        verify(jdbc).update(eq("UPDATE sessions SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL"), eq(userId));
    }

    @Test
    @DisplayName("Reset password generates new temporary password and delivers via email")
    void testResetPassword() {
        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity(userId, "test@example.com", "oldHash", "Test User", "DEVELOPER", "ACTIVE", false);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));
        when(emailCredentialService.sendWelcomeCredentials(any(), any(), any(), isNull()))
                .thenReturn(new EmailCredentialService.EmailDeliveryResult(true, "SENT", "Email sent"));

        UserDTOs.ResetPasswordResponse reset = userService.resetPassword(
                userId,
                UUID.randomUUID(),
                "superadmin@prowise.com",
                "127.0.0.1"
        );

        assertNotNull(reset);
        assertEquals("test@example.com", reset.email());
        assertNotNull(reset.tempPassword());
        assertTrue(user.getMustChangePassword());
        assertEquals("SENT", reset.emailDeliveryStatus());

        verify(userRepository).save(user);
        verify(emailCredentialService).sendWelcomeCredentials(eq("test@example.com"), eq("Test User"), anyString(), isNull());
    }

    @Test
    @DisplayName("Get login history returns mapped entries")
    void testGetLoginHistory() {
        UUID userId = UUID.randomUUID();
        UserLoginHistoryEntity history = new UserLoginHistoryEntity(
                userId,
                "test@example.com",
                "192.168.1.1",
                "Mozilla/5.0",
                "SUCCESS",
                null
        );

        when(loginHistoryRepository.findByUserIdOrderByCreatedAtDesc(eq(userId))).thenReturn(List.of(history));

        List<UserDTOs.LoginHistoryResponse> result = userService.getLoginHistory(userId);

        assertNotNull(result);
        assertEquals(1, result.size());
        assertEquals("SUCCESS", result.get(0).status());
        assertEquals("192.168.1.1", result.get(0).ipAddress());
    }
}
