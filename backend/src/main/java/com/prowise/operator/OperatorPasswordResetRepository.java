package com.prowise.operator;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OperatorPasswordResetRepository extends JpaRepository<OperatorPasswordResetEntity, UUID> {
    Optional<OperatorPasswordResetEntity> findByTokenHashAndUsedAtIsNull(String tokenHash);
}
