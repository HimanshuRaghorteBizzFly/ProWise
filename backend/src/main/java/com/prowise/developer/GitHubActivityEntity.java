package com.prowise.developer;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "github_activity")
public class GitHubActivityEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "repository_name", nullable = false, length = 150)
    private String repositoryName;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType; // "PUSH", "PULL_REQUEST", "REVIEW", "CHECK_RUN", "DEPLOYMENT"

    @Column(name = "actor", nullable = false, length = 100)
    private String actor;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "detail", columnDefinition = "TEXT")
    private String detail;

    @Column(name = "sha", length = 64)
    private String sha;

    @Column(name = "pr_number")
    private Integer prNumber;

    @Column(name = "branch", length = 100)
    private String branch;

    @Column(name = "status", length = 30)
    private String status; // "SUCCESS", "FAILURE", "PENDING", "MERGED", "OPEN"

    @Column(name = "linked_task_key", length = 30)
    private String linkedTaskKey;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public GitHubActivityEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getRepositoryName() { return repositoryName; }
    public void setRepositoryName(String repositoryName) { this.repositoryName = repositoryName; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public String getActor() { return actor; }
    public void setActor(String actor) { this.actor = actor; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
    public String getSha() { return sha; }
    public void setSha(String sha) { this.sha = sha; }
    public Integer getPrNumber() { return prNumber; }
    public void setPrNumber(Integer prNumber) { this.prNumber = prNumber; }
    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getLinkedTaskKey() { return linkedTaskKey; }
    public void setLinkedTaskKey(String linkedTaskKey) { this.linkedTaskKey = linkedTaskKey; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
