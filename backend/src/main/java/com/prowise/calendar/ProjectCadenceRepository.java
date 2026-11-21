package com.prowise.calendar;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectCadenceRepository extends JpaRepository<ProjectCadenceEntity, String> {
    Optional<ProjectCadenceEntity> findByProjectIdAndOrgId(String projectId, UUID orgId);
    Optional<ProjectCadenceEntity> findByProjectId(String projectId);
}
