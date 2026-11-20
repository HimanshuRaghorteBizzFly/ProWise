package com.prowise.operator.operations;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OperatorActivityLogRecordRepository extends JpaRepository<OperatorActivityLogRecordEntity, UUID> {
    List<OperatorActivityLogRecordEntity> findByOperatorIdOrderByCreatedAtDesc(String operatorId);
    List<OperatorActivityLogRecordEntity> findByDepartmentIdOrderByCreatedAtDesc(String departmentId);
    List<OperatorActivityLogRecordEntity> findAllByOrderByCreatedAtDesc();
}
