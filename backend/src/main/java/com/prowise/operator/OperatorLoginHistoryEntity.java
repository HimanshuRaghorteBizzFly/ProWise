package com.prowise.operator;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "operator_login_history")
public class OperatorLoginHistoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "operator_id", length = 64)
    private String operatorId;

    @Column(name = "email", nullable = false, length = 320)
    private String email;

    @Column(name = "status", nullable = false, length = 40)
    private String status; // 'SUCCESS', 'FAILED_INVALID_CREDENTIALS', 'FAILED_INACTIVE', etc.

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;

    @Column(name = "failure_reason", columnDefinition = "TEXT")
    private String failureReason;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt = Instant.now();

    public OperatorLoginHistoryEntity() {}

    public OperatorLoginHistoryEntity(String operatorId, String email, String status, String ipAddress, String userAgent, String failureReason) {
        this.operatorId = operatorId;
        this.email = email;
        this.status = status;
        this.ipAddress = ipAddress;
        this.userAgent = userAgent;
        this.failureReason = failureReason;
        this.occurredAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getOperatorId() { return operatorId; }
    public String getEmail() { return email; }
    public String getStatus() { return status; }
    public String getIpAddress() { return ipAddress; }
    public String getUserAgent() { return userAgent; }
    public String getFailureReason() { return failureReason; }
    public Instant getOccurredAt() { return occurredAt; }
}
