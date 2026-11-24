package com.prowise.superadmin.organizations;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
import com.prowise.superadmin.audit.AuditService;
import com.prowise.superadmin.plans.PlanEntity;
import com.prowise.superadmin.plans.PlanRepository;
import com.prowise.superadmin.subscriptions.SubscriptionEntity;
import com.prowise.superadmin.subscriptions.SubscriptionRepository;

@Service
@Transactional
public class SuperAdminOrgService {

    private final OrganizationRepository orgRepository;
    private final PlanRepository planRepository;
    private final SubscriptionRepository subscriptionRepository;
    private final AuditService auditService;

    public SuperAdminOrgService(
            OrganizationRepository orgRepository,
            PlanRepository planRepository,
            SubscriptionRepository subscriptionRepository,
            AuditService auditService
    ) {
        this.orgRepository = orgRepository;
        this.planRepository = planRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<SuperAdminOrgDTOs.OrgDetailResponse> listOrganizations(String status, String planId, String search) {
        String safeStatus = (status != null && !status.equalsIgnoreCase("ALL")) ? status.toUpperCase() : null;
        String safePlan = (planId != null && !planId.equalsIgnoreCase("ALL")) ? planId : null;

        List<OrganizationEntity> list = orgRepository.findFiltered(safeStatus, safePlan);
        if (search != null && !search.trim().isEmpty()) {
            String lower = search.trim().toLowerCase();
            list = list.stream().filter(o ->
                    o.getName().toLowerCase().contains(lower) ||
                    o.getSlug().toLowerCase().contains(lower) ||
                    (o.getOwnerEmail() != null && o.getOwnerEmail().toLowerCase().contains(lower)) ||
                    (o.getIndustry() != null && o.getIndustry().toLowerCase().contains(lower))
            ).toList();
        }

        return list.stream().map(this::buildOrgResponse).toList();
    }

    @Transactional(readOnly = true)
    public SuperAdminOrgDTOs.OrgDetailResponse getOrganization(UUID id) {
        OrganizationEntity org = orgRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ORG_NOT_FOUND", "Organization not found: " + id));
        return buildOrgResponse(org);
    }

    public SuperAdminOrgDTOs.OrgDetailResponse createOrganization(SuperAdminOrgDTOs.CreateOrgRequest req, String actorEmail) {
        String cleanSlug = req.slug().trim().toLowerCase(java.util.Locale.ROOT);
        if (orgRepository.existsBySlug(cleanSlug)) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_SLUG", "An organization with slug '" + cleanSlug + "' already exists.");
        }

        UUID orgId = UUID.randomUUID();
        OrganizationEntity entity = new OrganizationEntity();
        entity.setId(orgId);
        entity.setName(req.name().trim());
        entity.setSlug(cleanSlug);
        entity.setDomain(req.domain() != null ? req.domain().trim() : (cleanSlug + ".prowise.io"));
        entity.setIndustry(req.industry() != null ? req.industry().trim() : "Enterprise Software");
        entity.setCountry(req.country() != null ? req.country().trim() : "United States");
        entity.setTimezone(req.timezone() != null ? req.timezone().trim() : "UTC");
        entity.setOwnerName(req.ownerName().trim());
        entity.setOwnerEmail(req.ownerEmail().trim().toLowerCase(java.util.Locale.ROOT));
        entity.setState("ACTIVE");
        entity.setPlanId(req.planId() != null ? req.planId() : "plan-starter");
        entity.setSeatsLimit(req.seatsLimit() != null ? req.seatsLimit() : 25);
        entity.setNotes(req.notes());
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());

        OrganizationEntity saved = orgRepository.save(entity);

        auditService.logActivity(
                "ORGANIZATION",
                "CREATE_ORGANIZATION",
                "Created new tenant organization: " + saved.getName() + " (" + saved.getSlug() + ")",
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                saved.getName(),
                "INFO"
        );

