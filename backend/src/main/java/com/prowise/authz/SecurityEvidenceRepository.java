package com.prowise.authz;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SecurityEvidenceRepository extends JpaRepository<SecurityEvidenceEntity, UUID> {}
