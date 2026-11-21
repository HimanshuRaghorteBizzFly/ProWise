package com.prowise.delivery;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AcceptanceDecisionRepository extends JpaRepository<AcceptanceDecisionEntity, String> {
    List<AcceptanceDecisionEntity> findByOrgIdAndRequestIdOrderByDecidedAtDesc(UUID orgId, String requestId);
    List<AcceptanceDecisionEntity> findByOrgIdAndProjectIdOrderByDecidedAtDesc(UUID orgId, String projectId);
}
