package com.prowise.developer;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/** Every query is scoped by org_id (task 1.3). Never call findById: use the org-scoped finder. */
@Repository
public interface TaskBlockerRepository extends JpaRepository<TaskBlockerEntity, String> {
    Optional<TaskBlockerEntity> findByIdAndOrgId(String id, UUID orgId);
    List<TaskBlockerEntity> findByOrgIdAndTaskIdOrderByCreatedAtDesc(UUID orgId, String taskId);
    List<TaskBlockerEntity> findByOrgIdAndTaskIdAndResolvedFalse(UUID orgId, String taskId);
}
