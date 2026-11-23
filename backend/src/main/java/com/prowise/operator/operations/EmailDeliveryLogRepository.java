package com.prowise.operator.operations;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailDeliveryLogRepository extends JpaRepository<EmailDeliveryLogEntity, String> {
    List<EmailDeliveryLogEntity> findByStatusOrderBySentAtDesc(String status);
    List<EmailDeliveryLogEntity> findAllByOrderBySentAtDesc();
    long countByStatus(String status);

    /** Latest delivery attempt of one kind for an account, e.g. the most recent setup email. */
    Optional<EmailDeliveryLogEntity> findFirstByUserIdAndEmailTypeOrderByCreatedAtDesc(UUID userId, String emailType);
}
