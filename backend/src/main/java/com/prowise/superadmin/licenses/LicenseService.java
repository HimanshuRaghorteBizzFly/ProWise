package com.prowise.superadmin.licenses;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
import com.prowise.superadmin.audit.AuditService;

@Service
@Transactional
public class LicenseService {

    private final LicenseRepository repository;
    private final AuditService auditService;

    public LicenseService(LicenseRepository repository, AuditService auditService) {
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
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "LICENSE_NOT_FOUND", "License not found: " + id));
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
        entity.setPlanId(req.planId() != null ? req.planId() : "plan-enterprise");
        entity.setMaxSeats(req.maxSeats());
        entity.setStatus("ACTIVE");
        entity.setIssuedAt(Instant.now());
        entity.setExpiresAt(Instant.now().plusSeconds((long) days * 24 * 3600));
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());

        LicenseEntity saved = repository.save(entity);

        auditService.logActivity(
                "SECURITY",
                "GENERATE_LICENSE",
                "Generated enterprise license key: " + key + " (" + req.maxSeats() + " seats)",
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
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
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "LICENSE_NOT_FOUND", "License not found: " + id));

        entity.setStatus("REVOKED");
        entity.setRevokedAt(Instant.now());
        entity.setRevokedReason(req.reason());
        entity.setUpdatedAt(Instant.now());

        LicenseEntity updated = repository.save(entity);

        auditService.logActivity(
                "SECURITY",
                "REVOKE_LICENSE",
                "Revoked license key " + updated.getLicenseKey() + ": " + req.reason(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                updated.getLicenseKey(),
                "WARNING"
        );

        return LicenseDTOs.LicenseResponse.fromEntity(updated);
    }
}
