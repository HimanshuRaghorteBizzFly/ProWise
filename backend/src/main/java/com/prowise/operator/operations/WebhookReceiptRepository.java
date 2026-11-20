package com.prowise.operator.operations;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WebhookReceiptRepository extends JpaRepository<WebhookReceiptEntity, String> {
    List<WebhookReceiptEntity> findBySourceOrderByReceivedAtDesc(String source);
    List<WebhookReceiptEntity> findByStatusOrderByReceivedAtDesc(String status);
    List<WebhookReceiptEntity> findAllByOrderByReceivedAtDesc();
    long countByStatus(String status);
}
