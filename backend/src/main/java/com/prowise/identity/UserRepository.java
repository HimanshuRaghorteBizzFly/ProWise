package com.prowise.identity;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends JpaRepository<UserEntity, UUID> {

    Optional<UserEntity> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    @Query("SELECT u FROM UserEntity u WHERE "
            + "(CAST(:search AS string) IS NULL OR LOWER(u.email) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')) OR LOWER(u.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))) AND "
            + "(CAST(:role AS string) IS NULL OR u.role = :role) AND "
            + "(CAST(:department AS string) IS NULL OR u.department = :department) AND "
            + "(CAST(:status AS string) IS NULL OR u.status = :status) AND "
            + "(:organizationId IS NULL OR u.organizationId = :organizationId)")
    Page<UserEntity> searchUsers(
            @Param("search") String search,
            @Param("role") String role,
            @Param("department") String department,
            @Param("status") String status,
            @Param("organizationId") UUID organizationId,
            Pageable pageable
    );

    List<UserEntity> findByRole(String role);

    List<UserEntity> findByOrganizationId(UUID organizationId);
}
