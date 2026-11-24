package com.prowise.superadmin.organizations;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.superadmin.audit.AuditService;

/**
 * Tenant organization lifecycle for the Super Admin. Every change is version-checked (rule 5) and writes its
 * admin audit row in the same transaction (rule 4). Usage figures come from real rows (memberships, projects,
 * active subscriptions); nothing is invented when there is no data.
 */
@Service
@Transactional
public class SuperAdminOrgService {

    private final OrganizationRepository orgRepository;
    private final AuditService auditService;
    private final JdbcTemplate jdbc;

    public SuperAdminOrgService(
            OrganizationRepository orgRepository,
            AuditService auditService,
            JdbcTemplate jdbc
    ) {
        this.orgRepository = orgRepository;
        this.auditService = auditService;
        this.jdbc = jdbc;
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
        return buildOrgResponse(find(id));
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
        entity.setDomain(req.domain() != null && !req.domain().isBlank() ? req.domain().trim() : null);
        entity.setIndustry(req.industry() != null && !req.industry().isBlank() ? req.industry().trim() : null);
        entity.setCountry(req.country() != null && !req.country().isBlank() ? req.country().trim() : null);
        entity.setTimezone(req.timezone() != null ? req.timezone().trim() : "UTC");
        entity.setOwnerName(req.ownerName().trim());
        entity.setOwnerEmail(req.ownerEmail().trim().toLowerCase(java.util.Locale.ROOT));
        entity.setState("ACTIVE");
        entity.setPlanId(req.planId()); // null = no plan (no invented default; billing is dormant)
        entity.setSeatsLimit(req.seatsLimit() != null ? req.seatsLimit() : 25);
        entity.setNotes(req.notes());
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());

        OrganizationEntity saved = orgRepository.save(entity);
        orgRepository.flush();

        audit("CREATE_ORGANIZATION", "Created new tenant organization: " + saved.getName() + " (" + saved.getSlug() + ")",
                actorEmail, saved.getName(), "INFO");
        return buildOrgResponse(saved);
    }

    public SuperAdminOrgDTOs.OrgDetailResponse updateOrganization(UUID id, SuperAdminOrgDTOs.UpdateOrgRequest req, String actorEmail) {
        OrganizationEntity org = find(id);
        ExpectedVersion.checkRequired(org.getVersion(), req.expectedVersion());

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

        OrganizationEntity updated = save(org);
        audit("UPDATE_ORGANIZATION", "Updated details for organization: " + updated.getName(), actorEmail, updated.getName(), "INFO");
        return buildOrgResponse(updated);
    }

    public SuperAdminOrgDTOs.OrgDetailResponse suspendOrganization(UUID id, SuperAdminOrgDTOs.SuspendOrgRequest req, String actorEmail) {
        OrganizationEntity org = find(id);
        ExpectedVersion.checkRequired(org.getVersion(), req.expectedVersion());

        org.setState("SUSPENDED");
        org.setSuspendedReason(req.reason());
        OrganizationEntity updated = save(org);

        audit("SUSPEND_ORGANIZATION", "Suspended organization: " + updated.getName() + " (Reason: " + req.reason() + ")",
                actorEmail, updated.getName(), "WARNING");
        return buildOrgResponse(updated);
    }

    public SuperAdminOrgDTOs.OrgDetailResponse reactivateOrganization(UUID id, Long expectedVersion, String actorEmail) {
        OrganizationEntity org = find(id);
        ExpectedVersion.checkRequired(org.getVersion(), expectedVersion);

        org.setState("ACTIVE");
        org.setSuspendedReason(null);
        OrganizationEntity updated = save(org);

        audit("REACTIVATE_ORGANIZATION", "Reactivated tenant organization: " + updated.getName(), actorEmail, updated.getName(), "INFO");
        return buildOrgResponse(updated);
    }

    public void deleteOrganization(UUID id, Long expectedVersion, String actorEmail) {
        OrganizationEntity org = find(id);
        ExpectedVersion.checkRequired(org.getVersion(), expectedVersion);

        orgRepository.delete(org);
        orgRepository.flush();

        audit("DELETE_ORGANIZATION", "Deleted organization " + org.getName() + " (" + org.getId() + ")", actorEmail, org.getName(), "CRITICAL");
    }

    /**
     * All-or-nothing: every item must exist and carry its current version, otherwise nothing is suspended
     * (404 for an unknown id, 409 STALE_VERSION for an outdated one).
     */
    public void bulkSuspend(SuperAdminOrgDTOs.BulkSuspendRequest req, String actorEmail) {
        for (SuperAdminOrgDTOs.BulkSuspendItem item : req.items()) {
            OrganizationEntity org = find(item.id());
            ExpectedVersion.checkRequired(org.getVersion(), item.expectedVersion());
            org.setState("SUSPENDED");
            org.setSuspendedReason(req.reason());
            org.setUpdatedAt(Instant.now());
            orgRepository.save(org);
        }
        orgRepository.flush();

        audit("BULK_SUSPEND", "Bulk suspended " + req.items().size() + " organizations. Reason: " + req.reason(),
                actorEmail, req.items().size() + " tenants", "WARNING");
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
            totalMrr = totalMrr.add(mrrFor(o.getId()));
        }

        return new SuperAdminOrgDTOs.OrgSummaryResponse(total, active, trial, suspended, totalMrr);
    }

    private OrganizationEntity find(UUID id) {
        return orgRepository.findById(id).orElseThrow(ApiException::notFound);
    }

    private OrganizationEntity save(OrganizationEntity org) {
        org.setUpdatedAt(Instant.now());
        OrganizationEntity saved = orgRepository.save(org);
        orgRepository.flush();
        return saved;
    }

    private void audit(String action, String summary, String actorEmail, String target, String severity) {
        auditService.logActivity("ORGANIZATION", action, summary, "Super Admin", actorEmail, target, severity);
    }

    private SuperAdminOrgDTOs.OrgDetailResponse buildOrgResponse(OrganizationEntity org) {
        int seatsUsed = count("SELECT count(*) FROM memberships WHERE org_id = ? AND status = 'ACTIVE'", org.getId());
        int projectsCount = count("SELECT count(*) FROM projects WHERE org_id = ?", org.getId());
        // No storage accounting exists yet: 0 (not an estimate).
        return SuperAdminOrgDTOs.OrgDetailResponse.fromEntity(org, seatsUsed, projectsCount, 0.0, mrrFor(org.getId()));
    }

    private int count(String sql, UUID orgId) {
        if (orgId == null) {
            return 0;
        }
        Integer value = jdbc.queryForObject(sql, Integer.class, orgId);
        return value == null ? 0 : value;
    }

    /** Monthly recurring revenue from the organization's ACTIVE subscriptions (annual amounts / 12); 0 when none. */
    private BigDecimal mrrFor(UUID orgId) {
        if (orgId == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal value = jdbc.queryForObject("""
                SELECT COALESCE(SUM(CASE WHEN billing_cycle = 'ANNUAL' THEN amount / 12 ELSE amount END), 0)
                FROM subscriptions WHERE org_id = ? AND status = 'ACTIVE'
                """, BigDecimal.class, orgId);
        return value == null ? BigDecimal.ZERO : value.setScale(2, RoundingMode.HALF_UP);
    }
}
