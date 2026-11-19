package com.prowise.developer;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DeveloperPreferenceRepository extends JpaRepository<DeveloperPreferenceEntity, String> {
}
