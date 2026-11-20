package com.prowise.operator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.prowise.common.api.ApiException;

class OperatorAuthorizationTest {

    private PlatformOperatorRepository operatorRepository;
    private OperatorDepartmentRepository departmentRepository;
    private OperatorDepartmentPermissionRepository departmentPermissionRepository;
    private OperatorOverrideRepository overrideRepository;
    private OperatorSessionRepository sessionRepository;
    private OperatorAuditLogRepository auditLogRepository;
    private OperatorService operatorService;

    @BeforeEach
    void setUp() {
        operatorRepository = mock(PlatformOperatorRepository.class);
        departmentRepository = mock(OperatorDepartmentRepository.class);
        departmentPermissionRepository = mock(OperatorDepartmentPermissionRepository.class);
        overrideRepository = mock(OperatorOverrideRepository.class);
        sessionRepository = mock(OperatorSessionRepository.class);
        auditLogRepository = mock(OperatorAuditLogRepository.class);

        operatorService = new OperatorService(
                operatorRepository,
                departmentRepository,
                departmentPermissionRepository,
                overrideRepository,
                sessionRepository,
                auditLogRepository
        );
    }

    @Test
    void siteReliabilityOperatorReceivesDepartmentDefaultPermissions() {
        PlatformOperatorEntity operator = new PlatformOperatorEntity();
        operator.setId("op-sre-1");
        operator.setName("Jordan Mercer");
        operator.setEmail("jordan@prowise.io");
        operator.setDepartmentId("site-reliability");

        when(operatorRepository.findById("op-sre-1")).thenReturn(Optional.of(operator));
        when(departmentPermissionRepository.findByDepartmentId("site-reliability")).thenReturn(List.of(
                new OperatorDepartmentPermissionEntity("site-reliability", "integrations.webhooks", "view"),
                new OperatorDepartmentPermissionEntity("site-reliability", "integrations.webhooks", "execute")
        ));
        when(overrideRepository.findByOperatorId("op-sre-1")).thenReturn(List.of());

        OperatorDTOs.EffectivePermissionsResponse perms = operatorService.getEffectivePermissions("op-sre-1");
        assertNotNull(perms);
        assertEquals("Site Reliability", perms.department());

        // Check webhook view is allowed from department default
        Optional<OperatorDTOs.PermissionItem> webhookView = perms.permissions().stream()
                .filter(p -> p.moduleKey().equals("integrations.webhooks") && p.action().equals("view"))
                .findFirst();
        assertTrue(webhookView.isPresent());
        assertTrue(webhookView.get().effectiveAllowed());
        assertEquals("DEPARTMENT_DEFAULT", webhookView.get().state());

        // Check billing invoices view is not allowed
        Optional<OperatorDTOs.PermissionItem> invoiceView = perms.permissions().stream()
                .filter(p -> p.moduleKey().equals("billing.invoices") && p.action().equals("view"))
                .findFirst();
        assertTrue(invoiceView.isPresent());
        assertFalse(invoiceView.get().effectiveAllowed());
    }

    @Test
    void explicitDenialOverridesDepartmentDefault() {
        PlatformOperatorEntity operator = new PlatformOperatorEntity();
        operator.setId("op-sre-2");
        operator.setName("Alex SRE");
        operator.setEmail("alex@prowise.io");
        operator.setDepartmentId("site-reliability");

        when(operatorRepository.findById("op-sre-2")).thenReturn(Optional.of(operator));
        when(departmentPermissionRepository.findByDepartmentId("site-reliability")).thenReturn(List.of(
                new OperatorDepartmentPermissionEntity("site-reliability", "integrations.webhooks", "view")
        ));

        // Individual DENY on integrations.webhooks:view
        OperatorPermissionOverrideEntity denyOverride = new OperatorPermissionOverrideEntity(
                "op-sre-2", "integrations.webhooks", "view", "DENY", "Super Admin", "Security restriction"
        );
        when(overrideRepository.findByOperatorId("op-sre-2")).thenReturn(List.of(denyOverride));

        OperatorDTOs.EffectivePermissionsResponse perms = operatorService.getEffectivePermissions("op-sre-2");
        Optional<OperatorDTOs.PermissionItem> webhookView = perms.permissions().stream()
                .filter(p -> p.moduleKey().equals("integrations.webhooks") && p.action().equals("view"))
                .findFirst();

        assertTrue(webhookView.isPresent());
        assertFalse(webhookView.get().effectiveAllowed(), "Explicit denial MUST take precedence over department default");
        assertEquals("INDIVIDUAL_DENY", webhookView.get().state());
    }

    @Test
    void explicitGrantProvidesAdditionalPrivilege() {
        PlatformOperatorEntity operator = new PlatformOperatorEntity();
        operator.setId("op-comm-1");
        operator.setName("Elena Lifecycle");
        operator.setEmail("elena@prowise.io");
        operator.setDepartmentId("lifecycle-messaging");

        when(operatorRepository.findById("op-comm-1")).thenReturn(Optional.of(operator));
        when(departmentPermissionRepository.findByDepartmentId("lifecycle-messaging")).thenReturn(List.of(
                new OperatorDepartmentPermissionEntity("lifecycle-messaging", "communications.email_delivery", "view")
        ));

        // Individual GRANT on billing.subscriptions:view
        OperatorPermissionOverrideEntity grantOverride = new OperatorPermissionOverrideEntity(
                "op-comm-1", "billing.subscriptions", "view", "GRANT", "Super Admin", "Audit cross-check"
        );
        when(overrideRepository.findByOperatorId("op-comm-1")).thenReturn(List.of(grantOverride));

        OperatorDTOs.EffectivePermissionsResponse perms = operatorService.getEffectivePermissions("op-comm-1");
        Optional<OperatorDTOs.PermissionItem> subView = perms.permissions().stream()
                .filter(p -> p.moduleKey().equals("billing.subscriptions") && p.action().equals("view"))
                .findFirst();

        assertTrue(subView.isPresent());
        assertTrue(subView.get().effectiveAllowed(), "Explicit grant should enable permission");
        assertEquals("INDIVIDUAL_GRANT", subView.get().state());
    }

    @Test
    void cannotDeleteOrDeactivateLastActiveSuperAdmin() {
        PlatformOperatorEntity superAdmin = new PlatformOperatorEntity();
        superAdmin.setId("op-admin-1");
        superAdmin.setName("Arthur SuperAdmin");
        superAdmin.setEmail("superadmin@prowise.io");
        superAdmin.setRoleId("role-super-admin");
        superAdmin.setStatus("ACTIVE");

        when(operatorRepository.findById("op-admin-1")).thenReturn(Optional.of(superAdmin));
        when(operatorRepository.countByRoleIdAndStatus("role-super-admin", "ACTIVE")).thenReturn(1L);

        // Attempting to delete last super admin must throw ApiException
        assertThrows(ApiException.class, () -> operatorService.deleteOperator("op-admin-1", "attacker"));

        // Attempting to deactivate last super admin must throw ApiException
        assertThrows(ApiException.class, () -> operatorService.toggleOperatorStatus("op-admin-1", "attacker"));
    }

    @Test
    void revokingSessionsInvalidatesActiveTokens() {
        when(sessionRepository.revokeAllByOperatorId("op-test", "Super Admin")).thenReturn(2);

        operatorService.revokeActiveSessions("op-test", "Super Admin");

        verify(sessionRepository).revokeAllByOperatorId("op-test", "Super Admin");
        verify(auditLogRepository).save(any(OperatorAuditLogEntity.class));
    }
}
