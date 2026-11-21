package com.prowise.delivery;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectLifecycleHistoryRepository extends JpaRepository<ProjectLifecycleHistoryEntity, String> {
    List<ProjectLifecycleHistoryEntity> findByOrgIdAndProjectIdOrderByCreatedAtDesc(UUID orgId, String projectId);
}
