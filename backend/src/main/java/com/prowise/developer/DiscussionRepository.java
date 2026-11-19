package com.prowise.developer;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DiscussionRepository extends JpaRepository<DiscussionEntity, String> {
    List<DiscussionEntity> findByProjectIdOrderByUpdatedAtDesc(String projectId);
    List<DiscussionEntity> findAllByOrderByUpdatedAtDesc();
}
