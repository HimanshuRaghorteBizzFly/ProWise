package com.prowise.authz;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;

@Entity
@Table(name = "security_evidence")
@Filter(name = "tenantFilter", condition = "org_id = :orgId")
public class SecurityEvidenceEntity {

    @Id
    private UUID id;

    @Column(name = "org_id", nullable = false)
    private UUID organizationId;

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "target_type", nullable = false)
    private String targetType;

    @Column(name = "target_id")
    private UUID targetId;

    @Column(name = "request_id")
    private String requestId;

    @Column(nullable = false)
    private String reason;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    protected SecurityEvidenceEntity() {}
}
