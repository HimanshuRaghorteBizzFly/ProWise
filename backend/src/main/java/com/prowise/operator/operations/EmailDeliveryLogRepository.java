package com.prowise.operator.operations;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface EmailDeliveryLogRepository extends JpaRepository<EmailDeliveryLogEntity, String>,
        JpaSpecificationExecutor<EmailDeliveryLogEntity> {
    List<EmailDeliveryLogEntity> findByStatusOrderByCreatedAtDesc(String status);
    List<EmailDeliveryLogEntity> findAllByOrderByCreatedAtDesc();
    long countByStatus(String status);

    /** Latest delivery attempt of one kind for an account, e.g. the most recent setup email. */
    Optional<EmailDeliveryLogEntity> findFirstByUserIdAndEmailTypeOrderByCreatedAtDesc(UUID userId, String emailType);
}
