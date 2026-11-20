package com.prowise.superadmin.organizations;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface OrganizationRepository extends JpaRepository<OrganizationEntity, UUID> {

    Optional<OrganizationEntity> findBySlug(String slug);

    boolean existsBySlug(String slug);

    List<OrganizationEntity> findByStateOrderByCreatedAtDesc(String state);

    List<OrganizationEntity> findByPlanIdOrderByCreatedAtDesc(String planId);

    @Query("SELECT o FROM OrganizationEntity o WHERE " +
           "(:state IS NULL OR o.state = :state) AND " +
           "(:planId IS NULL OR o.planId = :planId) " +
           "ORDER BY o.createdAt DESC")
    List<OrganizationEntity> findFiltered(
            @Param("state") String state,
            @Param("planId") String planId
    );
}
