package com.prowise.superadmin.announcements;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "announcements")
public class AnnouncementEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "message", nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(name = "type", nullable = false, length = 40)
    private String type = "INFO"; // INFO, MAINTENANCE, RELEASE, CRITICAL

    @Column(name = "target_audience", nullable = false, length = 50)
    private String targetAudience = "ALL_ORGS"; // ALL_ORGS, BY_PLAN, SPECIFIC_ORGS, OPERATORS_ONLY

    @Column(name = "target_plans", columnDefinition = "JSONB")
    private String targetPlans = "[]";

    @Column(name = "target_org_ids", columnDefinition = "JSONB")
    private String targetOrgIds = "[]";

    @Column(name = "channels", columnDefinition = "JSONB")
    private String channels = "[\"IN_APP_BANNER\"]";

    @Column(name = "status", nullable = false, length = 30)
    private String status = "DRAFT"; // DRAFT, SCHEDULED, PUBLISHED, ARCHIVED

    @Column(name = "scheduled_for")
    private Instant scheduledFor;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "created_by", nullable = false, length = 200)
    private String createdBy = "Super Admin";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public AnnouncementEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getTargetAudience() { return targetAudience; }
    public void setTargetAudience(String targetAudience) { this.targetAudience = targetAudience; }

    public String getTargetPlans() { return targetPlans; }
    public void setTargetPlans(String targetPlans) { this.targetPlans = targetPlans; }

    public String getTargetOrgIds() { return targetOrgIds; }
    public void setTargetOrgIds(String targetOrgIds) { this.targetOrgIds = targetOrgIds; }

    public String getChannels() { return channels; }
    public void setChannels(String channels) { this.channels = channels; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getScheduledFor() { return scheduledFor; }
    public void setScheduledFor(Instant scheduledFor) { this.scheduledFor = scheduledFor; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public Instant getPublishedAt() { return publishedAt; }
    public void setPublishedAt(Instant publishedAt) { this.publishedAt = publishedAt; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
