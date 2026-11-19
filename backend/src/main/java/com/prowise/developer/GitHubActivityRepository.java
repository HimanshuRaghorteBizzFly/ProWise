package com.prowise.developer;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GitHubActivityRepository extends JpaRepository<GitHubActivityEntity, String> {
    List<GitHubActivityEntity> findByRepositoryNameOrderByCreatedAtDesc(String repositoryName);
    List<GitHubActivityEntity> findAllByOrderByCreatedAtDesc();
    List<GitHubActivityEntity> findByActorOrderByCreatedAtDesc(String actor);
}
