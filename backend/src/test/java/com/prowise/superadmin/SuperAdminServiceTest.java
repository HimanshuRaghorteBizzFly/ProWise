package com.prowise.superadmin;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.prowise.common.api.ApiException;
import com.prowise.operator.PlatformOperatorRepository;
import com.prowise.superadmin.announcements.AnnouncementDTOs;
import com.prowise.superadmin.announcements.AnnouncementEntity;
import com.prowise.superadmin.announcements.AnnouncementRepository;
import com.prowise.superadmin.announcements.AnnouncementService;
import com.prowise.superadmin.audit.AdminAuditLogEntity;
import com.prowise.superadmin.audit.AdminAuditLogRepository;
import com.prowise.superadmin.audit.AuditService;
import com.prowise.superadmin.billing.BillingDTOs;
import com.prowise.superadmin.billing.BillingService;
import com.prowise.superadmin.billing.PaymentEntity;
import com.prowise.superadmin.billing.PaymentRepository;
import com.prowise.superadmin.dashboard.SuperAdminDashboardDTOs;
import com.prowise.superadmin.dashboard.SuperAdminDashboardService;
import com.prowise.superadmin.emailtemplates.EmailTemplateDTOs;
import com.prowise.superadmin.emailtemplates.EmailTemplateEntity;
import com.prowise.superadmin.emailtemplates.EmailTemplateRepository;
import com.prowise.superadmin.emailtemplates.EmailTemplateService;
import com.prowise.superadmin.featureflags.FeatureFlagDTOs;
import com.prowise.superadmin.featureflags.FeatureFlagEntity;
import com.prowise.superadmin.featureflags.FeatureFlagRepository;
import com.prowise.superadmin.featureflags.FeatureFlagService;
import com.prowise.superadmin.invoices.InvoiceDTOs;
import com.prowise.superadmin.invoices.InvoiceEntity;
import com.prowise.superadmin.invoices.InvoiceLineItemRepository;
import com.prowise.superadmin.invoices.InvoiceRepository;
import com.prowise.superadmin.invoices.InvoiceService;
import com.prowise.superadmin.licenses.LicenseDTOs;
import com.prowise.superadmin.licenses.LicenseEntity;
import com.prowise.superadmin.licenses.LicenseRepository;
import com.prowise.superadmin.licenses.LicenseService;
import com.prowise.superadmin.organizations.OrganizationEntity;
import com.prowise.superadmin.organizations.OrganizationRepository;
import com.prowise.superadmin.organizations.SuperAdminOrgDTOs;
import com.prowise.superadmin.organizations.SuperAdminOrgService;
import com.prowise.superadmin.plans.PlanDTOs;
import com.prowise.superadmin.plans.PlanEntity;
import com.prowise.superadmin.plans.PlanFeatureRepository;
import com.prowise.superadmin.plans.PlanRepository;
import com.prowise.superadmin.plans.PlanService;
import com.prowise.superadmin.policies.PlatformBrandingEntity;
import com.prowise.superadmin.policies.PlatformBrandingRepository;
import com.prowise.superadmin.policies.PlatformPolicyEntity;
import com.prowise.superadmin.policies.PlatformPolicyRepository;
import com.prowise.superadmin.policies.PolicyDTOs;
import com.prowise.superadmin.policies.PolicyService;
import com.prowise.superadmin.roles.SystemRoleBaseline;
import com.prowise.superadmin.subscriptions.SubscriptionDTOs;
import com.prowise.superadmin.subscriptions.SubscriptionEntity;
import com.prowise.superadmin.subscriptions.SubscriptionRepository;
import com.prowise.superadmin.subscriptions.SubscriptionService;

public class SuperAdminServiceTest {

