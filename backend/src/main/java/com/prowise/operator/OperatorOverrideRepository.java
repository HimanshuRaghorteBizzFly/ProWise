package com.prowise.operator;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OperatorOverrideRepository extends JpaRepository<OperatorPermissionOverrideEntity, UUID> {
    List<OperatorPermissionOverrideEntity> findByOperatorId(String operatorId);
    Optional<OperatorPermissionOverrideEntity> findByOperatorIdAndModuleKeyAndPermissionAction(
            String operatorId, String moduleKey, String permissionAction
    );
    void deleteByOperatorId(String operatorId);
}
