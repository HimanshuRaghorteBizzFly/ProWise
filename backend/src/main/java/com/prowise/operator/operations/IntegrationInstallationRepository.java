package com.prowise.operator.operations;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IntegrationInstallationRepository extends JpaRepository<IntegrationInstallationEntity, String> {
    List<IntegrationInstallationEntity> findByType(String type);
    List<IntegrationInstallationEntity> findAllByOrderByCreatedAtDesc();
}
