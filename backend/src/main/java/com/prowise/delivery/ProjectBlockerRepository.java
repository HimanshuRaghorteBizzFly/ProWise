package com.prowise.delivery;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectBlockerRepository extends JpaRepository<ProjectBlockerEntity, String> {
    Optional<ProjectBlockerEntity> findByIdAndOrgId(String id, UUID orgId);
    List<ProjectBlockerEntity> findByOrgIdAndProjectIdOrderByCreatedAtDesc(UUID orgId, String projectId);
    List<ProjectBlockerEntity> findByOrgIdAndProjectIdAndStatus(UUID orgId, String projectId, String status);
    List<ProjectBlockerEntity> findByOrgIdAndProjectIdAndStatusAndSeverity(UUID orgId, String projectId, String status, String severity);
}
