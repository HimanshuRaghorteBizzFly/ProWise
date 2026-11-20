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
public interface DiscussionRepository extends JpaRepository<DiscussionEntity, String> {
    Optional<DiscussionEntity> findByIdAndOrgId(String id, UUID orgId);
    List<DiscussionEntity> findByOrgIdAndProjectIdOrderByUpdatedAtDesc(UUID orgId, String projectId);
    List<DiscussionEntity> findByOrgIdAndProjectIdInOrderByUpdatedAtDesc(UUID orgId, List<String> projectIds);
}
