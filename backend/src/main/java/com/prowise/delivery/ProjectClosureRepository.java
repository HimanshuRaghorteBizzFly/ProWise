package com.prowise.delivery;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectClosureRepository extends JpaRepository<ProjectClosureEntity, String> {
    Optional<ProjectClosureEntity> findByIdAndOrgId(String id, UUID orgId);
    List<ProjectClosureEntity> findByOrgIdAndProjectIdOrderByClosedAtDesc(UUID orgId, String projectId);
    Optional<ProjectClosureEntity> findFirstByOrgIdAndProjectIdOrderByClosedAtDesc(UUID orgId, String projectId);
}
