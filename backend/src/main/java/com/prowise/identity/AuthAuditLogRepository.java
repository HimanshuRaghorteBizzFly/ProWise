package com.prowise.identity;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AuthAuditLogRepository extends JpaRepository<AuthAuditLogEntity, UUID> {
    List<AuthAuditLogEntity> findByTargetUserIdOrderByCreatedAtDesc(UUID targetUserId);
    Page<AuthAuditLogEntity> findByOrderByCreatedAtDesc(Pageable pageable);
}
