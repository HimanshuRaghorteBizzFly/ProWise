package com.prowise.developer;

import java.math.BigDecimal;
import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_progress_checkins")
public class ProjectCheckInEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    @Column(name = "author_id", nullable = false, length = 64)
    private String authorId;

    @Column(name = "author_name", length = 150)
    private String authorName;

    @Column(name = "percent", precision = 5, scale = 2, nullable = false)
    private BigDecimal percent;

    @Column(name = "accomplished", nullable = false, columnDefinition = "TEXT")
    private String accomplished;

    @Column(name = "next_steps", nullable = false, columnDefinition = "TEXT")
    private String nextSteps;

    @Column(name = "blockers", columnDefinition = "TEXT")
    private String blockers;

    @Column(name = "projected_finish")
    private Instant projectedFinish;

    @Column(name = "evidence_summary", columnDefinition = "TEXT")
    private String evidenceSummary;

    @Column(name = "downward_reason", columnDefinition = "TEXT")
    private String downwardReason;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "ACCEPTED"; // "PENDING", "ACCEPTED", "REJECTED"

    @Column(name = "verified_by", length = 64)
    private String verifiedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public ProjectCheckInEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getAuthorId() { return authorId; }
    public void setAuthorId(String authorId) { this.authorId = authorId; }
    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }
    public BigDecimal getPercent() { return percent; }
    public void setPercent(BigDecimal percent) { this.percent = percent; }
    public String getAccomplished() { return accomplished; }
    public void setAccomplished(String accomplished) { this.accomplished = accomplished; }
    public String getNextSteps() { return nextSteps; }
    public void setNextSteps(String nextSteps) { this.nextSteps = nextSteps; }
    public String getBlockers() { return blockers; }
    public void setBlockers(String blockers) { this.blockers = blockers; }
    public String getRisks() { return downwardReason; }
    public void setRisks(String risks) { this.downwardReason = risks; }
    public Instant getProjectedFinish() { return projectedFinish; }
    public void setProjectedFinish(Instant projectedFinish) { this.projectedFinish = projectedFinish; }
    public String getEvidenceSummary() { return evidenceSummary; }
    public void setEvidenceSummary(String evidenceSummary) { this.evidenceSummary = evidenceSummary; }
    public String getDownwardReason() { return downwardReason; }
    public void setDownwardReason(String downwardReason) { this.downwardReason = downwardReason; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getVerifiedBy() { return verifiedBy; }
    public void setVerifiedBy(String verifiedBy) { this.verifiedBy = verifiedBy; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
