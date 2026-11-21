package com.prowise.authz;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.Filter;
import org.hibernate.annotations.FilterDef;
import org.hibernate.annotations.ParamDef;

@Entity
@Table(name = "roles")
@FilterDef(name = "tenantFilter", parameters = @ParamDef(name = "orgId", type = UUID.class))
@Filter(name = "tenantFilter", condition = "org_id = :orgId OR is_template = true")
public class RoleEntity extends com.prowise.common.persistence.BaseEntity {

    @Id
    private UUID id;

    @Column(name = "org_id")
    private UUID organizationId;

    private String name;

    @Column(name = "is_template", nullable = false)
    private boolean template;

    protected RoleEntity() {}

    public UUID getId() {
        return id;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public String getName() {
        return name;
    }

    public boolean isTemplate() {
        return template;
    }
}
