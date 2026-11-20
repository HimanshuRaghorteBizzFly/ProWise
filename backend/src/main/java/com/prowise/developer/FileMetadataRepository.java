package com.prowise.developer;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FileMetadataRepository extends JpaRepository<FileMetadataEntity, String> {
    List<FileMetadataEntity> findByProjectIdOrderByCreatedAtDesc(String projectId);
    List<FileMetadataEntity> findByWorkItemIdOrderByCreatedAtDesc(String workItemId);
    List<FileMetadataEntity> findByUploadedByOrderByCreatedAtDesc(String uploadedBy);
}
