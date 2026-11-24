package com.prowise.superadmin.licenses;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.superadmin.audit.AuditService;

@Service
@Transactional
public class LicenseService {

    private final LicenseRepository repository;
    private final AuditService auditService;
    private final com.prowise.superadmin.plans.PlanRepository planRepository;

    public LicenseService(LicenseRepository repository, AuditService auditService,
            com.prowise.superadmin.plans.PlanRepository planRepository) {
        this.planRepository = planRepository;
        this.repository = repository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<LicenseDTOs.LicenseResponse> listLicenses(UUID orgId, String status) {
        List<LicenseEntity> all = repository.findAll();
        if (orgId != null) {
            all = all.stream().filter(l -> orgId.equals(l.getOrgId())).toList();
        }
        if (status != null && !status.equalsIgnoreCase("ALL")) {
            all = all.stream().filter(l -> status.equalsIgnoreCase(l.getStatus())).toList();
        }
        return all.stream().map(LicenseDTOs.LicenseResponse::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public LicenseDTOs.LicenseResponse getLicense(String id) {
        LicenseEntity entity = repository.findById(id)
                .orElseThrow(ApiException::notFound);
        return LicenseDTOs.LicenseResponse.fromEntity(entity);
    }

    public LicenseDTOs.LicenseResponse generateLicense(LicenseDTOs.GenerateLicenseRequest req, String actorEmail) {
        String id = "lic-" + UUID.randomUUID().toString().substring(0, 8);
        String key = "PW-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase() + "-" +
                     UUID.randomUUID().toString().substring(0, 4).toUpperCase() + "-" +
                     UUID.randomUUID().toString().substring(0, 4).toUpperCase();

        int days = req.validityDays() != null && req.validityDays() > 0 ? req.validityDays() : 365;

        LicenseEntity entity = new LicenseEntity();
        entity.setId(id);
        entity.setLicenseKey(key);
        entity.setOrgId(req.orgId());
        // No invented default plan: null when none is given; an unknown plan is a validation error, not a 500.
        if (req.planId() != null && !planRepository.existsById(req.planId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, com.prowise.common.api.ErrorCodes.VALIDATION_FAILED, "Unknown plan.",
                    java.util.List.of(new com.prowise.common.api.ApiError.FieldError("plan_id", "does not exist")));
        }
        entity.setPlanId(req.planId());
        entity.setMaxSeats(req.maxSeats());
        entity.setStatus("ACTIVE");
        entity.setIssuedAt(Instant.now());
        entity.setExpiresAt(Instant.now().plusSeconds((long) days * 24 * 3600));
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());

        LicenseEntity saved = repository.save(entity);
        repository.flush();

        auditService.logActivity(
                "SECURITY",
                "GENERATE_LICENSE",
                "Generated enterprise license key: " + key + " (" + req.maxSeats() + " seats)",
                "Super Admin",
                actorEmail,
                key,
                "INFO"
        );

        return LicenseDTOs.LicenseResponse.fromEntity(saved);
    }

    public LicenseDTOs.ValidateLicenseResponse validateLicense(String key) {
        LicenseEntity entity = repository.findByLicenseKey(key.trim()).orElse(null);
        if (entity == null) {
            return new LicenseDTOs.ValidateLicenseResponse(false, "License key not recognized", null);
        }
        if ("REVOKED".equalsIgnoreCase(entity.getStatus())) {
            return new LicenseDTOs.ValidateLicenseResponse(false, "License key has been revoked: " + entity.getRevokedReason(), LicenseDTOs.LicenseResponse.fromEntity(entity));
        }
        if (entity.getExpiresAt() != null && entity.getExpiresAt().isBefore(Instant.now())) {
            return new LicenseDTOs.ValidateLicenseResponse(false, "License key expired on " + entity.getExpiresAt(), LicenseDTOs.LicenseResponse.fromEntity(entity));
        }
        return new LicenseDTOs.ValidateLicenseResponse(true, "License key is active and valid", LicenseDTOs.LicenseResponse.fromEntity(entity));
    }

    public LicenseDTOs.LicenseResponse revokeLicense(String id, LicenseDTOs.RevokeLicenseRequest req, String actorEmail) {
        LicenseEntity entity = repository.findById(id)
                .orElseThrow(ApiException::notFound);
        ExpectedVersion.checkRequired(entity.getVersion(), req.expectedVersion());

        entity.setStatus("REVOKED");
        entity.setRevokedAt(Instant.now());
        entity.setRevokedReason(req.reason());
        entity.setUpdatedAt(Instant.now());

        LicenseEntity updated = repository.save(entity);
        repository.flush();

        auditService.logActivity(
                "SECURITY",
                "REVOKE_LICENSE",
                "Revoked license key " + updated.getLicenseKey() + ": " + req.reason(),
                "Super Admin",
                actorEmail,
                updated.getLicenseKey(),
                "WARNING"
        );

        return LicenseDTOs.LicenseResponse.fromEntity(updated);
    }
}
