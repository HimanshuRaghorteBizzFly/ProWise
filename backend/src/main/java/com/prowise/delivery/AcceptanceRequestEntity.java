package com.prowise.delivery;

import java.time.Instant;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "acceptance_requests")
public class AcceptanceRequestEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    @Column(name = "bound_checkin_id", length = 64)
    private String boundCheckinId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "checklist", nullable = false, columnDefinition = "jsonb")
    private String checklist = "[]";

    @Column(name = "evidence_summary", columnDefinition = "text")
    private String evidenceSummary;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "evidence_items", nullable = false, columnDefinition = "jsonb")
    private String evidenceItems = "[]";

    @Column(name = "status", nullable = false, length = 32)
    private String status = "PENDING"; // 'PENDING', 'ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED'

    @Version
    @Column(name = "version", nullable = false)
    private Long version = 0L;

    @Column(name = "created_by", nullable = false, length = 64)
    private String createdBy;

    @Column(name = "created_by_name", length = 150)
    private String createdByName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public AcceptanceRequestEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }

    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }

    public String getBoundCheckinId() { return boundCheckinId; }
    public void setBoundCheckinId(String boundCheckinId) { this.boundCheckinId = boundCheckinId; }

    public String getChecklist() { return checklist; }
    public void setChecklist(String checklist) { this.checklist = checklist; }

    public String getEvidenceSummary() { return evidenceSummary; }
    public void setEvidenceSummary(String evidenceSummary) { this.evidenceSummary = evidenceSummary; }

    public String getEvidenceItems() { return evidenceItems; }
    public void setEvidenceItems(String evidenceItems) { this.evidenceItems = evidenceItems; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public String getCreatedByName() { return createdByName; }
    public void setCreatedByName(String createdByName) { this.createdByName = createdByName; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
