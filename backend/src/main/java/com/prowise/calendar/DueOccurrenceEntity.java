package com.prowise.calendar;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "due_occurrences")
public class DueOccurrenceEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    @Column(name = "kind", nullable = false, length = 20)
    private String kind; // 'CHECKIN' or 'TARGET'

    @Column(name = "due_local_date", nullable = false)
    private LocalDate dueLocalDate;

    @Column(name = "grace_until_date", nullable = false)
    private LocalDate graceUntilDate;

    @Column(name = "zone", nullable = false, length = 64)
    private String zone;

    @Column(name = "cutoff_instant", nullable = false)
    private Instant cutoffInstant;

    @Column(name = "grace_cutoff_instant", nullable = false)
    private Instant graceCutoffInstant;

    @Column(name = "policy_version", nullable = false)
    private Long policyVersion = 0L;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "OPEN"; // 'OPEN', 'MET', 'MISSED', 'EXCUSED', 'SUPERSEDED', 'PAUSED'

    @Column(name = "checkin_id", length = 64)
    private String checkinId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public DueOccurrenceEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }

    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }

    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }

    public LocalDate getDueLocalDate() { return dueLocalDate; }
    public void setDueLocalDate(LocalDate dueLocalDate) { this.dueLocalDate = dueLocalDate; }

    public LocalDate getGraceUntilDate() { return graceUntilDate; }
    public void setGraceUntilDate(LocalDate graceUntilDate) { this.graceUntilDate = graceUntilDate; }

    public String getZone() { return zone; }
    public void setZone(String zone) { this.zone = zone; }

    public Instant getCutoffInstant() { return cutoffInstant; }
    public void setCutoffInstant(Instant cutoffInstant) { this.cutoffInstant = cutoffInstant; }

    public Instant getGraceCutoffInstant() { return graceCutoffInstant; }
    public void setGraceCutoffInstant(Instant graceCutoffInstant) { this.graceCutoffInstant = graceCutoffInstant; }

    public Long getPolicyVersion() { return policyVersion; }
    public void setPolicyVersion(Long policyVersion) { this.policyVersion = policyVersion; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getCheckinId() { return checkinId; }
    public void setCheckinId(String checkinId) { this.checkinId = checkinId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
