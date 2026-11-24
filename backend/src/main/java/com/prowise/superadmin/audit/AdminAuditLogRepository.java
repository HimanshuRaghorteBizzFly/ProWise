package com.prowise.superadmin.audit;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLogEntity, UUID> {

    @Query("""
        SELECT a FROM AdminAuditLogEntity a
        WHERE (:category = '' OR a.category = :category)
          AND (:severity = '' OR a.severity = :severity)
          AND (:search = '' OR LOWER(a.summary) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(a.action) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(a.actorName) LIKE LOWER(CONCAT('%', :search, '%')))
          AND a.timestamp >= :fromDate
          AND a.timestamp <= :toDate
        ORDER BY a.timestamp DESC
    """)
    List<AdminAuditLogEntity> searchAuditLogs(
            @Param("category") String category,
            @Param("severity") String severity,
            @Param("search") String search,
            @Param("fromDate") Instant fromDate,
            @Param("toDate") Instant toDate
    );

    List<AdminAuditLogEntity> findTop10ByOrderByTimestampDesc();
}
