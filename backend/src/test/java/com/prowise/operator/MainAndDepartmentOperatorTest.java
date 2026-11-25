package com.prowise.operator;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.prowise.common.api.ApiException;
import com.prowise.identity.AuthPrincipal;
import com.prowise.identity.JwtService;
import com.prowise.notification.EmailSender;
import com.prowise.operator.auth.OperatorAuthDTOs;
import com.prowise.operator.auth.OperatorAuthService;
import com.prowise.operator.operations.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MainAndDepartmentOperatorTest {

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
    private OperatorAuditLogRepository auditLogRepository;

    private IncidentRepository incidentRepository;
    private IncidentAssignmentRepository assignmentRepository;
    private SupportTicketRepository ticketRepository;
    private SupportAccessRequestRepository accessRequestRepository;
    private IntegrationInstallationRepository integrationRepository;
    private GitHubRepositoryLinkRepository githubRepoRepository;
    private WebhookReceiptRepository webhookRepository;
    private BackgroundJobRepository jobRepository;
    private MaintenanceWindowRepository maintenanceRepository;
    private EmailDeliveryLogRepository emailLogRepository;
    private OperationalAlertRepository alertRepository;
    private OperatorActivityLogRecordRepository activityLogRepository;

    private OperatorAuthService authService;
    private OperatorService operatorService;
    private OperatorOperationsService operationsService;

    @BeforeEach
    void setUp() {
        operatorRepository = Mockito.mock(PlatformOperatorRepository.class);
        sessionRepository = Mockito.mock(OperatorSessionRepository.class);
        invitationRepository = Mockito.mock(OperatorInvitationRepository.class);
        passwordResetRepository = Mockito.mock(OperatorPasswordResetRepository.class);
        loginHistoryRepository = Mockito.mock(OperatorLoginHistoryRepository.class);
        departmentPermissionRepository = Mockito.mock(OperatorDepartmentPermissionRepository.class);
        overrideRepository = Mockito.mock(OperatorOverrideRepository.class);
        passwordEncoder = Mockito.mock(PasswordEncoder.class);
        emailSender = Mockito.mock(EmailSender.class);
        auditLogRepository = Mockito.mock(OperatorAuditLogRepository.class);
        jwtService = new JwtService("unit-test-signing-key-with-at-least-32-bytes!", 15);

        authService = new OperatorAuthService(
                operatorRepository, sessionRepository, invitationRepository,
                passwordResetRepository, loginHistoryRepository, departmentPermissionRepository,
                overrideRepository, passwordEncoder, jwtService, emailSender, 30, 15
        );

        operatorService = new OperatorService(
                operatorRepository, null, departmentPermissionRepository,
                overrideRepository, sessionRepository, auditLogRepository,
                invitationRepository, passwordEncoder
        );

        incidentRepository = Mockito.mock(IncidentRepository.class);
        assignmentRepository = Mockito.mock(IncidentAssignmentRepository.class);
        ticketRepository = Mockito.mock(SupportTicketRepository.class);
        accessRequestRepository = Mockito.mock(SupportAccessRequestRepository.class);
        integrationRepository = Mockito.mock(IntegrationInstallationRepository.class);
        githubRepoRepository = Mockito.mock(GitHubRepositoryLinkRepository.class);
        webhookRepository = Mockito.mock(WebhookReceiptRepository.class);
        jobRepository = Mockito.mock(BackgroundJobRepository.class);
        maintenanceRepository = Mockito.mock(MaintenanceWindowRepository.class);
        emailLogRepository = Mockito.mock(EmailDeliveryLogRepository.class);
        alertRepository = Mockito.mock(OperationalAlertRepository.class);
        activityLogRepository = Mockito.mock(OperatorActivityLogRecordRepository.class);

        operationsService = new OperatorOperationsService(
                incidentRepository, assignmentRepository, ticketRepository,
                accessRequestRepository, integrationRepository, githubRepoRepository,
                webhookRepository, jobRepository, maintenanceRepository,
                emailLogRepository, alertRepository, activityLogRepository,
                operatorRepository
        );
    }

    @Test
    @DisplayName("Main Platform Operator login receives global scope across all 7 departments and accessLevel claim")
    void mainPlatformOperatorLogin_receivesGlobalScope() {
        PlatformOperatorEntity mainOp = new PlatformOperatorEntity();
        mainOp.setId("op-main-1");
        mainOp.setName("Platform Director");
        mainOp.setEmail("main.operator@prowise.io");
        mainOp.setAccessLevel(OperatorAccessLevel.MAIN_PLATFORM_OPERATOR);
        mainOp.setDepartmentId(null);
        mainOp.setStatus("ACTIVE");
        mainOp.setPasswordHash("encoded-hash");
        mainOp.setPasswordSetupCompleted(true);

        when(operatorRepository.findByEmailIgnoreCase("main.operator@prowise.io")).thenReturn(Optional.of(mainOp));
        when(passwordEncoder.matches("Operator2026!", "encoded-hash")).thenReturn(true);
        when(sessionRepository.save(any(OperatorSessionEntity.class))).thenAnswer(i -> {
            OperatorSessionEntity s = i.getArgument(0);
            s.setId(UUID.randomUUID());
            return s;
        });
        when(departmentPermissionRepository.findAll()).thenReturn(Collections.emptyList());

        OperatorAuthDTOs.OperatorAuthResponse response = authService.login(
                "main.operator@prowise.io", "Operator2026!", false, "127.0.0.1", "JUnit"
        );

        assertNotNull(response);
        assertEquals("MAIN_PLATFORM_OPERATOR", response.operator().accessLevel());
        assertTrue(response.authorizedModules().contains("operations.dashboard"));
        assertTrue(response.authorizedModules().contains("operations.monitoring"));
        assertTrue(response.authorizedModules().contains("incidents.management"));
        assertTrue(response.authorizedModules().contains("integrations.github"));
        assertTrue(response.authorizedModules().contains("communications.email_delivery"));
        assertTrue(response.authorizedModules().contains("billing.subscriptions"));
        assertTrue(response.authorizedModules().contains("team.workload"));

        AuthPrincipal parsed = jwtService.parse(response.accessToken());
        assertEquals("MAIN_PLATFORM_OPERATOR", parsed.accessLevel());
        assertTrue(parsed.isMainPlatformOperator());
    }

    @Test
    @DisplayName("Department Operator login is strictly scoped to assigned department modules")
    void departmentOperatorLogin_strictlyScopedToDepartment() {
        PlatformOperatorEntity deptOp = new PlatformOperatorEntity();
        deptOp.setId("op-msg-1");
        deptOp.setName("Messaging Engineer");
        deptOp.setEmail("messaging@prowise.io");
        deptOp.setAccessLevel(OperatorAccessLevel.DEPARTMENT_OPERATOR);
        deptOp.setDepartmentId("lifecycle-messaging");
        deptOp.setStatus("ACTIVE");
        deptOp.setPasswordHash("encoded-hash");
        deptOp.setPasswordSetupCompleted(true);

        when(operatorRepository.findByEmailIgnoreCase("messaging@prowise.io")).thenReturn(Optional.of(deptOp));
        when(passwordEncoder.matches("Pass123!", "encoded-hash")).thenReturn(true);
        when(sessionRepository.save(any(OperatorSessionEntity.class))).thenAnswer(i -> {
            OperatorSessionEntity s = i.getArgument(0);
            s.setId(UUID.randomUUID());
            return s;
        });
        when(overrideRepository.findByOperatorId("op-msg-1")).thenReturn(Collections.emptyList());

        OperatorAuthDTOs.OperatorAuthResponse response = authService.login(
                "messaging@prowise.io", "Pass123!", false, "127.0.0.1", "JUnit"
        );

        assertNotNull(response);
        assertEquals("DEPARTMENT_OPERATOR", response.operator().accessLevel());
        assertEquals("lifecycle-messaging", response.operator().departmentId());
        assertTrue(response.authorizedModules().contains("communications.email_delivery"));
        assertFalse(response.authorizedModules().contains("integrations.github"), "Messaging operator should not see GitHub monitoring");
        assertFalse(response.authorizedModules().contains("billing.subscriptions"), "Messaging operator should not see Billing subscriptions");
    }

    @Test
    @DisplayName("Super Admin promotes operator to MAIN_PLATFORM_OPERATOR and revokes active sessions immediately")
    void superAdminUpdatesAccessLevel_revokesActiveSessions() {
        PlatformOperatorEntity op = new PlatformOperatorEntity();
        op.setId("op-dept-9");
        op.setName("Candidate Lead");
        op.setEmail("lead@prowise.io");
        op.setAccessLevel(OperatorAccessLevel.DEPARTMENT_OPERATOR);
        op.setDepartmentId("platform-operations");
        op.setStatus("ACTIVE");

        when(operatorRepository.findById("op-dept-9")).thenReturn(Optional.of(op));
        when(operatorRepository.save(any(PlatformOperatorEntity.class))).thenAnswer(i -> i.getArgument(0));
        // Version-guarded UPDATE (rule 5) succeeds: the operator is still at the version the caller read.
        when(operatorRepository.bumpVersion(any(String.class), org.mockito.ArgumentMatchers.anyLong())).thenReturn(1);

        OperatorDTOs.OperatorResponse updated = operatorService.updateAccessLevel("op-dept-9", "MAIN_PLATFORM_OPERATOR", 0L, "Super Admin");

        assertEquals("MAIN_PLATFORM_OPERATOR", updated.accessLevel());
        verify(sessionRepository).revokeAllByOperatorId(eq("op-dept-9"), any(String.class));
    }

    @Test
    @DisplayName("Super Admin changes operator department and revokes active sessions immediately")
    void superAdminUpdatesDepartment_revokesActiveSessions() {
        PlatformOperatorEntity op = new PlatformOperatorEntity();
        op.setId("op-dept-8");
        op.setName("Rotating Engineer");
        op.setEmail("rot@prowise.io");
        op.setAccessLevel(OperatorAccessLevel.DEPARTMENT_OPERATOR);
        op.setDepartmentId("platform-operations");
        op.setStatus("ACTIVE");

        when(operatorRepository.findById("op-dept-8")).thenReturn(Optional.of(op));
        when(operatorRepository.save(any(PlatformOperatorEntity.class))).thenAnswer(i -> i.getArgument(0));
        // Version-guarded UPDATE (rule 5) succeeds: the operator is still at the version the caller read.
        when(operatorRepository.bumpVersion(any(String.class), org.mockito.ArgumentMatchers.anyLong())).thenReturn(1);

        OperatorDTOs.OperatorResponse updated = operatorService.updateDepartment("op-dept-8", "site-reliability", 0L, "Super Admin");

        verify(sessionRepository).revokeAllByOperatorId(eq("op-dept-8"), any(String.class));
    }

    @Test
    @DisplayName("Main Platform Operator coordinates and assigns incident across departments")
    void mainOperatorCanAssignIncidentAcrossDepartments() {
        IncidentEntity inc = new IncidentEntity("inc-201", "Database Pool Saturation", "SEV_1", "INVESTIGATING", "site-reliability", "Conn pool exhausted");
        when(incidentRepository.findById("inc-201")).thenReturn(Optional.of(inc));
        when(incidentRepository.save(any(IncidentEntity.class))).thenAnswer(i -> i.getArgument(0));

        PlatformOperatorEntity targetOp = new PlatformOperatorEntity();
        targetOp.setId("op-sre-lead");
        targetOp.setName("Lead SRE");
        targetOp.setDepartmentId("site-reliability");
        when(operatorRepository.findById("op-sre-lead")).thenReturn(Optional.of(targetOp));

        AuthPrincipal mainPrincipal = AuthPrincipal.forOperator(
                "op-main-1", UUID.randomUUID(), "main.operator@prowise.io", "role-platform-operator", null, "MAIN_PLATFORM_OPERATOR"
        );

        OperatorDTOs.IncidentResponse res = operationsService.assignIncident(
                "inc-201",
                new OperatorDTOs.AssignIncidentRequest("op-sre-lead", "Please investigate immediately", 0L),
                mainPrincipal,
                "127.0.0.1"
        );

        assertNotNull(res);
        assertEquals("op-sre-lead", res.assignedOperatorId());
        verify(assignmentRepository).save(any(IncidentAssignmentEntity.class));
    }

    @Test
    @DisplayName("Department Operator is denied access to view or assign incidents outside their department")
    void departmentOperatorCannotAccessCrossDepartmentIncidents() {
        IncidentEntity inc = new IncidentEntity("inc-301", "Gateway 504 Timeouts", "SEV_2", "INVESTIGATING", "site-reliability", "Nginx gateway errors");
        when(incidentRepository.findById("inc-301")).thenReturn(Optional.of(inc));

        AuthPrincipal financePrincipal = AuthPrincipal.forOperator(
                "op-fin-1", UUID.randomUUID(), "finance@prowise.io", "role-platform-operator", "finance-tax", "DEPARTMENT_OPERATOR"
        );

        assertThrows(ApiException.class, () -> operationsService.getIncident("inc-301", financePrincipal));
        assertThrows(ApiException.class, () -> operationsService.assignIncident(
                "inc-301", new OperatorDTOs.AssignIncidentRequest("op-sre-lead", "Notes", 0L), financePrincipal, "127.0.0.1"
        ));
    }

    @Test
    @DisplayName("Deactivating operator status terminates active sessions immediately")
    void statusUpdateToInactive_revokesSessions() {
        PlatformOperatorEntity op = new PlatformOperatorEntity();
        op.setId("op-test-1");
        op.setName("Test Operator");
        op.setStatus("ACTIVE");
        when(operatorRepository.findById("op-test-1")).thenReturn(Optional.of(op));
        when(operatorRepository.save(any(PlatformOperatorEntity.class))).thenAnswer(i -> i.getArgument(0));
        // Version-guarded UPDATE (rule 5) succeeds: the operator is still at the version the caller read.
        when(operatorRepository.bumpVersion(any(String.class), org.mockito.ArgumentMatchers.anyLong())).thenReturn(1);

        operatorService.updateOperatorStatus("op-test-1", "INACTIVE", 0L, "Super Admin");

        verify(sessionRepository).revokeAllByOperatorId(eq("op-test-1"), eq("Super Admin"));
    }
}
