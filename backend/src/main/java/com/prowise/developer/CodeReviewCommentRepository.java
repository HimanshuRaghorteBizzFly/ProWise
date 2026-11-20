package com.prowise.developer;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CodeReviewCommentRepository extends JpaRepository<CodeReviewCommentEntity, String> {
    List<CodeReviewCommentEntity> findByReviewIdOrderByCreatedAtAsc(String reviewId);
}