        return buildOrgResponse(saved);
    }

    public SuperAdminOrgDTOs.OrgDetailResponse updateOrganization(UUID id, SuperAdminOrgDTOs.UpdateOrgRequest req, String actorEmail) {
        OrganizationEntity org = orgRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ORG_NOT_FOUND", "Organization not found: " + id));

        if (req.name() != null) org.setName(req.name().trim());
        if (req.domain() != null) org.setDomain(req.domain().trim());
        if (req.industry() != null) org.setIndustry(req.industry().trim());
        if (req.country() != null) org.setCountry(req.country().trim());
        if (req.timezone() != null) org.setTimezone(req.timezone().trim());
        if (req.ownerName() != null) org.setOwnerName(req.ownerName().trim());
        if (req.ownerEmail() != null) org.setOwnerEmail(req.ownerEmail().trim().toLowerCase(java.util.Locale.ROOT));
        if (req.planId() != null) org.setPlanId(req.planId());
        if (req.seatsLimit() != null) org.setSeatsLimit(req.seatsLimit());
        if (req.notes() != null) org.setNotes(req.notes());
        org.setUpdatedAt(Instant.now());

        OrganizationEntity updated = orgRepository.save(org);

        auditService.logActivity(
                "ORGANIZATION",
                "UPDATE_ORGANIZATION",
                "Updated details for organization: " + updated.getName(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                updated.getName(),
                "INFO"
        );

        return buildOrgResponse(updated);
    }

    public SuperAdminOrgDTOs.OrgDetailResponse suspendOrganization(UUID id, SuperAdminOrgDTOs.SuspendOrgRequest req, String actorEmail) {
        OrganizationEntity org = orgRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ORG_NOT_FOUND", "Organization not found: " + id));

        org.setState("SUSPENDED");
        org.setSuspendedReason(req.reason());
        org.setUpdatedAt(Instant.now());
        OrganizationEntity updated = orgRepository.save(org);

        auditService.logActivity(
                "ORGANIZATION",
                "SUSPEND_ORGANIZATION",
                "Suspended organization: " + updated.getName() + " (Reason: " + req.reason() + ")",
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                updated.getName(),
                "WARNING"
        );

        return buildOrgResponse(updated);
    }

    public SuperAdminOrgDTOs.OrgDetailResponse reactivateOrganization(UUID id, String actorEmail) {
        OrganizationEntity org = orgRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ORG_NOT_FOUND", "Organization not found: " + id));

        org.setState("ACTIVE");
        org.setSuspendedReason(null);
        org.setUpdatedAt(Instant.now());
        OrganizationEntity updated = orgRepository.save(org);

        auditService.logActivity(
                "ORGANIZATION",
                "REACTIVATE_ORGANIZATION",
                "Reactivated tenant organization: " + updated.getName(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                updated.getName(),
                "INFO"
        );

        return buildOrgResponse(updated);
    }

    public void deleteOrganization(UUID id, String actorEmail) {
        OrganizationEntity org = orgRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ORG_NOT_FOUND", "Organization not found: " + id));

        orgRepository.delete(org);

        auditService.logActivity(
                "ORGANIZATION",
                "DELETE_ORGANIZATION",
                "Deleted organization " + org.getName() + " (" + org.getId() + ")",
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                org.getName(),
                "CRITICAL"
        );
    }

    public void bulkSuspend(SuperAdminOrgDTOs.BulkSuspendRequest req, String actorEmail) {
        List<OrganizationEntity> orgs = orgRepository.findAllById(req.orgIds());
        for (OrganizationEntity org : orgs) {
            org.setState("SUSPENDED");
            org.setSuspendedReason(req.reason());
            org.setUpdatedAt(Instant.now());
        }
        orgRepository.saveAll(orgs);

        auditService.logActivity(
                "ORGANIZATION",
                "BULK_SUSPEND",
                "Bulk suspended " + orgs.size() + " organizations. Reason: " + req.reason(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                orgs.size() + " tenants",
                "WARNING"
        );
    }

    @Transactional(readOnly = true)
    public SuperAdminOrgDTOs.OrgSummaryResponse getSummary() {
        List<OrganizationEntity> all = orgRepository.findAll();
        long total = all.size();
        long active = 0;
        long trial = 0;
        long suspended = 0;
        BigDecimal totalMrr = BigDecimal.ZERO;

        for (OrganizationEntity o : all) {
            if ("SUSPENDED".equalsIgnoreCase(o.getState())) {
                suspended++;
            } else if ("TRIAL".equalsIgnoreCase(o.getState())) {
                trial++;
            } else {
                active++;
            }

            BigDecimal mrr = getMrrForOrg(o);
            totalMrr = totalMrr.add(mrr);
        }

        return new SuperAdminOrgDTOs.OrgSummaryResponse(total, active, trial, suspended, totalMrr);
    }

    private org.springframework.jdbc.core.JdbcTemplate jdbc;

    /** Optional so the plain constructor stays usable in unit tests; Spring always provides it at runtime. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setJdbcTemplate(org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Stored values only: real member and project counts, the real Owner; nothing assumed or invented. */
    private SuperAdminOrgDTOs.OrgDetailResponse buildOrgResponse(OrganizationEntity org) {
        BigDecimal mrr = getMrrForOrg(org);
        int seatsUsed = count("SELECT count(*) FROM memberships WHERE org_id = ? AND status = 'ACTIVE'", org.getId());
        int projectsCount = count("SELECT count(*) FROM projects WHERE org_id = ?", org.getId());
        double storageUsedGb = 0; // not measured yet
        SuperAdminOrgDTOs.OrgDetailResponse base =
                SuperAdminOrgDTOs.OrgDetailResponse.fromEntity(org, seatsUsed, projectsCount, storageUsedGb, mrr);
        String[] owner = owner(org.getId());
        if (owner == null) return base;
        return new SuperAdminOrgDTOs.OrgDetailResponse(base.id(), base.name(), base.slug(), base.domain(), base.industry(),
                base.country(), base.timezone(), owner[0], owner[1], base.status(), base.planId(), base.seatsUsed(),
                base.seatsLimit(), base.projectsCount(), base.storageUsedGb(), base.mrr(), base.createdAt(),
                base.lastActivityAt(), base.suspendedReason(), base.notes());
    }

    private int count(String sql, java.util.UUID orgId) {
        if (jdbc == null || orgId == null) return 0;
        Integer value = jdbc.queryForObject(sql, Integer.class, orgId);
        return value == null ? 0 : value;
    }

    /** {name, email} of the active Organization Owner membership, or null. */
    private String[] owner(java.util.UUID orgId) {
        if (jdbc == null || orgId == null) return null;
        return jdbc.query("""
                SELECT u.name, u.email FROM memberships m JOIN users u ON u.id = m.user_id
                WHERE m.org_id = ? AND m.status = 'ACTIVE' AND m.role_template = 'ORGANIZATION_OWNER'
                ORDER BY m.created_at LIMIT 1
                """, (rs, n) -> new String[] {rs.getString("name"), rs.getString("email")}, orgId)
                .stream().findFirst().orElse(null);
    }

    private BigDecimal getMrrForOrg(OrganizationEntity org) {
        if (org.getPlanId() != null) {
            PlanEntity plan = planRepository.findById(org.getPlanId()).orElse(null);
            if (plan != null && plan.getMonthlyPrice() != null) {
                return plan.getMonthlyPrice();
            }
        }
        return BigDecimal.ZERO; // no plan stored: no revenue assumed
    }
}
