package com.prowise.operator;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OperatorAuditLogRepository extends JpaRepository<OperatorAuditLogEntity, UUID> {
    List<OperatorAuditLogEntity> findByOperatorIdOrderByOccurredAtDesc(String operatorId);
}
