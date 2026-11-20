package com.prowise.developer;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectCheckInRepository extends JpaRepository<ProjectCheckInEntity, String> {
    List<ProjectCheckInEntity> findByProjectIdOrderByCreatedAtDesc(String projectId);
    List<ProjectCheckInEntity> findByAuthorIdOrderByCreatedAtDesc(String authorId);
    Optional<ProjectCheckInEntity> findTop1ByProjectIdOrderByCreatedAtDesc(String projectId);
}
