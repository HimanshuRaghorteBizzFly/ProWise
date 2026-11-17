package com.prowise.authz;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GrantRepository extends JpaRepository<GrantEntity, UUID> {}
