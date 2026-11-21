package com.prowise.project;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectOwnershipHistoryRepository extends JpaRepository<ProjectOwnershipHistoryEntity, UUID> {
    List<ProjectOwnershipHistoryEntity> findByOrgIdAndProjectIdOrderByChangedAtDesc(UUID orgId, String projectId);
}
