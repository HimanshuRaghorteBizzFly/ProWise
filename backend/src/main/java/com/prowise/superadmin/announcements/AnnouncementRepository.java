package com.prowise.superadmin.announcements;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AnnouncementRepository extends JpaRepository<AnnouncementEntity, String> {
    List<AnnouncementEntity> findByStatusOrderByCreatedAtDesc(String status);
    List<AnnouncementEntity> findByTypeOrderByCreatedAtDesc(String type);
}
