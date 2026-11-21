package com.prowise.project;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_repository_links")
public class ProjectRepositoryLinkEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(name = "project_id", nullable = false, length = 64)
    private String projectId;

    @Column(name = "repo_name", nullable = false, length = 150)
    private String repoName;

    @Column(name = "default_branch", nullable = false, length = 60)
    private String defaultBranch = "main";

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public ProjectRepositoryLinkEntity() {}

    public ProjectRepositoryLinkEntity(String id, UUID orgId, String projectId, String repoName, String defaultBranch) {
        this.id = id;
        this.orgId = orgId;
        this.projectId = projectId;
        this.repoName = repoName;
        this.defaultBranch = defaultBranch != null ? defaultBranch : "main";
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public UUID getOrgId() { return orgId; }
    public void setOrgId(UUID orgId) { this.orgId = orgId; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getRepoName() { return repoName; }
    public void setRepoName(String repoName) { this.repoName = repoName; }
    public String getDefaultBranch() { return defaultBranch; }
    public void setDefaultBranch(String defaultBranch) { this.defaultBranch = defaultBranch; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
