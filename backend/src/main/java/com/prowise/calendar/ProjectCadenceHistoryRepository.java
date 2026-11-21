package com.prowise.calendar;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectCadenceHistoryRepository extends JpaRepository<ProjectCadenceHistoryEntity, String> {
    List<ProjectCadenceHistoryEntity> findByOrgIdAndProjectIdOrderByCreatedAtDesc(UUID orgId, String projectId);
}
