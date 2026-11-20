package com.prowise.developer;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "developer_preferences")
public class DeveloperPreferenceEntity {

    @Id
    @Column(name = "user_id", length = 64)
    private String userId;

    @Column(name = "email_notifications")
    private boolean emailNotifications = true;

    @Column(name = "slack_notifications")
    private boolean slackNotifications = false;

    @Column(name = "theme", length = 20)
    private String theme = "system";

    @Column(name = "github_username", length = 100)
    private String githubUsername;

    @Column(name = "timezone", length = 60)
    private String timezone = "America/New_York";

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public DeveloperPreferenceEntity() {}

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public boolean isEmailNotifications() { return emailNotifications; }
    public void setEmailNotifications(boolean emailNotifications) { this.emailNotifications = emailNotifications; }
    public boolean isSlackNotifications() { return slackNotifications; }
    public void setSlackNotifications(boolean slackNotifications) { this.slackNotifications = slackNotifications; }
    public String getTheme() { return theme; }
    public void setTheme(String theme) { this.theme = theme; }
    public String getGithubUsername() { return githubUsername; }
    public void setGithubUsername(String githubUsername) { this.githubUsername = githubUsername; }
    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
