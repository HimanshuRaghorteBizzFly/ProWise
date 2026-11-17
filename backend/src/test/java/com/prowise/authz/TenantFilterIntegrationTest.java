package com.prowise.authz;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("T04")
class TenantFilterIntegrationTest {

    @Test
    void tenantContextIsRequiredBeforeTenantScopedAccess() {
        assertThatThrownBy(() -> TenantContext.requireOrganizationId())
                .isInstanceOf(IllegalStateException.class);
    }
}
