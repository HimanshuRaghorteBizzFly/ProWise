package com.prowise.operator.operations;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupportAccessRequestRepository extends JpaRepository<SupportAccessRequestEntity, String> {
    List<SupportAccessRequestEntity> findByStatusOrderByCreatedAtDesc(String status);
    List<SupportAccessRequestEntity> findAllByOrderByCreatedAtDesc();
}
