package com.prowise.developer;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TaskCommentRepository extends JpaRepository<TaskCommentEntity, String> {
    List<TaskCommentEntity> findByTaskIdOrderByCreatedAtAsc(String taskId);
}
