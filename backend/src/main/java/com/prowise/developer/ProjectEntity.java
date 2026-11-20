package com.prowise.developer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "projects")
public class ProjectEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "org_id")
    private UUID orgId;

    @Column(name = "key", nullable = false, length = 20)
    private String key;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "mode", nullable = false, length = 30)
    private String mode = "STRUCTURED"; // "INDIVIDUAL" or "STRUCTURED"

    @Column(name = "lifecycle", nullable = false, length = 30)
    private String lifecycle = "ACTIVE"; // "PLANNED", "ACTIVE", "ON_HOLD", "DELIVERED", "CLOSED", "CANCELLED"

    @Column(name = "priority", nullable = false, length = 20)
    private String priority = "MEDIUM";

    @Column(name = "project_manager_id", length = 64)
    private String projectManagerId;

    @Column(name = "accountable_owner_id", length = 64)
    private String accountableOwnerId;

    @Column(name = "team_ids", columnDefinition = "TEXT")
    private String teamIds;

    @Column(name = "member_ids", columnDefinition = "TEXT")
    private String memberIds;

    @Column(name = "start_date")
    private Instant startDate;

    @Column(name = "target_date")
    private Instant targetDate;

    @Column(name = "timezone", length = 60)
    private String timezone = "America/New_York";

    @Column(name = "last_progress_percent", precision = 5, scale = 2)
    private BigDecimal lastProgressPercent = BigDecimal.ZERO;

    @Column(name = "health", length = 20)
    private String health = "ON_TRACK";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public ProjectEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }
    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }
    public String getCode() { return key; }
    public void setCode(String code) { this.key = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public String getLifecycle() { return lifecycle; }
    public void setLifecycle(String lifecycle) { this.lifecycle = lifecycle; }
    public String getStatus() { return lifecycle; }
    public void setStatus(String status) { this.lifecycle = status; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getProjectManagerId() { return projectManagerId; }
    public void setProjectManagerId(String projectManagerId) { this.projectManagerId = projectManagerId; }
    public String getAccountableOwnerId() { return accountableOwnerId; }
    public void setAccountableOwnerId(String accountableOwnerId) { this.accountableOwnerId = accountableOwnerId; }
    public String getTeamIds() { return teamIds; }
    public void setTeamIds(String teamIds) { this.teamIds = teamIds; }
    public String getMemberIds() { return memberIds; }
    public void setMemberIds(String memberIds) { this.memberIds = memberIds; }
    public Instant getStartDate() { return startDate; }
    public void setStartDate(Instant startDate) { this.startDate = startDate; }
    public Instant getTargetDate() { return targetDate; }
    public void setTargetDate(Instant targetDate) { this.targetDate = targetDate; }
    public Instant getTargetCompletionDate() { return targetDate; }
    public void setTargetCompletionDate(Instant targetDate) { this.targetDate = targetDate; }
    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }
    public BigDecimal getLastProgressPercent() { return lastProgressPercent; }
    public void setLastProgressPercent(BigDecimal lastProgressPercent) { this.lastProgressPercent = lastProgressPercent; }
    public String getHealth() { return health; }
    public void setHealth(String health) { this.health = health; }
    public BigDecimal getTotalWeight() { return BigDecimal.valueOf(100); }
    public BigDecimal getCompletedWeight() { return lastProgressPercent != null ? lastProgressPercent : BigDecimal.ZERO; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
