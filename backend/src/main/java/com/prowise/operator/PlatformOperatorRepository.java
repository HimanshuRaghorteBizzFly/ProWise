package com.prowise.operator;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PlatformOperatorRepository extends JpaRepository<PlatformOperatorEntity, String> {

    /** Super Admin edit guard (rule 5): bumps the version only if it is still the one the client read. */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true)
    @Query(value = "UPDATE platform_operators SET version = version + 1 WHERE id = :id AND version = :expected", nativeQuery = true)
    int bumpVersion(@Param("id") String id, @Param("expected") long expected);

    Optional<PlatformOperatorEntity> findByEmailIgnoreCase(String email);

    /** True while a sign-in lock is in force (V32 lockout columns). */
    @Query(value = "SELECT COALESCE(locked_until > now(), false) FROM platform_operators WHERE id = :id", nativeQuery = true)
    Boolean isLocked(@Param("id") String id);

    /** Counts a wrong password; the {@code max}-th in a row locks the account for {@code minutes} and restarts the count. */
    @org.springframework.data.jpa.repository.Modifying
    @Query(value = """
            UPDATE platform_operators SET
                locked_until = CASE WHEN failed_login_count + 1 >= :max THEN now() + (:minutes * interval '1 minute') ELSE locked_until END,
                failed_login_count = CASE WHEN failed_login_count + 1 >= :max THEN 0 ELSE failed_login_count + 1 END
            WHERE id = :id
            """, nativeQuery = true)
    int registerFailedLogin(@Param("id") String id, @Param("max") int max, @Param("minutes") int minutes);

    @org.springframework.data.jpa.repository.Modifying
    @Query(value = "UPDATE platform_operators SET failed_login_count = 0, locked_until = NULL "
            + "WHERE id = :id AND (failed_login_count > 0 OR locked_until IS NOT NULL)", nativeQuery = true)
    int clearFailedLogins(@Param("id") String id);

    List<PlatformOperatorEntity> findByDepartmentId(String departmentId);

    List<PlatformOperatorEntity> findByStatus(String status);

    @Query("SELECT o FROM PlatformOperatorEntity o WHERE " +
           "(:dept IS NULL OR o.departmentId = :dept) AND " +
           "(:roleId IS NULL OR o.roleId = :roleId) AND " +
           "(:status IS NULL OR o.status = :status) AND " +
           "(:query IS NULL OR LOWER(o.name) LIKE LOWER(CONCAT('%', CAST(:query AS String), '%')) OR LOWER(o.email) LIKE LOWER(CONCAT('%', CAST(:query AS String), '%')))")
    List<PlatformOperatorEntity> searchOperators(
            @Param("dept") String department,
            @Param("roleId") String roleId,
            @Param("status") String status,
            @Param("query") String query
    );

    long countByStatus(String status);

    long countByRoleIdAndStatus(String roleId, String status);
}
