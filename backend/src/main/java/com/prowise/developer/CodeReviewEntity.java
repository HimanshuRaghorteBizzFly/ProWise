package com.prowise.developer;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "code_reviews")
public class CodeReviewEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    @Column(name = "work_item_id", length = 64)
    private String workItemId;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "pr_number")
    private Integer prNumber;

    @Column(name = "pr_url", length = 500)
    private String prUrl;

    @Column(name = "repository_name", length = 150)
    private String repositoryName;

    @Column(name = "branch", length = 100)
    private String branch;

    @Column(name = "author_id", nullable = false, length = 64)
    private String authorId;

    @Column(name = "reviewer_id", nullable = false, length = 64)
    private String reviewerId;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "PENDING"; // "PENDING", "APPROVED", "CHANGES_REQUESTED", "MERGED"

    @Column(name = "inspected_revision")
    private int inspectedRevision = 1;

    @Column(name = "comments_count")
    private int commentsCount = 0;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public CodeReviewEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getWorkItemId() { return workItemId; }
    public void setWorkItemId(String workItemId) { this.workItemId = workItemId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public Integer getPrNumber() { return prNumber; }
    public void setPrNumber(Integer prNumber) { this.prNumber = prNumber; }
    public String getPrUrl() { return prUrl; }
    public void setPrUrl(String prUrl) { this.prUrl = prUrl; }
    public String getRepositoryName() { return repositoryName; }
    public void setRepositoryName(String repositoryName) { this.repositoryName = repositoryName; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public String getAuthorId() { return authorId; }
    public void setAuthorId(String authorId) { this.authorId = authorId; }
    public String getReviewerId() { return reviewerId; }
    public void setReviewerId(String reviewerId) { this.reviewerId = reviewerId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public int getInspectedRevision() { return inspectedRevision; }
    public void setInspectedRevision(int inspectedRevision) { this.inspectedRevision = inspectedRevision; }
    public int getCommentsCount() { return commentsCount; }
    public void setCommentsCount(int commentsCount) { this.commentsCount = commentsCount; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    /** Tenant scope (task 1.3); every query filters by it. */
    @Column(name = "org_id")
    private java.util.UUID orgId;

    public java.util.UUID getOrgId() { return orgId; }
    public void setOrgId(java.util.UUID orgId) { this.orgId = orgId; }
}
