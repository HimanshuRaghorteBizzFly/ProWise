package com.prowise.superadmin.featureflags;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FeatureFlagRepository extends JpaRepository<FeatureFlagEntity, String> {
    Optional<FeatureFlagEntity> findByFlagKey(String flagKey);
}
