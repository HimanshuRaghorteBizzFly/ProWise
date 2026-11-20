package com.prowise.superadmin.plans;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;

@Service
@Transactional
public class PlanService {

    private final PlanRepository planRepository;
    private final PlanFeatureRepository featureRepository;

    public PlanService(PlanRepository planRepository, PlanFeatureRepository featureRepository) {
        this.planRepository = planRepository;
        this.featureRepository = featureRepository;
    }

    @Transactional(readOnly = true)
    public List<PlanDTOs.PlanResponse> listPlans() {
        return planRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public PlanDTOs.PlanResponse getPlan(String id) {
        PlanEntity plan = planRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Plan not found: " + id));
        return toResponse(plan);
    }

    public PlanDTOs.PlanResponse createPlan(PlanDTOs.CreatePlanRequest request) {
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
            plan.setMaxSeats(request.limits().maxSeats());
            plan.setMaxProjects(request.limits().maxProjects());
            plan.setMaxWorkspaces(request.limits().maxWorkspaces());
            plan.setStorageGb(request.limits().storageGb());
            plan.setApiRateLimitPerMin(request.limits().apiRateLimitPerMin());
        }

        PlanEntity saved = planRepository.save(plan);

        if (request.features() != null && !request.features().isEmpty()) {
            List<PlanFeatureEntity> features = new ArrayList<>();
            int order = 1;
            for (String feat : request.features()) {
                features.add(new PlanFeatureEntity(saved, feat, order++));
            }
            featureRepository.saveAll(features);
            saved.setFeatures(features);
        }

        return toResponse(saved);
    }

    public PlanDTOs.PlanResponse updatePlan(String id, PlanDTOs.UpdatePlanRequest request) {
        PlanEntity plan = planRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Plan not found: " + id));

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
            plan.setMaxSeats(request.limits().maxSeats());
            plan.setMaxProjects(request.limits().maxProjects());
            plan.setMaxWorkspaces(request.limits().maxWorkspaces());
            plan.setStorageGb(request.limits().storageGb());
            plan.setApiRateLimitPerMin(request.limits().apiRateLimitPerMin());
        }

        if (request.features() != null) {
            featureRepository.deleteByPlanId(id);
            List<PlanFeatureEntity> features = new ArrayList<>();
            int order = 1;
            for (String feat : request.features()) {
                features.add(new PlanFeatureEntity(plan, feat, order++));
            }
            featureRepository.saveAll(features);
            plan.setFeatures(features);
        }

        plan.setUpdatedAt(Instant.now());
        PlanEntity updated = planRepository.save(plan);
        return toResponse(updated);
    }

    public PlanDTOs.PlanResponse togglePlanArchive(String id) {
        PlanEntity plan = planRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Plan not found: " + id));
        String newStatus = "ACTIVE".equalsIgnoreCase(plan.getStatus()) ? "ARCHIVED" : "ACTIVE";
        plan.setStatus(newStatus);
        plan.setUpdatedAt(Instant.now());
        return toResponse(planRepository.save(plan));
    }

    public void deletePlan(String id) {
        PlanEntity plan = planRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "Plan not found: " + id));
        planRepository.delete(plan);
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
                p.getUpdatedAt()
        );
    }
}
