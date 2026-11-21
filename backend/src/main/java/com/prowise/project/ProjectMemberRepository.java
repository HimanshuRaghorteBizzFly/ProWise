package com.prowise.project;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectMemberRepository extends JpaRepository<ProjectMemberEntity, UUID> {
    List<ProjectMemberEntity> findByOrgIdAndProjectId(UUID orgId, String projectId);
    Optional<ProjectMemberEntity> findByOrgIdAndProjectIdAndMembershipId(UUID orgId, String projectId, UUID membershipId);
    void deleteByOrgIdAndProjectIdAndMembershipId(UUID orgId, String projectId, UUID membershipId);
}
