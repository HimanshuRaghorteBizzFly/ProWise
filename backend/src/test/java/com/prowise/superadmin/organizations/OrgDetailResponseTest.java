package com.prowise.superadmin.organizations;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import org.junit.jupiter.api.Test;

/** Organization details show what is stored; unknown values stay null instead of invented defaults. */
class OrgDetailResponseTest {

    @Test
    void unknownValuesStayNullInsteadOfInventedDefaults() {
        OrganizationEntity org = new OrganizationEntity(UUID.randomUUID(), "Real Org", "real-org", null);
        org.setSeatsLimit(null);

        SuperAdminOrgDTOs.OrgDetailResponse response = SuperAdminOrgDTOs.OrgDetailResponse.fromEntity(org, 0, 0, 0.0, null);

        assertThat(response.domain()).isNull();
        assertThat(response.industry()).isNull();
        assertThat(response.country()).isNull();
        assertThat(response.ownerName()).isNull();
        assertThat(response.ownerEmail()).isNull();
        assertThat(response.planId()).isNull();
        assertThat(response.seatsLimit()).isNull();
        assertThat(response.mrr()).isNull();
        assertThat(response.name()).isEqualTo("Real Org");
    }
}
