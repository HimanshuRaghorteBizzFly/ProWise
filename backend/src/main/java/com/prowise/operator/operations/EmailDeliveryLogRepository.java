package com.prowise.operator.operations;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailDeliveryLogRepository extends JpaRepository<EmailDeliveryLogEntity, String> {
    List<EmailDeliveryLogEntity> findByStatusOrderBySentAtDesc(String status);
    List<EmailDeliveryLogEntity> findAllByOrderBySentAtDesc();
    long countByStatus(String status);
}
