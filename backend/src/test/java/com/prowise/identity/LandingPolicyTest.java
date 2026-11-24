package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.prowise.identity.LandingPolicy.Kind;
import com.prowise.identity.LandingPolicy.Landing;
import com.prowise.identity.LandingPolicy.Membership;

@Tag("T06")
class LandingPolicyTest {

    private static final UUID A = UUID.fromString("0a000000-0000-4000-8000-00000000000a");
    private static final UUID B = UUID.fromString("0b000000-0000-4000-8000-00000000000b");

    @Test
    void platformDashboardsOnlyForPlatformAccounts() {
        assertThat(LandingPolicy.resolve("SUPER_ADMIN", List.of(new Membership(A, "ORGANIZATION_OWNER")), A).targetUrl())
                .isEqualTo("/super-admin/dashboard");
        assertThat(LandingPolicy.resolve("platform_operator", List.of(), null).targetUrl())
                .isEqualTo("/platform-operator/dashboard");
        Landing normal = LandingPolicy.resolve(null, List.of(), null);
        assertThat(normal.kind()).isEqualTo(Kind.NO_WORKSPACE);
        assertThat(normal.targetUrl()).isEqualTo("/no-workspace");
        assertThat(normal.role()).isNull();
        assertThat(LandingPolicy.resolve("ORGANIZATION_OWNER", List.of(), null).targetUrl()).isEqualTo("/no-workspace");
    }

    @Test
    void oneWorkspaceLandsByItsMembershipTemplateNotTheGlobalColumn() {
        Landing owner = LandingPolicy.resolve("VIEWER", List.of(new Membership(A, "ORGANIZATION_OWNER")), null);
        assertThat(owner.kind()).isEqualTo(Kind.WORKSPACE);
        assertThat(owner.organizationId()).isEqualTo(A);
        assertThat(owner.role()).isEqualTo("ORGANIZATION_OWNER");
        assertThat(owner.targetUrl()).isEqualTo("/org/" + A + "/owner/dashboard");
        assertThat(LandingPolicy.resolve("ORGANIZATION_OWNER", List.of(new Membership(A, "ORGANIZATION_ADMIN")), null).targetUrl())
                .isEqualTo("/org/" + A + "/admin/dashboard");
    }

    @Test
    void everyTemplateHasItsOwnDashboard() {
        assertThat(LandingPolicy.dashboardFor("PROJECT_MANAGER", A)).endsWith("/manager/dashboard");
        assertThat(LandingPolicy.dashboardFor("TEAM_LEAD", A)).endsWith("/lead/dashboard");
        assertThat(LandingPolicy.dashboardFor("DEVELOPER", A)).endsWith("/developer/dashboard");
        assertThat(LandingPolicy.dashboardFor("QA_REVIEWER", A)).endsWith("/reviewer/dashboard");
        assertThat(LandingPolicy.dashboardFor("VIEWER", A)).endsWith("/viewer/dashboard");
        assertThat(LandingPolicy.dashboardFor("SUPER_ADMIN", A)).endsWith("/viewer/dashboard"); // never a platform page
        assertThat(LandingPolicy.dashboardFor("CUSTOM_ROLE", A)).endsWith("/viewer/dashboard");
    }

    @Test
    void severalWorkspacesGoToThePickerUnlessTheSessionIsBound() {
        List<Membership> two = List.of(new Membership(A, "ORGANIZATION_OWNER"), new Membership(B, "DEVELOPER"));
        Landing picker = LandingPolicy.resolve(null, two, null);
        assertThat(picker.kind()).isEqualTo(Kind.SELECT_WORKSPACE);
        assertThat(picker.organizationId()).isNull();
        assertThat(picker.targetUrl()).isEqualTo("/select-workspace");
        Landing bound = LandingPolicy.resolve(null, two, B);
        assertThat(bound.targetUrl()).isEqualTo("/org/" + B + "/developer/dashboard");
        // A binding to an organization the user is not active in is ignored.
        assertThat(LandingPolicy.resolve(null, two, UUID.randomUUID()).kind()).isEqualTo(Kind.SELECT_WORKSPACE);
    }
}
