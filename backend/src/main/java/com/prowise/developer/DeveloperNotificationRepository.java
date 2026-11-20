package com.prowise.developer;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DeveloperNotificationRepository extends JpaRepository<DeveloperNotificationEntity, String> {
    List<DeveloperNotificationEntity> findByUserIdOrderByCreatedAtDesc(String userId);
    List<DeveloperNotificationEntity> findByUserIdAndReadFalseOrderByCreatedAtDesc(String userId);
    long countByUserIdAndReadFalse(String userId);
}
