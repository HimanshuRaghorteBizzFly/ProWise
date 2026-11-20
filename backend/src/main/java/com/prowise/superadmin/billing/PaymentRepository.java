package com.prowise.superadmin.billing;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PaymentRepository extends JpaRepository<PaymentEntity, String> {

    List<PaymentEntity> findByOrgIdOrderByCreatedAtDesc(UUID orgId);

    List<PaymentEntity> findByStatusOrderByCreatedAtDesc(String status);

    Optional<PaymentEntity> findByTransactionRef(String transactionRef);

    @Query("SELECT p FROM PaymentEntity p WHERE " +
           "(:orgId IS NULL OR p.orgId = :orgId) AND " +
           "(:status IS NULL OR p.status = :status) " +
           "ORDER BY p.createdAt DESC")
    List<PaymentEntity> findFiltered(
            @Param("orgId") UUID orgId,
            @Param("status") String status
    );
}
