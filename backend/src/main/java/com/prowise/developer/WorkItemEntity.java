package com.prowise.developer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "work_items")
public class WorkItemEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    @Column(name = "org_id")
    private UUID orgId;

    @Column(name = "parent_id", length = 64)
    private String parentId;

    @Column(name = "type", nullable = false, length = 30)
    private String type = "TASK"; // "MILESTONE", "DELIVERABLE", "TASK", "SUBTASK"

    @Column(name = "key", nullable = false, length = 30)
    private String key;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "primary_assignee_id", length = 64)
    private String primaryAssigneeId;

    @Column(name = "reviewer_id", length = 64)
    private String reviewerId;

    @Column(name = "state", nullable = false, length = 30)
    private String state = "TODO"; // "TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "DONE"

    @Column(name = "is_blocked", nullable = false)
    private boolean blocked = false;

    @Column(name = "weight", precision = 8, scale = 2, nullable = false)
    private BigDecimal weight = BigDecimal.ONE;

    @Column(name = "weight_unit", length = 30)
    private String weightUnit = "pts";

    @Column(name = "criteria", columnDefinition = "TEXT")
    private String criteria;

    @Column(name = "current_revision", nullable = false)
    private int currentRevision = 1;

    @Column(name = "submitted_revision")
    private Integer submittedRevision;

    @Column(name = "due_date")
    private Instant dueDate;

    @Column(name = "start_date")
    private Instant startDate;

    @Column(name = "estimated_hours", precision = 6, scale = 2)
    private BigDecimal estimatedHours;

    @Column(name = "actual_hours", precision = 6, scale = 2)
    private BigDecimal actualHours;

    @Column(name = "priority", length = 20)
    private String priority = "MEDIUM";

    @Column(name = "sprint_id", length = 64)
    private String sprintId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public WorkItemEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }
    public String getParentId() { return parentId; }
    public void setParentId(String parentId) { this.parentId = parentId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getPrimaryAssigneeId() { return primaryAssigneeId; }
    public void setPrimaryAssigneeId(String primaryAssigneeId) { this.primaryAssigneeId = primaryAssigneeId; }
    public String getReviewerId() { return reviewerId; }
    public void setReviewerId(String reviewerId) { this.reviewerId = reviewerId; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public boolean isBlocked() { return blocked; }
    public void setBlocked(boolean blocked) { this.blocked = blocked; }
    public BigDecimal getWeight() { return weight; }
    public void setWeight(BigDecimal weight) { this.weight = weight; }
    public String getWeightUnit() { return weightUnit; }
    public void setWeightUnit(String weightUnit) { this.weightUnit = weightUnit; }
    public String getCriteria() { return criteria; }
    public void setCriteria(String criteria) { this.criteria = criteria; }
    public int getCurrentRevision() { return currentRevision; }
    public void setCurrentRevision(int currentRevision) { this.currentRevision = currentRevision; }
    public Integer getSubmittedRevision() { return submittedRevision; }
    public void setSubmittedRevision(Integer submittedRevision) { this.submittedRevision = submittedRevision; }
    public Instant getDueDate() { return dueDate; }
    public void setDueDate(Instant dueDate) { this.dueDate = dueDate; }
    public Instant getStartDate() { return startDate; }
    public void setStartDate(Instant startDate) { this.startDate = startDate; }
    public BigDecimal getEstimatedHours() { return estimatedHours; }
    public void setEstimatedHours(BigDecimal estimatedHours) { this.estimatedHours = estimatedHours; }
    public BigDecimal getActualHours() { return actualHours; }
    public void setActualHours(BigDecimal actualHours) { this.actualHours = actualHours; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getSprintId() { return sprintId; }
    public void setSprintId(String sprintId) { this.sprintId = sprintId; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
