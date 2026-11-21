package com.prowise.delivery;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AcceptanceRequestRepository extends JpaRepository<AcceptanceRequestEntity, String> {
    Optional<AcceptanceRequestEntity> findByIdAndOrgId(String id, UUID orgId);
    List<AcceptanceRequestEntity> findByOrgIdAndProjectIdOrderByCreatedAtDesc(UUID orgId, String projectId);
    Optional<AcceptanceRequestEntity> findFirstByOrgIdAndProjectIdAndStatusOrderByCreatedAtDesc(UUID orgId, String projectId, String status);
}
