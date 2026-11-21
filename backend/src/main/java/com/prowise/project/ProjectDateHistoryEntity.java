package com.prowise.project;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_date_history")
public class ProjectDateHistoryEntity {

    @Id
    @Column(name = "id")
    private UUID id = UUID.randomUUID();

    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    @Column(name = "old_target_date")
    private Instant oldTargetDate;

    @Column(name = "new_target_date", nullable = false)
    private Instant newTargetDate;

    @Column(name = "reason", nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "changed_at", nullable = false)
    private Instant changedAt = Instant.now();

    public ProjectDateHistoryEntity() {}

    public ProjectDateHistoryEntity(UUID orgId, String projectId, Instant oldTargetDate, Instant newTargetDate, String reason, UUID actorId) {
        this.id = UUID.randomUUID();
        this.orgId = orgId;
        this.projectId = projectId;
        this.oldTargetDate = oldTargetDate;
        this.newTargetDate = newTargetDate;
        this.reason = reason;
        this.actorId = actorId;
        this.changedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public Instant getOldTargetDate() { return oldTargetDate; }
    public void setOldTargetDate(Instant oldTargetDate) { this.oldTargetDate = oldTargetDate; }
    public Instant getNewTargetDate() { return newTargetDate; }
    public void setNewTargetDate(Instant newTargetDate) { this.newTargetDate = newTargetDate; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public UUID getActorId() { return actorId; }
    public void setActorId(UUID actorId) { this.actorId = actorId; }
    public Instant getChangedAt() { return changedAt; }
    public void setChangedAt(Instant changedAt) { this.changedAt = changedAt; }
}
