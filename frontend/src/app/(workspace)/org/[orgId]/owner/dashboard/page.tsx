"use client";

import React from "react";
import { useParams } from "next/navigation";

import { OrgPage } from "@/components/owner/OrgPages";
import { OwnerDashboardView } from "@/components/owner/OwnerDashboardView";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { useFixtureResource } from "@/hooks/useOrgResource";
import { usePermissions } from "@/hooks/usePermissions";
import {
  FIXTURE_AUDIT,
  FIXTURE_INVITATIONS,
  FIXTURE_MEMBERS,
  FIXTURE_PORTFOLIO,
  FIXTURE_REPOSITORIES,
  FIXTURE_TEAMS,
} from "@/lib/fixtures/org-admin";
import { useAuthStore } from "@/store/auth-store";

export default function OwnerDashboardPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const orgName = useAuthStore((state) => state.currentOrg.name);
  const { can, grants, scopeReported, status } = usePermissions();
  const portfolio = useFixtureResource({
    name: "owner-dashboard-projects",
    orgId,
    enabled: can("project.read"),
    fixture: FIXTURE_PORTFOLIO,
  });
  const members = useFixtureResource({
    name: "owner-dashboard-members",
    orgId,
    enabled: can("role.manage"),
    fixture: FIXTURE_MEMBERS,
  });
  const invitations = useFixtureResource({
    name: "owner-dashboard-invitations",
    orgId,
    enabled: can("member.invite"),
    fixture: FIXTURE_INVITATIONS,
  });
  const teams = useFixtureResource({
    name: "owner-dashboard-teams",
    orgId,
    enabled: can("team.manage"),
    fixture: FIXTURE_TEAMS,
  });
  const repositories = useFixtureResource({
    name: "owner-dashboard-repositories",
    orgId,
    enabled: can("repo.read"),
    fixture: FIXTURE_REPOSITORIES,
  });
  const audit = useFixtureResource({
    name: "owner-dashboard-audit",
    orgId,
    enabled: can("audit.read"),
    fixture: FIXTURE_AUDIT,
  });

  const isLoading = status === "loading";
  const projectData = portfolio.state.status === "ready" ? portfolio.state.data : undefined;

  return (
    <OrgPage family="owner" title="Dashboard">
      {isLoading ? (
        <OwnerPageState state="loading" label="Loading organization dashboard" />
      ) : portfolio.state.status === "unavailable" ? (
        <OwnerPageState
          state="empty"
          title="Dashboard data is not connected"
          description="Organization dashboard data is unavailable in this environment. No sample data is shown in production."
        />
      ) : (
        <OwnerDashboardView
          orgId={orgId}
          orgName={orgName}
          projects={projectData?.projects ?? []}
          users={projectData?.users ?? []}
          teams={teams.state.status === "ready" ? teams.state.data : []}
          members={members.state.status === "ready" ? members.state.data : []}
          invitations={invitations.state.status === "ready" ? invitations.state.data : []}
          repositories={repositories.state.status === "ready" ? repositories.state.data : []}
          audit={audit.state.status === "ready" ? audit.state.data : []}
          canViewProjects={can("project.read")}
          basePath={`/org/${orgId}/owner`}
          access={{ grants, scopeReported }}
          dataAsOf={projectData && portfolio.state.status === "ready" ? portfolio.state.loadedAt : undefined}
          can={can}
        />
      )}
    </OrgPage>
  );
}
