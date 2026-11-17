package com.prowise.authz;

import java.io.Serializable;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

@Entity
@Table(name = "role_permissions")
@IdClass(RolePermissionEntity.Key.class)
public class RolePermissionEntity {

    @Id
    @Column(name = "role_id")
    private UUID roleId;

    @Id
    @Column(name = "permission_key")
    private String permissionKey;

    protected RolePermissionEntity() {}

    public record Key(UUID roleId, String permissionKey) implements Serializable {}
}
