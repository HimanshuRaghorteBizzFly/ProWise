package com.prowise.delivery;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_lifecycle_history")
public class ProjectLifecycleHistoryEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    @Column(name = "previous_lifecycle", length = 32)
    private String previousLifecycle;

    @Column(name = "new_lifecycle", nullable = false, length = 32)
    private String newLifecycle;

    @Column(name = "reason", columnDefinition = "text")
    private String reason;

    @Column(name = "actor_id", nullable = false, length = 64)
    private String actorId;

    @Column(name = "actor_name", length = 150)
    private String actorName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public ProjectLifecycleHistoryEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }

    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }

    public String getPreviousLifecycle() { return previousLifecycle; }
    public void setPreviousLifecycle(String previousLifecycle) { this.previousLifecycle = previousLifecycle; }

    public String getNewLifecycle() { return newLifecycle; }
    public void setNewLifecycle(String newLifecycle) { this.newLifecycle = newLifecycle; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getActorId() { return actorId; }
    public void setActorId(String actorId) { this.actorId = actorId; }

    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
