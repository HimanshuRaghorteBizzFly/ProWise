package com.prowise.project;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectDateHistoryRepository extends JpaRepository<ProjectDateHistoryEntity, UUID> {
    List<ProjectDateHistoryEntity> findByOrgIdAndProjectIdOrderByChangedAtDesc(UUID orgId, String projectId);
}
