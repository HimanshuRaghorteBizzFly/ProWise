package com.prowise.developer;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SprintRepository extends JpaRepository<SprintEntity, String> {
    List<SprintEntity> findByProjectId(String projectId);
    List<SprintEntity> findByProjectIdAndStatus(String projectId, String status);
}
