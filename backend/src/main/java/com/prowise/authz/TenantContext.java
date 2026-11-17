package com.prowise.authz;

import java.util.UUID;

public final class TenantContext {

    private static final ThreadLocal<UUID> ORGANIZATION = new ThreadLocal<>();

    private TenantContext() {}

    public static void setOrganizationId(UUID organizationId) {
        ORGANIZATION.set(organizationId);
    }

    public static UUID getOrganizationId() {
        return ORGANIZATION.get();
    }

    public static UUID requireOrganizationId() {
        UUID organizationId = ORGANIZATION.get();
        if (organizationId == null) {
            throw new IllegalStateException("Tenant context is required for tenant-scoped access.");
        }
        return organizationId;
    }

    public static void clear() {
        ORGANIZATION.remove();
    }
}
