package com.prowise.superadmin.licenses;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LicenseRepository extends JpaRepository<LicenseEntity, String> {
    Optional<LicenseEntity> findByLicenseKey(String licenseKey);
    List<LicenseEntity> findByOrgIdOrderByCreatedAtDesc(UUID orgId);
    List<LicenseEntity> findByStatusOrderByCreatedAtDesc(String status);
}
