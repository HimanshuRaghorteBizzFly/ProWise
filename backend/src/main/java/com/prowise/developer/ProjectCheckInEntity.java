package com.prowise.developer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "project_progress_checkins")
public class ProjectCheckInEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    @Column(name = "author_id", nullable = false, length = 64)
    private String authorId;

    @Column(name = "author_name", length = 150)
    private String authorName;

    @Column(name = "revision_of", length = 64)
    private String revisionOf;

    @Column(name = "revision_seq", nullable = false)
    private Integer revisionSeq = 1;

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

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name = "evidence", columnDefinition = "jsonb")
    private String evidence;

    @Column(name = "downward_reason", columnDefinition = "TEXT")
    private String downwardReason;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "PENDING"; // task 2.2: PENDING, APPROVED, REJECTED (append-only; written by ProgressService)

    @Column(name = "method", nullable = false, length = 40)
    private String method = "developer_reported";

    @Column(name = "verified_by", length = 64)
    private String verifiedBy;

    @Column(name = "review_comment", columnDefinition = "TEXT")
    private String reviewComment;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "idempotency_key", length = 128)
    private String idempotencyKey;

    @Column(name = "captured_at", nullable = false)
    private Instant capturedAt = Instant.now();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Version
    @Column(name = "version", nullable = false)
    private Long version = 0L;

    public ProjectCheckInEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getAuthorId() { return authorId; }
    public void setAuthorId(String authorId) { this.authorId = authorId; }
    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }
    public String getRevisionOf() { return revisionOf; }
    public void setRevisionOf(String revisionOf) { this.revisionOf = revisionOf; }
    public Integer getRevisionSeq() { return revisionSeq; }
    public void setRevisionSeq(Integer revisionSeq) { this.revisionSeq = revisionSeq; }
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
    public String getEvidence() { return evidence; }
    public void setEvidence(String evidence) { this.evidence = evidence; }
    public String getDownwardReason() { return downwardReason; }
    public void setDownwardReason(String downwardReason) { this.downwardReason = downwardReason; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }
    public String getVerifiedBy() { return verifiedBy; }
    public void setVerifiedBy(String verifiedBy) { this.verifiedBy = verifiedBy; }
    public String getReviewComment() { return reviewComment; }
    public void setReviewComment(String reviewComment) { this.reviewComment = reviewComment; }
    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public Instant getCapturedAt() { return capturedAt; }
    public void setCapturedAt(Instant capturedAt) { this.capturedAt = capturedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
