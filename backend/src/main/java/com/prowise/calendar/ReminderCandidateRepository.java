package com.prowise.calendar;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ReminderCandidateRepository extends JpaRepository<ReminderCandidateEntity, String> {

    List<ReminderCandidateEntity> findByOrgIdAndStatusOrderByScheduledForAsc(UUID orgId, String status);

    List<ReminderCandidateEntity> findByOrgIdAndProjectIdAndStatus(UUID orgId, String projectId, String status);

    List<ReminderCandidateEntity> findByOccurrenceId(String occurrenceId);
}
