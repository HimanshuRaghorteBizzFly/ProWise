package com.prowise.superadmin.emailproviders;

import java.time.Instant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

/**
 * Platform SMTP settings (one row, {@link #DEFAULT_ID}). The password is stored only as AES-GCM ciphertext and is
 * never mapped to any response. {@code connectionStatus} is written only by a real connection test.
 */
@Entity
@Table(name = "email_providers")
public class EmailProviderEntity {

    public static final String DEFAULT_ID = "provider-default";

    @Id
    @Column(name = "id", nullable = false, length = 64)
    private String id;

    @Column(name = "provider_type", nullable = false, length = 40)
    private String providerType = "GMAIL";

    @Column(name = "host", nullable = false, length = 255)
    private String host = "smtp.gmail.com";

    @Column(name = "port", nullable = false)
    private Integer port = 587;

    @Column(name = "encryption", nullable = false, length = 20)
    private String encryption = "TLS";

    @Column(name = "username", nullable = false, length = 255)
    private String username = "";

    @Column(name = "password_encrypted", columnDefinition = "TEXT")
    private String passwordEncrypted;

    @Column(name = "password_updated_at")
    private Instant passwordUpdatedAt;

    @Column(name = "from_name", nullable = false, length = 120)
    private String fromName = "ProWise Platform";

    @Column(name = "from_email", nullable = false, length = 320)
    private String fromEmail = "";

    @Column(name = "reply_to_email", nullable = false, length = 320)
    private String replyToEmail = "";

    @Column(name = "rate_limit_per_minute", nullable = false)
    private Integer rateLimitPerMinute = 60;

    @Column(name = "retry_attempts", nullable = false)
    private Integer retryAttempts = 3;

    @Column(name = "retry_backoff_seconds", nullable = false)
    private Integer retryBackoffSeconds = 5;

    @Column(name = "admin_configured", nullable = false)
    private boolean adminConfigured;

    @Column(name = "connection_status", nullable = false, length = 40)
    private String connectionStatus = "NOT_TESTED";

    @Column(name = "last_tested_at")
    private Instant lastTestedAt;

    @Column(name = "last_test_message", columnDefinition = "TEXT")
    private String lastTestMessage;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "updated_by", length = 320)
    private String updatedBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @Version
    @Column(name = "version", nullable = false)
    private long version;

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
    public Instant getPasswordUpdatedAt() { return passwordUpdatedAt; }
    public void setPasswordUpdatedAt(Instant passwordUpdatedAt) { this.passwordUpdatedAt = passwordUpdatedAt; }
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
    public boolean isAdminConfigured() { return adminConfigured; }
    public void setAdminConfigured(boolean adminConfigured) { this.adminConfigured = adminConfigured; }
    public String getConnectionStatus() { return connectionStatus; }
    public void setConnectionStatus(String connectionStatus) { this.connectionStatus = connectionStatus; }
    public Instant getLastTestedAt() { return lastTestedAt; }
    public void setLastTestedAt(Instant lastTestedAt) { this.lastTestedAt = lastTestedAt; }
    public String getLastTestMessage() { return lastTestMessage; }
    public void setLastTestMessage(String lastTestMessage) { this.lastTestMessage = lastTestMessage; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public long getVersion() { return version; }
}
