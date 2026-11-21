package com.prowise.project;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_ownership_history")
public class ProjectOwnershipHistoryEntity {

    @Id
    @Column(name = "id")
    private UUID id = UUID.randomUUID();

    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    @Column(name = "old_owner_id", length = 64)
    private String oldOwnerId;

    @Column(name = "new_owner_id", nullable = false, length = 64)
    private String newOwnerId;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @Column(name = "changed_by")
    private UUID changedBy;

    @Column(name = "changed_at", nullable = false)
    private Instant changedAt = Instant.now();

    public ProjectOwnershipHistoryEntity() {}

    public ProjectOwnershipHistoryEntity(UUID orgId, String projectId, String oldOwnerId, String newOwnerId, String reason, UUID changedBy) {
        this.id = UUID.randomUUID();
        this.orgId = orgId;
        this.projectId = projectId;
        this.oldOwnerId = oldOwnerId;
        this.newOwnerId = newOwnerId;
        this.reason = reason;
        this.changedBy = changedBy;
        this.changedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getOldOwnerId() { return oldOwnerId; }
    public void setOldOwnerId(String oldOwnerId) { this.oldOwnerId = oldOwnerId; }
    public String getNewOwnerId() { return newOwnerId; }
    public void setNewOwnerId(String newOwnerId) { this.newOwnerId = newOwnerId; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public UUID getChangedBy() { return changedBy; }
    public void setChangedBy(UUID changedBy) { this.changedBy = changedBy; }
    public Instant getChangedAt() { return changedAt; }
    public void setChangedAt(Instant changedAt) { this.changedAt = changedAt; }
}
