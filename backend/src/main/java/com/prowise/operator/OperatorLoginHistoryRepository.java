package com.prowise.operator;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OperatorLoginHistoryRepository extends JpaRepository<OperatorLoginHistoryEntity, UUID> {
    List<OperatorLoginHistoryEntity> findByEmailIgnoreCaseOrderByOccurredAtDesc(String email);
    List<OperatorLoginHistoryEntity> findByOperatorIdOrderByOccurredAtDesc(String operatorId);
}
