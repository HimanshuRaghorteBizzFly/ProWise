package com.prowise.operator.operations;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IncidentAssignmentRepository extends JpaRepository<IncidentAssignmentEntity, UUID> {
    List<IncidentAssignmentEntity> findByIncidentIdOrderByCreatedAtDesc(String incidentId);
    List<IncidentAssignmentEntity> findByAssignedToOrderByCreatedAtDesc(String assignedTo);
}
