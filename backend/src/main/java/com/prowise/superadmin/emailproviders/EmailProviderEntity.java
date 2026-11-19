package com.prowise.superadmin.emailproviders;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "email_providers")
public class EmailProviderEntity {

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "provider_type", nullable = false, length = 40)
    private String providerType = "SMTP_CUSTOM";

    @Column(name = "host", nullable = false, length = 255)
    private String host = "smtp.sendgrid.net";

    @Column(name = "port", nullable = false)
    private Integer port = 587;

    @Column(name = "encryption", nullable = false, length = 20)
    private String encryption = "TLS";

    @Column(name = "username", nullable = false, length = 255)
    private String username = "apikey";

    @Column(name = "password_encrypted", length = 255)
    private String passwordEncrypted;

    @Column(name = "from_name", nullable = false, length = 120)
    private String fromName = "ProWise Support";

    @Column(name = "from_email", nullable = false, length = 320)
    private String fromEmail = "no-reply@prowise.io";

    @Column(name = "reply_to_email", nullable = false, length = 320)
    private String replyToEmail = "support@prowise.io";

    @Column(name = "rate_limit_per_minute", nullable = false)
    private Integer rateLimitPerMinute = 120;

    @Column(name = "retry_attempts", nullable = false)
    private Integer retryAttempts = 3;

    @Column(name = "retry_backoff_seconds", nullable = false)
    private Integer retryBackoffSeconds = 15;

    @Column(name = "track_opens", nullable = false)
    private Boolean trackOpens = true;

    @Column(name = "track_clicks", nullable = false)
    private Boolean trackClicks = true;

    @Column(name = "sandbox_mode", nullable = false)
    private Boolean sandboxMode = false;

    @Column(name = "connection_status", nullable = false, length = 30)
    private String connectionStatus = "CONNECTED"; // CONNECTED, UNTESTED, FAILED

    @Column(name = "last_tested_at")
    private Instant lastTestedAt;

    @Column(name = "last_test_message", columnDefinition = "TEXT")
    private String lastTestMessage;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public EmailProviderEntity() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getProviderType() { return providerType; }
    public void setProviderType(String providerType) { this.providerType = providerType; }

    public String getHost() { return host; }
    public void setHost(String host) { this.host = host; }

    public Integer getPort() { return port; }
    public void setPort(Integer port) { this.port = port; }

    public String getEncryption() { return encryption; }
    public void setEncryption(String encryption) { this.encryption = encryption; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPasswordEncrypted() { return passwordEncrypted; }
    public void setPasswordEncrypted(String passwordEncrypted) { this.passwordEncrypted = passwordEncrypted; }

    public String getFromName() { return fromName; }
    public void setFromName(String fromName) { this.fromName = fromName; }

    public String getFromEmail() { return fromEmail; }
    public void setFromEmail(String fromEmail) { this.fromEmail = fromEmail; }

    public String getReplyToEmail() { return replyToEmail; }
    public void setReplyToEmail(String replyToEmail) { this.replyToEmail = replyToEmail; }

    public Integer getRateLimitPerMinute() { return rateLimitPerMinute; }
    public void setRateLimitPerMinute(Integer rateLimitPerMinute) { this.rateLimitPerMinute = rateLimitPerMinute; }

    public Integer getRetryAttempts() { return retryAttempts; }
    public void setRetryAttempts(Integer retryAttempts) { this.retryAttempts = retryAttempts; }

    public Integer getRetryBackoffSeconds() { return retryBackoffSeconds; }
    public void setRetryBackoffSeconds(Integer retryBackoffSeconds) { this.retryBackoffSeconds = retryBackoffSeconds; }

    public Boolean getTrackOpens() { return trackOpens; }
    public void setTrackOpens(Boolean trackOpens) { this.trackOpens = trackOpens; }

    public Boolean getTrackClicks() { return trackClicks; }
    public void setTrackClicks(Boolean trackClicks) { this.trackClicks = trackClicks; }

    public Boolean getSandboxMode() { return sandboxMode; }
    public void setSandboxMode(Boolean sandboxMode) { this.sandboxMode = sandboxMode; }

    public String getConnectionStatus() { return connectionStatus; }
    public void setConnectionStatus(String connectionStatus) { this.connectionStatus = connectionStatus; }

    public Instant getLastTestedAt() { return lastTestedAt; }
    public void setLastTestedAt(Instant lastTestedAt) { this.lastTestedAt = lastTestedAt; }

    public String getLastTestMessage() { return lastTestMessage; }
    public void setLastTestMessage(String lastTestMessage) { this.lastTestMessage = lastTestMessage; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
