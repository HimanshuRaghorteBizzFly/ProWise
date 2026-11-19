package com.prowise.operator.operations;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BackgroundJobRepository extends JpaRepository<BackgroundJobEntity, String> {
    List<BackgroundJobEntity> findByQueueNameOrderByCreatedAtDesc(String queueName);
    List<BackgroundJobEntity> findByStatusOrderByCreatedAtDesc(String status);
    List<BackgroundJobEntity> findAllByOrderByCreatedAtDesc();
    long countByStatus(String status);
}
