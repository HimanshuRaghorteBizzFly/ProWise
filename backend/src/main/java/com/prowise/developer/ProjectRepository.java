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
public interface ProjectRepository extends JpaRepository<ProjectEntity, String> {
    Optional<ProjectEntity> findByIdAndOrgId(String id, UUID orgId);

    Optional<ProjectEntity> findByOrgIdAndKey(UUID orgId, String key);

    boolean existsByOrgIdAndKey(UUID orgId, String key);

    List<ProjectEntity> findByOrgIdOrderByNameAsc(UUID orgId);

    List<ProjectEntity> findByOrgIdOrderByCreatedAtDesc(UUID orgId);

    List<ProjectEntity> findByOrgIdAndArchivedOrderByCreatedAtDesc(UUID orgId, boolean archived);

    @Query("SELECT p FROM ProjectEntity p WHERE p.orgId = :orgId AND (p.accountableOwnerId = :userId OR p.accountableDeveloperId = :userId OR p.memberIds LIKE CONCAT('%', :userId, '%')) ORDER BY p.name")
    List<ProjectEntity> findAssignedProjectsInOrg(@Param("orgId") UUID orgId, @Param("userId") String userId);
}
