package com.prowise.operator.operations;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface IncidentRepository extends JpaRepository<IncidentEntity, String> {
    List<IncidentEntity> findByDepartmentIdOrderByCreatedAtDesc(String departmentId);
    List<IncidentEntity> findByStatusOrderByCreatedAtDesc(String status);
    List<IncidentEntity> findByAssignedOperatorIdOrderByCreatedAtDesc(String assignedOperatorId);
    List<IncidentEntity> findAllByOrderByCreatedAtDesc();

    @Query("SELECT i FROM IncidentEntity i WHERE " +
           "(:dept IS NULL OR i.departmentId = :dept) AND " +
           "(:status IS NULL OR i.status = :status) AND " +
           "(:severity IS NULL OR i.severity = :severity) " +
           "ORDER BY i.createdAt DESC")
    List<IncidentEntity> searchIncidents(
            @Param("dept") String departmentId,
            @Param("status") String status,
            @Param("severity") String severity
    );

    long countByStatusNot(String status);
    long countByDepartmentIdAndStatusNot(String departmentId, String status);
    long countByAssignedOperatorIdAndStatusNot(String assignedOperatorId, String status);
}
