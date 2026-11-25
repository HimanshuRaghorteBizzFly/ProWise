package com.prowise.superadmin.plans;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.superadmin.audit.AuditService;

/** Plan catalogue. Every change writes its admin audit row in the same transaction (rule 4). */
@Service
@Transactional
public class PlanService {

    private final PlanRepository planRepository;
    private final AuditService auditService;

    public PlanService(PlanRepository planRepository, AuditService auditService) {
        this.planRepository = planRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<PlanDTOs.PlanResponse> listPlans() {
        return planRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PlanDTOs.PlanResponse getPlan(String id) {
        return toResponse(find(id));
    }

    public PlanDTOs.PlanResponse createPlan(PlanDTOs.CreatePlanRequest request, String actorEmail) {
        if (request.name() == null || request.name().trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "Plan name is required");
        }
        String planId = request.id() != null && !request.id().trim().isEmpty()
                ? request.id().trim()
                : "plan-" + UUID.randomUUID().toString().substring(0, 8);
        String code = request.code() != null && !request.code().trim().isEmpty()
                ? request.code().trim().toUpperCase()
                : request.name().trim().replaceAll("[^A-Za-z0-9]", "_").toUpperCase();

        if (planRepository.findByCode(code).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, ErrorCodes.VALIDATION_FAILED, "Plan code already exists: " + code);
        }

        PlanEntity plan = new PlanEntity(planId, code, request.name().trim());
        plan.setTagline(request.tagline());
        plan.setMonthlyPrice(request.monthlyPrice() != null ? request.monthlyPrice() : BigDecimal.ZERO);
        plan.setAnnualPrice(request.annualPrice() != null ? request.annualPrice() : BigDecimal.ZERO);
        plan.setCurrency(request.currency() != null ? request.currency() : "USD");
        plan.setStatus(request.status() != null ? request.status() : "ACTIVE");
        plan.setPopular(request.isPopular() != null && request.isPopular());
        plan.setBadgeLabel(request.badgeLabel());
        plan.setBrandColor(request.brandColor() != null ? request.brandColor() : "blue");
        plan.setAiTokenQuota(request.aiTokenQuota());
        plan.setTrialDays(request.trialDays() != null ? request.trialDays() : 14);

        if (request.limits() != null) {
            applyLimits(plan, request.limits());
        }
        if (request.features() != null) {
            replaceFeatures(plan, request.features());
        }

        // Features are persisted through the plan's cascade; saving them separately would merge copies of the
        // same ids into the session and fail with NonUniqueObjectException.
        PlanEntity saved = planRepository.save(plan);
        planRepository.flush();

        audit("CREATE_PLAN", "Created plan " + saved.getName() + " (" + saved.getCode() + ")", actorEmail, saved, "INFO");
        return toResponse(saved);
    }

    public PlanDTOs.PlanResponse updatePlan(String id, PlanDTOs.UpdatePlanRequest request, String actorEmail) {
        PlanEntity plan = find(id);
        ExpectedVersion.checkRequired(plan.getVersion(), request.expectedVersion());

        if (request.name() != null && !request.name().trim().isEmpty()) plan.setName(request.name().trim());
        if (request.tagline() != null) plan.setTagline(request.tagline());
        if (request.monthlyPrice() != null) plan.setMonthlyPrice(request.monthlyPrice());
        if (request.annualPrice() != null) plan.setAnnualPrice(request.annualPrice());
        if (request.status() != null) plan.setStatus(request.status());
        if (request.isPopular() != null) plan.setPopular(request.isPopular());
        if (request.badgeLabel() != null) plan.setBadgeLabel(request.badgeLabel());
        if (request.brandColor() != null) plan.setBrandColor(request.brandColor());
        if (request.aiTokenQuota() != null) plan.setAiTokenQuota(request.aiTokenQuota());
        if (request.trialDays() != null) plan.setTrialDays(request.trialDays());

        if (request.limits() != null) {
            applyLimits(plan, request.limits());
        }

        if (request.features() != null) {
            // orphanRemoval deletes the old rows; cascade inserts the new ones.
            replaceFeatures(plan, request.features());
        }

        // updated_at always changes, so the plan row (and its @Version) is written even for feature-only edits.
        plan.setUpdatedAt(Instant.now());
        PlanEntity updated = planRepository.save(plan);
        planRepository.flush();

        audit("UPDATE_PLAN", "Updated plan " + updated.getName(), actorEmail, updated, "INFO");
        return toResponse(updated);
    }

