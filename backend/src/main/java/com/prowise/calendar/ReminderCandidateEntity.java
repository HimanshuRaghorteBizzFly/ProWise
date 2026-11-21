package com.prowise.calendar;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "reminder_candidates")
public class ReminderCandidateEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    @Column(name = "occurrence_id", length = 64)
    private String occurrenceId;

    @Column(name = "recipient_id", nullable = false, length = 64)
    private String recipientId;

    @Column(name = "channel", nullable = false, length = 20)
    private String channel = "EMAIL";

    @Column(name = "condition", nullable = false, length = 32)
    private String condition; // 'UPCOMING_DUE', 'GRACE_WARNING', 'MISSED_CHECKIN', 'OVERDUE_TARGET'

    @Column(name = "scheduled_for", nullable = false)
    private Instant scheduledFor;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "PENDING"; // 'PENDING', 'DISPATCHED', 'CANCELLED', 'INVALIDATED'

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public ReminderCandidateEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }

    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }

    public String getOccurrenceId() { return occurrenceId; }
    public void setOccurrenceId(String occurrenceId) { this.occurrenceId = occurrenceId; }

    public String getRecipientId() { return recipientId; }
    public void setRecipientId(String recipientId) { this.recipientId = recipientId; }

    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }

    public String getCondition() { return condition; }
    public void setCondition(String condition) { this.condition = condition; }

    public Instant getScheduledFor() { return scheduledFor; }
    public void setScheduledFor(Instant scheduledFor) { this.scheduledFor = scheduledFor; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
