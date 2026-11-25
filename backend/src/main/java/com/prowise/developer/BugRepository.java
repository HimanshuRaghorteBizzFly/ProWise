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
public interface BugRepository extends JpaRepository<BugEntity, String> {
    Optional<BugEntity> findByIdAndOrgId(String id, UUID orgId);

    List<BugEntity> findByOrgIdAndProjectId(UUID orgId, String projectId);

    @Query("SELECT b FROM BugEntity b WHERE b.orgId = :orgId AND b.assignedDeveloperId = :assignedTo")
    List<BugEntity> findByOrgIdAndAssignedTo(@Param("orgId") UUID orgId, @Param("assignedTo") String assignedTo);

    /** Bugs assigned to the developer that are still open: RESOLVED and CLOSED are terminal (V8 ck_bug_status). */
    @Query("SELECT COUNT(b) FROM BugEntity b WHERE b.orgId = :orgId AND b.assignedDeveloperId = :assignedTo"
            + " AND b.status NOT IN ('RESOLVED', 'CLOSED')")
    long countOpenAssigned(@Param("orgId") UUID orgId, @Param("assignedTo") String assignedTo);
}
