package com.prowise.authz;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;

@Entity
@Table(name = "grants")
@Filter(name = "tenantFilter", condition = "org_id = :orgId")
public class GrantEntity extends com.prowise.common.persistence.BaseEntity {

    @Id
    private UUID id;

    @Column(name = "org_id", nullable = false)
    private UUID organizationId;

    @Column(name = "membership_id", nullable = false)
    private UUID membershipId;

    @Column(name = "template_role_id")
    private UUID templateRoleId;

    @Column(name = "org_role_id")
    private UUID organizationRoleId;

    @Column(nullable = false)
    private String scope;

    @Column(name = "scope_id")
    private UUID scopeId;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "granted_by", nullable = false)
    private UUID grantedBy;

    protected GrantEntity() {}
}
