package com.prowise.project;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectRepositoryLinkRepository extends JpaRepository<ProjectRepositoryLinkEntity, String> {

    List<ProjectRepositoryLinkEntity> findByOrgIdAndProjectId(UUID orgId, String projectId);

    Optional<ProjectRepositoryLinkEntity> findByOrgIdAndProjectIdAndRepoName(UUID orgId, String projectId, String repoName);

    void deleteByOrgIdAndProjectIdAndRepoName(UUID orgId, String projectId, String repoName);
}
