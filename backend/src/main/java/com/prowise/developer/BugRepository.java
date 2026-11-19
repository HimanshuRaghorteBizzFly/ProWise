package com.prowise.developer;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface BugRepository extends JpaRepository<BugEntity, String> {

    @Query("SELECT b FROM BugEntity b WHERE b.assignedDeveloperId = :assignedTo")
    List<BugEntity> findByAssignedTo(@Param("assignedTo") String assignedTo);

    List<BugEntity> findByProjectId(String projectId);

    @Query("SELECT COUNT(b) FROM BugEntity b WHERE b.assignedDeveloperId = :assignedTo AND b.status <> :status")
    long countByAssignedToAndStatusNot(@Param("assignedTo") String assignedTo, @Param("status") String status);
}
