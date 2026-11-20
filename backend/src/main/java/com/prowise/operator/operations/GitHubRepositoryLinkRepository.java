package com.prowise.operator.operations;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GitHubRepositoryLinkRepository extends JpaRepository<GitHubRepositoryLinkEntity, String> {
    List<GitHubRepositoryLinkEntity> findByInstallationId(String installationId);
    List<GitHubRepositoryLinkEntity> findAllByOrderByCreatedAtDesc();
}
