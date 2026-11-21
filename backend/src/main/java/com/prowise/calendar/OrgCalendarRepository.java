package com.prowise.calendar;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OrgCalendarRepository extends JpaRepository<OrgCalendarEntity, UUID> {
    Optional<OrgCalendarEntity> findByOrgId(UUID orgId);
}
