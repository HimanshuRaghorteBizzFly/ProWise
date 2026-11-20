package com.prowise.developer;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TaskBlockerRepository extends JpaRepository<TaskBlockerEntity, String> {
    List<TaskBlockerEntity> findByTaskIdOrderByCreatedAtDesc(String taskId);
    List<TaskBlockerEntity> findByTaskIdAndResolvedFalse(String taskId);
}
