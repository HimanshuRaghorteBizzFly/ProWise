package com.prowise.superadmin.policies;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlatformBrandingRepository extends JpaRepository<PlatformBrandingEntity, String> {}
