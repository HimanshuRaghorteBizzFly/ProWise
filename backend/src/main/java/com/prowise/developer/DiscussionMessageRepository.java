package com.prowise.developer;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DiscussionMessageRepository extends JpaRepository<DiscussionMessageEntity, String> {
    List<DiscussionMessageEntity> findByDiscussionIdOrderByCreatedAtAsc(String discussionId);
}
