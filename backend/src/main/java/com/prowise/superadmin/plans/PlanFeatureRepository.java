package com.prowise.superadmin.plans;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlanFeatureRepository extends JpaRepository<PlanFeatureEntity, UUID> {
    List<PlanFeatureEntity> findByPlanIdOrderBySortOrderAsc(String planId);
    void deleteByPlanId(String planId);
}
