package com.prowise.calendar;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DueOccurrenceRepository extends JpaRepository<DueOccurrenceEntity, String> {

    List<DueOccurrenceEntity> findByOrgIdAndProjectIdOrderByDueLocalDateAsc(UUID orgId, String projectId);

    List<DueOccurrenceEntity> findByOrgIdAndProjectIdAndStatusOrderByDueLocalDateAsc(UUID orgId, String projectId, String status);

    Optional<DueOccurrenceEntity> findByProjectIdAndKindAndDueLocalDateAndPolicyVersion(
            String projectId, String kind, LocalDate dueLocalDate, Long policyVersion);

    List<DueOccurrenceEntity> findByOrgIdAndStatus(UUID orgId, String status);
}
