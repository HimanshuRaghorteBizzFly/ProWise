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

    /**
     * {@code search} is cast to text: an unset (null) parameter is otherwise bound as bytea and LOWER() fails.
     * {@code fromDate} / {@code toDate} are always set (the service fills open bounds), since PostgreSQL cannot type
     * a null timestamp parameter.
     */
    @Query("""
        SELECT a FROM AdminAuditLogEntity a
<<<<<<< HEAD
        WHERE (:category = '' OR a.category = :category)
          AND (:severity = '' OR a.severity = :severity)
          AND (:search = '' OR LOWER(a.summary) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(a.action) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(a.actorName) LIKE LOWER(CONCAT('%', :search, '%')))
=======
        WHERE (:category IS NULL OR a.category = :category)
          AND (:severity IS NULL OR a.severity = :severity)
          AND (CAST(:search AS String) IS NULL
                OR LOWER(a.summary) LIKE LOWER(CONCAT('%', CAST(:search AS String), '%'))
                OR LOWER(a.action) LIKE LOWER(CONCAT('%', CAST(:search AS String), '%'))
                OR LOWER(a.actorName) LIKE LOWER(CONCAT('%', CAST(:search AS String), '%')))
>>>>>>> 29db595 (Initial ProWise project upload)
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
