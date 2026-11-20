package com.prowise.operator;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OperatorDepartmentPermissionRepository extends JpaRepository<OperatorDepartmentPermissionEntity, UUID> {
    List<OperatorDepartmentPermissionEntity> findByDepartmentId(String departmentId);
}
