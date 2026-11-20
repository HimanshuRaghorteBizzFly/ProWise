package com.prowise.developer;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface WorkItemRepository extends JpaRepository<WorkItemEntity, String> {
    List<WorkItemEntity> findByPrimaryAssigneeId(String primaryAssigneeId);
    List<WorkItemEntity> findByProjectId(String projectId);
    List<WorkItemEntity> findBySprintId(String sprintId);
    List<WorkItemEntity> findByPrimaryAssigneeIdAndState(String primaryAssigneeId, String state);
    long countByPrimaryAssigneeId(String primaryAssigneeId);
    long countByPrimaryAssigneeIdAndState(String primaryAssigneeId, String state);
}
