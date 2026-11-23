package com.prowise.operator.operations;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "email_delivery_logs")
public class EmailDeliveryLogEntity {

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "recipient", nullable = false, length = 320)
    private String recipient;

    @Column(name = "subject", nullable = false, length = 255)
    private String subject;

    @Column(name = "provider", nullable = false, length = 80)
    private String provider;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "QUEUED";

    @Column(name = "attempts", nullable = false)
    private int attempts = 1;

    @Column(name = "error_code", length = 50)
    private String errorCode;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    /** When the SMTP server accepted the message; null until then and for failures. */
    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    /** Account the email concerns (null for operator emails and older rows). */
    @Column(name = "user_id")
    private UUID userId;

    /** ACCOUNT_SETUP, PASSWORD_RESET, OPERATOR_INVITATION (null for older rows). */
    @Column(name = "email_type", length = 40)
    private String emailType;

    @Column(name = "sender", length = 320)
    private String sender;

    @Column(name = "message_id", length = 998)
    private String messageId;

    /** The SMTP server's own reply (for example "250 2.0.0 OK ... gsmtp"). Never contains credentials. */
    @Column(name = "smtp_response", columnDefinition = "TEXT")
    private String smtpResponse;

    public EmailDeliveryLogEntity() {}

    public String getSender() { return sender; }
    public void setSender(String sender) { this.sender = sender; }
    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }
    public String getSmtpResponse() { return smtpResponse; }
    public void setSmtpResponse(String smtpResponse) { this.smtpResponse = smtpResponse; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getEmailType() { return emailType; }
    public void setEmailType(String emailType) { this.emailType = emailType; }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getRecipient() { return recipient; }
    public void setRecipient(String recipient) { this.recipient = recipient; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int attempts) { this.attempts = attempts; }
    public String getErrorCode() { return errorCode; }
    public void setErrorCode(String errorCode) { this.errorCode = errorCode; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public Instant getSentAt() { return sentAt; }
    public void setSentAt(Instant sentAt) { this.sentAt = sentAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