    public PlanDTOs.PlanResponse togglePlanArchive(String id, Long expectedVersion, String actorEmail) {
        PlanEntity plan = find(id);
        ExpectedVersion.checkRequired(plan.getVersion(), expectedVersion);
        String newStatus = "ACTIVE".equalsIgnoreCase(plan.getStatus()) ? "ARCHIVED" : "ACTIVE";
        plan.setStatus(newStatus);
        plan.setUpdatedAt(Instant.now());
        PlanEntity saved = planRepository.save(plan);
        planRepository.flush();

        audit("ARCHIVED".equals(newStatus) ? "ARCHIVE_PLAN" : "RESTORE_PLAN",
                ("ARCHIVED".equals(newStatus) ? "Archived plan " : "Restored plan ") + saved.getName(),
                actorEmail, saved, "WARNING");
        return toResponse(saved);
    }

    public void deletePlan(String id, Long expectedVersion, String actorEmail) {
        PlanEntity plan = find(id);
        ExpectedVersion.checkRequired(plan.getVersion(), expectedVersion);
        planRepository.delete(plan);
        planRepository.flush();
        audit("DELETE_PLAN", "Deleted plan " + plan.getName() + " (" + plan.getCode() + ")", actorEmail, plan, "CRITICAL");
    }

    private PlanEntity find(String id) {
        return planRepository.findById(id).orElseThrow(ApiException::notFound);
    }

    /** Replaces the plan's features in place, keeping the managed collection Hibernate tracks. */
    private static void replaceFeatures(PlanEntity plan, List<String> texts) {
        plan.getFeatures().clear();
        int order = 1;
        for (String text : texts) {
            if (text == null || text.isBlank()) continue;
            plan.getFeatures().add(new PlanFeatureEntity(plan, text.trim(), order++));
        }
    }

    private static void applyLimits(PlanEntity plan, PlanDTOs.PlanLimitsDTO limits) {
        plan.setMaxSeats(limits.maxSeats());
        plan.setMaxProjects(limits.maxProjects());
        plan.setMaxWorkspaces(limits.maxWorkspaces());
        plan.setStorageGb(limits.storageGb());
        plan.setApiRateLimitPerMin(limits.apiRateLimitPerMin());
    }

    private void audit(String action, String summary, String actorEmail, PlanEntity plan, String severity) {
        auditService.logActivity("BILLING", action, summary, "Super Admin", actorEmail, plan.getName(), severity);
    }

    private PlanDTOs.PlanResponse toResponse(PlanEntity p) {
        List<String> featureTexts = p.getFeatures() != null
                ? p.getFeatures().stream().map(PlanFeatureEntity::getFeatureText).toList()
                : List.of();

        PlanDTOs.PlanLimitsDTO limits = new PlanDTOs.PlanLimitsDTO(
                p.getMaxSeats(),
                p.getMaxProjects(),
                p.getMaxWorkspaces(),
                p.getStorageGb(),
                p.getApiRateLimitPerMin()
        );

        return new PlanDTOs.PlanResponse(
                p.getId(),
                p.getCode(),
                p.getName(),
                p.getTagline(),
                p.getMonthlyPrice(),
                p.getAnnualPrice(),
                p.getCurrency(),
                p.getStatus(),
                p.isPopular(),
                p.getBadgeLabel(),
                p.getBrandColor(),
                p.getAiTokenQuota(),
                p.getTrialDays(),
                limits,
                featureTexts,
                p.getCreatedAt(),
                p.getUpdatedAt(),
                p.getVersion() == null ? 0L : p.getVersion()
        );
    }
}
