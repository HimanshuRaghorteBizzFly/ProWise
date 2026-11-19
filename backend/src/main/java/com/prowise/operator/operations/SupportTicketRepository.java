package com.prowise.operator.operations;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SupportTicketRepository extends JpaRepository<SupportTicketEntity, String> {
    List<SupportTicketEntity> findByDepartmentIdOrderByCreatedAtDesc(String departmentId);
    List<SupportTicketEntity> findByStatusOrderByCreatedAtDesc(String status);
    List<SupportTicketEntity> findByAssignedOperatorIdOrderByCreatedAtDesc(String assignedOperatorId);
    List<SupportTicketEntity> findAllByOrderByCreatedAtDesc();

    @Query("SELECT t FROM SupportTicketEntity t WHERE " +
           "(:dept IS NULL OR t.departmentId = :dept) AND " +
           "(:status IS NULL OR t.status = :status) AND " +
           "(:priority IS NULL OR t.priority = :priority) " +
           "ORDER BY t.createdAt DESC")
    List<SupportTicketEntity> searchTickets(
            @Param("dept") String departmentId,
            @Param("status") String status,
            @Param("priority") String priority
    );

    long countByStatusIn(List<String> statuses);
    long countByDepartmentIdAndStatusIn(String departmentId, List<String> statuses);
    long countByAssignedOperatorIdAndStatusIn(String assignedOperatorId, List<String> statuses);
}
