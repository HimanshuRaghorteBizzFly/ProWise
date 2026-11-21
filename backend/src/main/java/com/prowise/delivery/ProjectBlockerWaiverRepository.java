package com.prowise.delivery;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectBlockerWaiverRepository extends JpaRepository<ProjectBlockerWaiverEntity, String> {
    Optional<ProjectBlockerWaiverEntity> findByIdAndOrgId(String id, UUID orgId);
    List<ProjectBlockerWaiverEntity> findByOrgIdAndProjectIdOrderByWaivedAtDesc(UUID orgId, String projectId);
    Optional<ProjectBlockerWaiverEntity> findByOrgIdAndProjectIdAndBlockerRef(UUID orgId, String projectId, String blockerRef);
}
