package com.prowise.superadmin.subscriptions;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface SubscriptionRepository extends JpaRepository<SubscriptionEntity, String> {

    List<SubscriptionEntity> findByOrgId(UUID orgId);
    Optional<SubscriptionEntity> findFirstByOrgIdOrderByCreatedAtDesc(UUID orgId);

    @Query("""
        SELECT s FROM SubscriptionEntity s
        WHERE (:planId IS NULL OR s.planId = :planId)
          AND (:status IS NULL OR s.status = :status)
        ORDER BY s.createdAt DESC
    """)
    List<SubscriptionEntity> searchSubscriptions(
            @Param("planId") String planId,
            @Param("status") String status
    );
}
