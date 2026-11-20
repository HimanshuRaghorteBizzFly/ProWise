package com.prowise.operator.operations;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OperationalAlertRepository extends JpaRepository<OperationalAlertEntity, String> {
    List<OperationalAlertEntity> findByAcknowledgedOrderByCreatedAtDesc(boolean acknowledged);
    List<OperationalAlertEntity> findByDepartmentIdOrderByCreatedAtDesc(String departmentId);
    List<OperationalAlertEntity> findAllByOrderByCreatedAtDesc();
    long countByAcknowledgedFalse();
}
