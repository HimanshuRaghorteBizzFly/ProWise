package com.prowise.superadmin.invoices;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface InvoiceRepository extends JpaRepository<InvoiceEntity, String> {

    List<InvoiceEntity> findByOrgIdOrderByIssueDateDesc(UUID orgId);

    List<InvoiceEntity> findByStatusOrderByIssueDateDesc(String status);

    Optional<InvoiceEntity> findByInvoiceNumber(String invoiceNumber);

    @Query("SELECT i FROM InvoiceEntity i WHERE " +
           "(:orgId IS NULL OR i.orgId = :orgId) AND " +
           "(:status IS NULL OR i.status = :status) " +
           "ORDER BY i.issueDate DESC")
    List<InvoiceEntity> findFiltered(
            @Param("orgId") UUID orgId,
            @Param("status") String status
    );
}
