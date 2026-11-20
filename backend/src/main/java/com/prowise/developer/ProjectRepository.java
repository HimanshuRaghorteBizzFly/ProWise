package com.prowise.developer;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectRepository extends JpaRepository<ProjectEntity, String> {

    @Query("SELECT p FROM ProjectEntity p WHERE p.accountableOwnerId = :userId OR p.memberIds LIKE %:userId%")
    List<ProjectEntity> findAssignedProjects(@Param("userId") String userId);

    @Query("SELECT p FROM ProjectEntity p WHERE (p.accountableOwnerId = :userId OR p.memberIds LIKE %:userId%) AND (:orgId IS NULL OR p.orgId = :orgId)")
    List<ProjectEntity> findAssignedProjectsByOrg(@Param("userId") String userId, @Param("orgId") UUID orgId);
}
