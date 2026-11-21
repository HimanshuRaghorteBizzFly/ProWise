package com.prowise.developer;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** Every query is scoped by org_id (task 1.3). Never call findById: use the org-scoped finder. */
@Repository
public interface ProjectCheckInRepository extends JpaRepository<ProjectCheckInEntity, String> {

    Optional<ProjectCheckInEntity> findByIdAndOrgId(String id, UUID orgId);

    Optional<ProjectCheckInEntity> findByOrgIdAndIdempotencyKey(UUID orgId, String idempotencyKey);

    List<ProjectCheckInEntity> findByOrgIdAndProjectIdOrderByCreatedAtDesc(UUID orgId, String projectId);

    List<ProjectCheckInEntity> findByOrgIdAndProjectIdOrderByRevisionSeqDescCreatedAtDesc(UUID orgId, String projectId);

    List<ProjectCheckInEntity> findByOrgIdAndStatusOrderByCreatedAtDesc(UUID orgId, String status);

    List<ProjectCheckInEntity> findByOrgIdAndProjectIdAndStatusOrderByCreatedAtDesc(UUID orgId, String projectId, String status);

    Optional<ProjectCheckInEntity> findTop1ByOrgIdAndProjectIdOrderByCreatedAtDesc(UUID orgId, String projectId);

    Optional<ProjectCheckInEntity> findTop1ByOrgIdAndProjectIdOrderByRevisionSeqDescCreatedAtDesc(UUID orgId, String projectId);

    Optional<ProjectCheckInEntity> findTop1ByOrgIdAndProjectIdAndStatusOrderByRevisionSeqDescCreatedAtDesc(UUID orgId, String projectId, String status);
}
