package com.prowise.superadmin.plans;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlanRepository extends JpaRepository<PlanEntity, String> {
    Optional<PlanEntity> findByCode(String code);
}
