package com.prowise.operator.operations;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "incidents")
public class IncidentEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "severity", nullable = false, length = 20)
    private String severity = "SEV_3";

    @Column(name = "status", nullable = false, length = 30)
    private String status = "INVESTIGATING";

    @Column(name = "department_id", length = 64)
    private String departmentId;

    @Column(name = "assigned_operator_id", length = 64)
    private String assignedOperatorId;

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "root_cause", columnDefinition = "TEXT")
    private String rootCause;

    @Column(name = "mitigation_steps", columnDefinition = "TEXT")
    private String mitigationSteps;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public IncidentEntity() {}

    public IncidentEntity(String id, String title, String severity, String status, String departmentId, String description) {
        this.id = id;
        this.title = title;
        this.severity = severity != null ? severity : "SEV_3";
        this.status = status != null ? status : "INVESTIGATING";
        this.departmentId = departmentId;
        this.description = description;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getDepartmentId() { return departmentId; }
    public void setDepartmentId(String departmentId) { this.departmentId = departmentId; }
    public String getAssignedOperatorId() { return assignedOperatorId; }
    public void setAssignedOperatorId(String assignedOperatorId) { this.assignedOperatorId = assignedOperatorId; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getRootCause() { return rootCause; }
    public void setRootCause(String rootCause) { this.rootCause = rootCause; }
    public String getMitigationSteps() { return mitigationSteps; }
    public void setMitigationSteps(String mitigationSteps) { this.mitigationSteps = mitigationSteps; }
    public Instant getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Instant resolvedAt) { this.resolvedAt = resolvedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