    private AuditService auditService;
    private AdminAuditLogRepository auditRepo;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        auditRepo = mock(AdminAuditLogRepository.class);
        auditService = new AuditService(auditRepo);
        objectMapper = new ObjectMapper();
    }

    @Test
    @DisplayName("Print BCrypt Hash")
    void printHash() {
        String hash = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode("Operator2026!");
        System.out.println("BCRYPT_HASH=" + hash);
        assertTrue(new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().matches("Operator2026!", hash));
    }

    @Test
    @DisplayName("Plans: List plans and update plan limits")
    void testPlansModule() {
        PlanRepository planRepo = mock(PlanRepository.class);
        PlanFeatureRepository featureRepo = mock(PlanFeatureRepository.class);
        PlanService planService = new PlanService(planRepo, featureRepo, auditService);

        PlanEntity plan = new PlanEntity();
        plan.setId("plan-pro");
        plan.setCode("PROFESSIONAL");
        plan.setName("Professional");
        plan.setMonthlyPrice(BigDecimal.valueOf(1299));
        plan.setStatus("ACTIVE");
        plan.setMaxSeats(100);

        when(planRepo.findAll()).thenReturn(List.of(plan));
        when(planRepo.findById("plan-pro")).thenReturn(Optional.of(plan));
        when(planRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        List<PlanDTOs.PlanResponse> list = planService.listPlans();
        assertEquals(1, list.size());
        assertEquals("Professional", list.get(0).name());

        PlanDTOs.PlanResponse updated = planService.updatePlan(
                "plan-pro",
                new PlanDTOs.UpdatePlanRequest("Professional Plus", null, null, null, null, null, null, null, null, null, null, null, 0L),
                "superadmin@prowise.io"
        );
        assertEquals("Professional Plus", updated.name());
    }

    @Test
    @DisplayName("Subscriptions: Assign subscription and calculate renewal cycle")
    void testSubscriptionsModule() {
        SubscriptionRepository subRepo = mock(SubscriptionRepository.class);
        PlanRepository planRepo = mock(PlanRepository.class);
        SubscriptionService subService = new SubscriptionService(subRepo, planRepo, auditService);

        UUID orgId = UUID.randomUUID();
        PlanEntity plan = new PlanEntity();
        plan.setId("plan-starter");
        plan.setMonthlyPrice(BigDecimal.valueOf(499));
        plan.setAnnualPrice(BigDecimal.valueOf(4990));

        when(planRepo.findById("plan-starter")).thenReturn(Optional.of(plan));
        when(subRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        SubscriptionDTOs.SubscriptionResponse sub = subService.assignSubscription(
                new SubscriptionDTOs.AssignSubscriptionRequest(orgId, "plan-starter", "MONTHLY", 25, true, "Corporate Card"),
                "superadmin@prowise.io"
        );

        assertNotNull(sub);
        assertEquals("ACTIVE", sub.status());
        assertEquals(BigDecimal.valueOf(499), sub.amount());
        assertEquals(orgId, sub.orgId());
    }

    @Test
    @DisplayName("Billing & Payments: Record payment, retry, and issue partial refund")
    void testBillingModule() {
        PaymentRepository paymentRepo = mock(PaymentRepository.class);
        BillingService billingService = new BillingService(paymentRepo, auditService);

        UUID orgId = UUID.randomUUID();
        when(paymentRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        BillingDTOs.PaymentResponse payment = billingService.recordPayment(
                new BillingDTOs.RecordPaymentRequest(orgId, "sub-1", "inv-1", BigDecimal.valueOf(1299), "USD", "CARD", "4242", "Stripe", "Enterprise Plan"),
                "superadmin@prowise.io"
        );
        assertNotNull(payment);
        assertEquals("SUCCEEDED", payment.status());

        PaymentEntity entity = new PaymentEntity();
        entity.setId(payment.id());
        entity.setTransactionRef(payment.transactionRef());
        entity.setOrgId(orgId);
        entity.setAmount(BigDecimal.valueOf(1299));
        entity.setRefundedAmount(BigDecimal.ZERO);
        entity.setStatus("SUCCEEDED");

        when(paymentRepo.findById(payment.id())).thenReturn(Optional.of(entity));

        BillingDTOs.PaymentResponse refunded = billingService.refundPayment(
                payment.id(),
                new BillingDTOs.RefundPaymentRequest(BigDecimal.valueOf(300), "Billing dispute resolved", 0L),
                "superadmin@prowise.io"
        );
        assertEquals("PARTIALLY_REFUNDED", refunded.status());
        assertEquals(BigDecimal.valueOf(300), refunded.refundedAmount());
    }

    @Test
    @DisplayName("Invoices: Generate invoice with line items, tax calculation, and mark paid")
    void testInvoicesModule() {
        InvoiceRepository invoiceRepo = mock(InvoiceRepository.class);
        InvoiceService invoiceService = new InvoiceService(invoiceRepo, auditService);

        UUID orgId = UUID.randomUUID();
        when(invoiceRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        InvoiceDTOs.InvoiceResponse invoice = invoiceService.generateInvoice(
                new InvoiceDTOs.CreateInvoiceRequest(
                        orgId,
                        "sub-1",
                        LocalDate.now(),
                        LocalDate.now().plusDays(14),
                        BigDecimal.valueOf(10), // 10% tax
                        "Net 14 payment terms",
                        List.of(
                                new InvoiceDTOs.LineItemDTO(null, "Starter Plan Seat License", 10, BigDecimal.valueOf(50), null),
                                new InvoiceDTOs.LineItemDTO(null, "Dedicated Onboarding Pack", 1, BigDecimal.valueOf(500), null)
                        )
                ),
                "superadmin@prowise.io"
        );

        assertNotNull(invoice);
        // Subtotal = (10 * 50) + (1 * 500) = 1000
        // Tax 10% = 100
        // Total = 1100
        assertEquals(BigDecimal.valueOf(1000), invoice.subtotal());
        assertEquals(new BigDecimal("100.00"), invoice.taxAmount());
        assertEquals(new BigDecimal("1100.00"), invoice.total());

        InvoiceEntity invEntity = new InvoiceEntity();
        invEntity.setId(invoice.id());
        invEntity.setInvoiceNumber(invoice.invoiceNumber());
        invEntity.setStatus("OPEN");
        invEntity.setOrgId(orgId);
        when(invoiceRepo.findById(invoice.id())).thenReturn(Optional.of(invEntity));

        InvoiceDTOs.InvoiceResponse paid = invoiceService.markInvoicePaid(invoice.id(), "pay-888", 0L, "superadmin@prowise.io");
        assertEquals("PAID", paid.status());
        assertEquals("pay-888", paid.paymentId());
    }

    @Test
    @DisplayName("Organizations: Create organization, duplicate slug rejection, and suspension")
    void testOrganizationsModule() {
        OrganizationRepository orgRepo = mock(OrganizationRepository.class);
        PlanRepository planRepo = mock(PlanRepository.class);
        SubscriptionRepository subRepo = mock(SubscriptionRepository.class);
        SuperAdminOrgService orgService = new SuperAdminOrgService(orgRepo, auditService, mock(org.springframework.jdbc.core.JdbcTemplate.class));

        when(orgRepo.existsBySlug("acme-corp")).thenReturn(true);
        when(orgRepo.existsBySlug("new-org")).thenReturn(false);
        when(orgRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Duplicate slug throws ApiException CONFLICT
        assertThrows(ApiException.class, () -> orgService.createOrganization(
                new SuperAdminOrgDTOs.CreateOrgRequest("Acme Corp", "acme-corp", "acme.com", "SaaS", "US", "UTC", "John", "john@acme.com", "plan-starter", 25, null),
                "superadmin@prowise.io"
        ));

        SuperAdminOrgDTOs.OrgDetailResponse created = orgService.createOrganization(
                new SuperAdminOrgDTOs.CreateOrgRequest("New Org", "new-org", "new.io", "AI", "US", "UTC", "Alice", "alice@new.io", "plan-pro", 50, null),
                "superadmin@prowise.io"
        );
        assertEquals("ACTIVE", created.status());

        OrganizationEntity entity = new OrganizationEntity(created.id(), "New Org", "new-org", "UTC");
        when(orgRepo.findById(created.id())).thenReturn(Optional.of(entity));

        SuperAdminOrgDTOs.OrgDetailResponse suspended = orgService.suspendOrganization(
                created.id(),
                new SuperAdminOrgDTOs.SuspendOrgRequest("Terms violation", 0L),
                "superadmin@prowise.io"
        );
        assertEquals("SUSPENDED", suspended.status());
        assertEquals("Terms violation", suspended.suspendedReason());
    }

    @Test
    @DisplayName("Roles: the organization baseline covers the 7 templates and keeps the owner's governance keys")
    void testRolesModule() {
        // Task 1.5: roles are persisted (V36), so listing, rank order, Super Admin protection and custom role
        // create/delete are asserted against the database in SuperAdminRoleGovernanceIntegrationTest.
        assertEquals(7, SystemRoleBaseline.ORGANIZATION_TEMPLATES.size());
        assertTrue(SystemRoleBaseline.ORGANIZATION_TEMPLATES.get(SystemRoleBaseline.OWNER_TEMPLATE_ID)
                .containsAll(SystemRoleBaseline.OWNER_REQUIRED_KEYS));
        for (java.util.Set<String> keys : SystemRoleBaseline.ORGANIZATION_TEMPLATES.values()) {
            assertFalse(keys.isEmpty());
            assertTrue(keys.stream().allMatch(com.prowise.authz.PermissionKey::isValid));
        }
        assertNotNull(SystemRoleBaseline.SUPER_ADMIN_DEFINITION_ID);
        assertThrows(UnsupportedOperationException.class,
                () -> SystemRoleBaseline.ORGANIZATION_TEMPLATES.get(SystemRoleBaseline.OWNER_TEMPLATE_ID).clear());
    }

    @Test
    @DisplayName("Email Templates: template variable extraction (live SMTP is covered by SmtpAdminIntegrationTest)")
    void testEmailModule() {
        EmailTemplateRepository tplRepo = mock(EmailTemplateRepository.class);
        EmailTemplateService tplService = new EmailTemplateService(tplRepo, auditService, objectMapper);

        when(tplRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        EmailTemplateDTOs.EmailTemplateResponse tpl = tplService.createTemplate(
                new EmailTemplateDTOs.CreateEmailTemplateRequest(
                        "auth.password_reset",
                        "AUTH-02",
                        "Password Reset",
                        "AUTH",
                        "Triggered on reset request",
                        "Security",
                        "rose",
                        "ProWise Security",
                        true,
                        "Expires in 15 mins",
                        "Reset your password",
                        "Password Reset Requested",
                        "Click the button below to reset.",
                        "Reset Password",
                        "https://app.prowise.io/reset",
                        List.of("user_name", "reset_url"),
                        "ACTIVE"
                ),
                "superadmin@prowise.io"
        );
        assertNotNull(tpl);
        assertEquals("auth.password_reset", tpl.key());
        assertEquals(2, tpl.variables().size());
    }

    @Test
    @DisplayName("Announcements: Create, publish, archive and delete announcement")
    void testAnnouncementsModule() {
        AnnouncementRepository annRepo = mock(AnnouncementRepository.class);
        AnnouncementService annService = new AnnouncementService(annRepo, auditService, objectMapper);

        when(annRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        AnnouncementDTOs.AnnouncementResponse ann = annService.createAnnouncement(
                new AnnouncementDTOs.CreateAnnouncementRequest(
                        "Scheduled Maintenance Window",
                        "Platform will undergo maintenance on Sunday 02:00 UTC",
                        "MAINTENANCE",
                        "ALL_ORGS",
                        List.of(),
                        List.of(),
                        List.of("IN_APP_BANNER", "EMAIL_BROADCAST"),
                        "DRAFT",
                        null,
                        null
                ),
                "superadmin@prowise.io"
        );
        assertNotNull(ann);
        assertEquals("DRAFT", ann.status());

        AnnouncementEntity entity = new AnnouncementEntity();
        entity.setId(ann.id());
        entity.setTitle(ann.title());
        entity.setStatus("DRAFT");
        when(annRepo.findById(ann.id())).thenReturn(Optional.of(entity));

        AnnouncementDTOs.AnnouncementResponse published = annService.publishAnnouncement(ann.id(), 0L, "superadmin@prowise.io");
        assertEquals("PUBLISHED", published.status());
        assertNotNull(published.publishedAt());
    }

    @Test
    @DisplayName("Feature Flags: Create and toggle feature flag")
    void testFeatureFlagsModule() {
        FeatureFlagRepository flagRepo = mock(FeatureFlagRepository.class);
        FeatureFlagService flagService = new FeatureFlagService(flagRepo, auditService);

        when(flagRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FeatureFlagDTOs.FeatureFlagResponse flag = flagService.createFeatureFlag(
                new FeatureFlagDTOs.CreateFeatureFlagRequest("quantum_crypto", "Quantum Resilient Vaults", "Post-quantum encryption algorithms", false, "Enterprise Only"),
                "superadmin@prowise.io"
        );
        assertNotNull(flag);
        assertFalse(flag.enabled());

        FeatureFlagEntity entity = new FeatureFlagEntity();
        entity.setId(flag.id());
        entity.setFlagKey(flag.flagKey());
        entity.setLabel(flag.label());
        entity.setEnabled(false);
        when(flagRepo.findById(flag.id())).thenReturn(Optional.of(entity));

        FeatureFlagDTOs.FeatureFlagResponse toggled = flagService.toggleFeatureFlag(flag.id(), true, 0L, "superadmin@prowise.io");
        assertTrue(toggled.enabled());
    }

    @Test
    @DisplayName("Licenses: Generate cryptographic key, validate, and revoke")
    void testLicensesModule() {
        LicenseRepository licenseRepo = mock(LicenseRepository.class);
        PlanRepository licensePlans = mock(PlanRepository.class);
        LicenseService licenseService = new LicenseService(licenseRepo, auditService, licensePlans);
        when(licensePlans.existsById("plan-enterprise")).thenReturn(true);

        when(licenseRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        UUID orgId = UUID.randomUUID();
        LicenseDTOs.LicenseResponse lic = licenseService.generateLicense(
                new LicenseDTOs.GenerateLicenseRequest(orgId, "plan-enterprise", 250, 365),
                "superadmin@prowise.io"
        );
        assertNotNull(lic);
        assertTrue(lic.licenseKey().startsWith("PW-"));
        assertEquals("ACTIVE", lic.status());

        LicenseEntity entity = new LicenseEntity();
        entity.setId(lic.id());
        entity.setLicenseKey(lic.licenseKey());
        entity.setStatus("ACTIVE");
        entity.setExpiresAt(Instant.now().plusSeconds(86400));
        when(licenseRepo.findByLicenseKey(lic.licenseKey())).thenReturn(Optional.of(entity));

        LicenseDTOs.ValidateLicenseResponse validRes = licenseService.validateLicense(lic.licenseKey());
        assertTrue(validRes.valid());

        when(licenseRepo.findById(lic.id())).thenReturn(Optional.of(entity));
        LicenseDTOs.LicenseResponse revoked = licenseService.revokeLicense(
                lic.id(),
                new LicenseDTOs.RevokeLicenseRequest("Customer contract ended", 0L),
                "superadmin@prowise.io"
        );
        assertEquals("REVOKED", revoked.status());
    }

    @Test
    @DisplayName("Platform Policies & Branding: Update global settings and preferences")
    void testPoliciesModule() {
        PlatformPolicyRepository policyRepo = mock(PlatformPolicyRepository.class);
        PlatformBrandingRepository brandingRepo = mock(PlatformBrandingRepository.class);
        FeatureFlagService flagService = mock(FeatureFlagService.class);
        PolicyService policyService = new PolicyService(policyRepo, brandingRepo, flagService, auditService);

        when(policyRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(brandingRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PolicyDTOs.PlatformPolicyResponse updatedPolicy = policyService.updatePolicySettings(
                new PolicyDTOs.UpdatePolicySettingsRequest(5, 45, 180, true, 21, 30, 100, false, 0L),
                "superadmin@prowise.io"
        );
        assertEquals(5, updatedPolicy.checkinGraceWorkingDays());
        assertEquals(180, updatedPolicy.auditRetentionDays());

        PolicyDTOs.PlatformBrandingResponse updatedBranding = policyService.updateBrandingPreferences(
                new PolicyDTOs.UpdateBrandingRequest("ProWise Enterprise Core", "support@prowise.io", "https://status.prowise.io", "America/New_York", "English (US)", "YYYY-MM-DD", "USD ($)", true, 0L),
                "superadmin@prowise.io"
        );
        assertEquals("ProWise Enterprise Core", updatedBranding.platformName());
        assertTrue(updatedBranding.compactDensity());
    }

    @Test
    @DisplayName("Dashboard: Telemetry aggregation and executive KPI calculation")
    void testDashboardModule() {
        OrganizationRepository orgRepo = mock(OrganizationRepository.class);
        SubscriptionRepository subRepo = mock(SubscriptionRepository.class);
        PlanRepository planRepo = mock(PlanRepository.class);
        PlatformOperatorRepository opRepo = mock(PlatformOperatorRepository.class);
        SuperAdminDashboardService dashboardService = new SuperAdminDashboardService(
                orgRepo, subRepo, planRepo, opRepo, auditService
        );

        OrganizationEntity org1 = new OrganizationEntity(UUID.randomUUID(), "Alpha", "alpha", "UTC");
        org1.setPlanId("plan-pro");
        org1.setState("ACTIVE");

        OrganizationEntity org2 = new OrganizationEntity(UUID.randomUUID(), "Beta", "beta", "UTC");
        org2.setPlanId("plan-enterprise");
        org2.setState("ACTIVE");

        when(orgRepo.findAll()).thenReturn(List.of(org1, org2));
        when(subRepo.findAll()).thenReturn(List.of());
        when(opRepo.countByStatus("ACTIVE")).thenReturn(8L);

        PlanEntity planPro = new PlanEntity();
        planPro.setId("plan-pro");
        planPro.setName("Professional");
        planPro.setMonthlyPrice(BigDecimal.valueOf(1299));

        PlanEntity planEnterprise = new PlanEntity();
        planEnterprise.setId("plan-enterprise");
        planEnterprise.setName("Enterprise");
        planEnterprise.setMonthlyPrice(BigDecimal.valueOf(4999));

        when(planRepo.findAll()).thenReturn(List.of(planPro, planEnterprise));

        SuperAdminDashboardDTOs.SuperAdminDashboardResponse dash = dashboardService.getDashboardData();
        assertNotNull(dash);
        assertEquals(2, dash.totalOrganizations());
        assertEquals(2, dash.activeOrganizations());
        assertEquals(8, dash.activeOperators());
        // Revenue comes only from ACTIVE subscriptions; plan prices alone never produce MRR (owner decision
        // 2026-11-24: no estimated or invented figures).
        assertEquals(0, BigDecimal.ZERO.compareTo(dash.totalMrr()));
        assertEquals(0, BigDecimal.ZERO.compareTo(dash.totalArr()));
        assertEquals(4, dash.kpiCards().size());
<<<<<<< HEAD
        // Only stored data: no invented month-over-month trends and no fabricated revenue history.
        assertTrue(dash.kpiCards().stream().allMatch(card -> card.change() == null && card.trend() == null));
        assertEquals(0, dash.revenueHistory().size());
=======
        // No revenue history is stored, so none is fabricated; no trend is invented for any card.
        assertTrue(dash.revenueHistory().isEmpty());
        dash.kpiCards().forEach(card -> {
            assertEquals(null, card.trend());
            assertEquals(null, card.change());
        });

        // Real subscriptions: monthly 1299 + annual 12000 (= 1000 / month) = 2299 MRR; cancelled ones do not count.
        SubscriptionEntity monthly = new SubscriptionEntity("sub-m", org1.getId(), "plan-pro");
        monthly.setStatus("ACTIVE");
        monthly.setBillingCycle("MONTHLY");
        monthly.setAmount(BigDecimal.valueOf(1299));
        monthly.setSeats(10);
        SubscriptionEntity annual = new SubscriptionEntity("sub-a", org2.getId(), "plan-enterprise");
        annual.setStatus("ACTIVE");
        annual.setBillingCycle("ANNUAL");
        annual.setAmount(BigDecimal.valueOf(12000));
        annual.setSeats(5);
        SubscriptionEntity cancelled = new SubscriptionEntity("sub-c", org2.getId(), "plan-pro");
        cancelled.setStatus("CANCELLED");
        cancelled.setBillingCycle("MONTHLY");
        cancelled.setAmount(BigDecimal.valueOf(999));
        cancelled.setSeats(50);
        when(subRepo.findAll()).thenReturn(List.of(monthly, annual, cancelled));

        SuperAdminDashboardDTOs.SuperAdminDashboardResponse real = dashboardService.getDashboardData();
        assertEquals(0, BigDecimal.valueOf(2299).compareTo(real.totalMrr()));
        assertEquals(0, BigDecimal.valueOf(27588).compareTo(real.totalArr()));
        assertEquals(15, real.totalSeatsAllocated());
        assertEquals(2, real.activeSubscriptions());
>>>>>>> 29db595 (Initial ProWise project upload)
    }
}
