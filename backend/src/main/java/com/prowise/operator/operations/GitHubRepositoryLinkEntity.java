package com.prowise.operator.operations;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "github_repository_links")
public class GitHubRepositoryLinkEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "repo_full_name", nullable = false, length = 150)
    private String repoFullName;

    @Column(name = "installation_id", length = 64)
    private String installationId;

    @Column(name = "default_branch", nullable = false, length = 60)
    private String defaultBranch = "main";

    @Column(name = "webhook_active", nullable = false)
    private boolean webhookActive = true;

    @Column(name = "last_event_at")
    private Instant lastEventAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public GitHubRepositoryLinkEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getRepoFullName() { return repoFullName; }
    public void setRepoFullName(String repoFullName) { this.repoFullName = repoFullName; }
    public String getInstallationId() { return installationId; }
    public void setInstallationId(String installationId) { this.installationId = installationId; }
    public String getDefaultBranch() { return defaultBranch; }
    public void setDefaultBranch(String defaultBranch) { this.defaultBranch = defaultBranch; }
    public boolean isWebhookActive() { return webhookActive; }
    public void setWebhookActive(boolean webhookActive) { this.webhookActive = webhookActive; }
    public Instant getLastEventAt() { return lastEventAt; }
    public void setLastEventAt(Instant lastEventAt) { this.lastEventAt = lastEventAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
