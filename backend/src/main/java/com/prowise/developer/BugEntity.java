package com.prowise.developer;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "bugs")
public class BugEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    @Column(name = "org_id")
    private UUID orgId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "severity", nullable = false, length = 20)
    private String severity = "HIGH"; // "LOW", "MEDIUM", "HIGH", "CRITICAL"

    @Column(name = "priority", length = 20)
    private String priority = "MEDIUM";

    @Column(name = "status", nullable = false, length = 30)
    private String status = "OPEN"; // "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED"

    @Column(name = "assigned_developer_id", length = 64)
    private String assignedDeveloperId;

    @Column(name = "reported_by", length = 64)
    private String reportedBy;

    @Column(name = "reproduction_steps", columnDefinition = "TEXT")
    private String reproductionSteps;

    @Column(name = "expected_result", columnDefinition = "TEXT")
    private String expectedResult;

    @Column(name = "actual_result", columnDefinition = "TEXT")
    private String actualResult;

    @Column(name = "fix_notes", columnDefinition = "TEXT")
    private String fixNotes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    public BugEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getAssignedDeveloperId() { return assignedDeveloperId; }
    public void setAssignedDeveloperId(String assignedDeveloperId) { this.assignedDeveloperId = assignedDeveloperId; }
    public String getAssignedTo() { return assignedDeveloperId; }
    public void setAssignedTo(String assignedTo) { this.assignedDeveloperId = assignedTo; }
    public String getReportedBy() { return reportedBy; }
    public void setReportedBy(String reportedBy) { this.reportedBy = reportedBy; }
    public String getReproductionSteps() { return reproductionSteps; }
    public void setReproductionSteps(String reproductionSteps) { this.reproductionSteps = reproductionSteps; }
    public String getExpectedResult() { return expectedResult; }
    public void setExpectedResult(String expectedResult) { this.expectedResult = expectedResult; }
    public String getActualResult() { return actualResult; }
    public void setActualResult(String actualResult) { this.actualResult = actualResult; }
    public String getEnvironment() { return actualResult; }
    public void setEnvironment(String environment) { this.actualResult = environment; }
    public String getFixNotes() { return fixNotes; }
    public void setFixNotes(String fixNotes) { this.fixNotes = fixNotes; }
    public String getResolution() { return fixNotes; }
    public void setResolution(String resolution) { this.fixNotes = resolution; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Instant resolvedAt) { this.resolvedAt = resolvedAt; }
}
