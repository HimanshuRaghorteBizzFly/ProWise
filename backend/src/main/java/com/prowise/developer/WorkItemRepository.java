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
public interface WorkItemRepository extends JpaRepository<WorkItemEntity, String> {

    /** Task 3.1+ breakdown tasks (created through the work breakdown) follow the review flow of task 3.3 only. */
    @Query(value = "SELECT count(*) FROM work_items WHERE id = :id AND created_by IS NOT NULL", nativeQuery = true)
    long countBreakdownItems(@Param("id") String id);
    Optional<WorkItemEntity> findByIdAndOrgId(String id, UUID orgId);
    List<WorkItemEntity> findByOrgIdAndPrimaryAssigneeId(UUID orgId, String primaryAssigneeId);
    List<WorkItemEntity> findByOrgIdAndProjectId(UUID orgId, String projectId);
    List<WorkItemEntity> findByOrgIdAndSprintId(UUID orgId, String sprintId);
}
