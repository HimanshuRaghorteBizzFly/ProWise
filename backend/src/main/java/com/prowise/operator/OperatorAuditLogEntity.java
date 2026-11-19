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
@Table(name = "operator_audit_logs")
public class OperatorAuditLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "operator_id", nullable = false, length = 64)
    private String operatorId;

    @Column(name = "actor_name", nullable = false, length = 200)
    private String actorName;

    @Column(name = "action", nullable = false, length = 120)
    private String action;

    @Column(name = "module_key", length = 80)
    private String moduleKey;

    @Column(name = "details", columnDefinition = "TEXT")
    private String details;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt = Instant.now();

    public OperatorAuditLogEntity() {}

    public OperatorAuditLogEntity(String operatorId, String actorName, String action, String moduleKey, String details) {
        this.operatorId = operatorId;
        this.actorName = actorName;
        this.action = action;
        this.moduleKey = moduleKey;
        this.details = details;
        this.occurredAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getOperatorId() {
        return operatorId;
    }

    public String getActorName() {
        return actorName;
    }

    public String getAction() {
        return action;
    }

    public String getModuleKey() {
        return moduleKey;
    }

    public String getDetails() {
        return details;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }
}
