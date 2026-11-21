package com.prowise.calendar;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_cadence")
public class ProjectCadenceEntity {

    @Id
    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(name = "frequency", nullable = false, length = 20)
    private String frequency = "WEEKLY";

    @Column(name = "day_of_week", nullable = false, length = 16)
    private String dayOfWeek = "FRIDAY";

    @Column(name = "local_cutoff_time", nullable = false, length = 8)
    private String localCutoffTime = "17:00";

    @Column(name = "grace_working_days", nullable = false)
    private int graceWorkingDays = 1;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "reminder_offsets", nullable = false, columnDefinition = "jsonb")
    private String reminderOffsets = "[3, 1]";

    @Column(name = "policy_version", nullable = false)
    private Long policyVersion = 0L;

    @Column(name = "is_paused", nullable = false)
    private boolean isPaused = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public ProjectCadenceEntity() {}

    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }

    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }

    public String getFrequency() { return frequency; }
    public void setFrequency(String frequency) { this.frequency = frequency; }

    public String getDayOfWeek() { return dayOfWeek; }
    public void setDayOfWeek(String dayOfWeek) { this.dayOfWeek = dayOfWeek; }

    public String getLocalCutoffTime() { return localCutoffTime; }
    public void setLocalCutoffTime(String localCutoffTime) { this.localCutoffTime = localCutoffTime; }

    public int getGraceWorkingDays() { return graceWorkingDays; }
    public void setGraceWorkingDays(int graceWorkingDays) { this.graceWorkingDays = graceWorkingDays; }

    public String getReminderOffsets() { return reminderOffsets; }
    public void setReminderOffsets(String reminderOffsets) { this.reminderOffsets = reminderOffsets; }

    public Long getPolicyVersion() { return policyVersion; }
    public void setPolicyVersion(Long policyVersion) { this.policyVersion = policyVersion; }

    public boolean isPaused() { return isPaused; }
    public void setPaused(boolean paused) { isPaused = paused; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
