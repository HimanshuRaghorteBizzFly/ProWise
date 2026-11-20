package com.prowise.operator.operations;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MaintenanceWindowRepository extends JpaRepository<MaintenanceWindowEntity, String> {
    List<MaintenanceWindowEntity> findByDepartmentIdOrderByScheduledStartDesc(String departmentId);
    List<MaintenanceWindowEntity> findByStatusOrderByScheduledStartDesc(String status);
    List<MaintenanceWindowEntity> findAllByOrderByScheduledStartDesc();
}
