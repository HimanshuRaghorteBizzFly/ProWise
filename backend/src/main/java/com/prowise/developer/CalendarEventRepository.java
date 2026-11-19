package com.prowise.developer;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CalendarEventRepository extends JpaRepository<CalendarEventEntity, String> {
    List<CalendarEventEntity> findByUserIdOrderByStartTimeAsc(String userId);
    List<CalendarEventEntity> findByUserIdAndStartTimeBetween(String userId, Instant start, Instant end);
}
