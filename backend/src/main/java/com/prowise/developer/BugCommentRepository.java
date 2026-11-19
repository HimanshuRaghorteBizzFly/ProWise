package com.prowise.developer;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BugCommentRepository extends JpaRepository<BugCommentEntity, String> {
    List<BugCommentEntity> findByBugIdOrderByCreatedAtAsc(String bugId);
}
