package com.prowise.calendar;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_cadence_history")
public class ProjectCadenceHistoryEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    @Column(name = "previous_frequency", length = 20)
    private String previousFrequency;

    @Column(name = "new_frequency", nullable = false, length = 20)
    private String newFrequency;

    @Column(name = "previous_grace")
    private Integer previousGrace;

    @Column(name = "new_grace", nullable = false)
    private int newGrace;

    @Column(name = "previous_cutoff", length = 8)
    private String previousCutoff;

    @Column(name = "new_cutoff", nullable = false, length = 8)
    private String newCutoff;

    @Column(name = "reason", nullable = false, columnDefinition = "text")
    private String reason;

    @Column(name = "changed_by", nullable = false, length = 64)
    private String changedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public ProjectCadenceHistoryEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }

    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }

    public String getPreviousFrequency() { return previousFrequency; }
    public void setPreviousFrequency(String previousFrequency) { this.previousFrequency = previousFrequency; }

    public String getNewFrequency() { return newFrequency; }
    public void setNewFrequency(String newFrequency) { this.newFrequency = newFrequency; }

    public Integer getPreviousGrace() { return previousGrace; }
    public void setPreviousGrace(Integer previousGrace) { this.previousGrace = previousGrace; }

    public int getNewGrace() { return newGrace; }
    public void setNewGrace(int newGrace) { this.newGrace = newGrace; }

    public String getPreviousCutoff() { return previousCutoff; }
    public void setPreviousCutoff(String previousCutoff) { this.previousCutoff = previousCutoff; }

    public String getNewCutoff() { return newCutoff; }
    public void setNewCutoff(String newCutoff) { this.newCutoff = newCutoff; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getChangedBy() { return changedBy; }
    public void setChangedBy(String changedBy) { this.changedBy = changedBy; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
