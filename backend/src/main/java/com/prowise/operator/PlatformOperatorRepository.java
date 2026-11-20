package com.prowise.operator;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlatformOperatorRepository extends JpaRepository<PlatformOperatorEntity, String> {

    Optional<PlatformOperatorEntity> findByEmailIgnoreCase(String email);

    List<PlatformOperatorEntity> findByDepartmentId(String departmentId);

    List<PlatformOperatorEntity> findByStatus(String status);

    @Query("SELECT o FROM PlatformOperatorEntity o WHERE " +
           "(:dept IS NULL OR o.departmentId = :dept) AND " +
           "(:roleId IS NULL OR o.roleId = :roleId) AND " +
           "(:status IS NULL OR o.status = :status) AND " +
           "(:query IS NULL OR LOWER(o.name) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(o.email) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<PlatformOperatorEntity> searchOperators(
            @Param("dept") String department,
            @Param("roleId") String roleId,
            @Param("status") String status,
            @Param("query") String query
    );

    long countByStatus(String status);

    long countByRoleIdAndStatus(String roleId, String status);
}
