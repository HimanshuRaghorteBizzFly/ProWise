package com.prowise.developer;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CodeReviewRepository extends JpaRepository<CodeReviewEntity, String> {
    List<CodeReviewEntity> findByReviewerId(String reviewerId);
    List<CodeReviewEntity> findByAuthorId(String authorId);
    List<CodeReviewEntity> findByProjectId(String projectId);
    long countByReviewerIdAndStatus(String reviewerId, String status);
}
