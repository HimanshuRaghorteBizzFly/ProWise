"use client";

import React from "react";
import { useParams } from "next/navigation";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { AccessMapView } from "@/components/owner/AccessMapView";
import { AuditView } from "@/components/owner/AuditView";
import { HealthRisksView } from "@/components/owner/HealthRisksView";
import { IntegrationsView } from "@/components/owner/IntegrationsView";
import { NotificationsView } from "@/components/owner/NotificationsView";
import { PrivacyView } from "@/components/owner/PrivacyView";
import { ReportsView } from "@/components/owner/ReportsView";
import { InvitationsView } from "@/components/owner/InvitationsView";
import { OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { ProjectsPortfolioView } from "@/components/owner/ProjectsPortfolioView";
import { TeamsView } from "@/components/owner/TeamsView";
import { MembersView } from "@/components/owner/MembersView";
import { OwnerDashboardView } from "@/components/owner/OwnerDashboardView";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { RolesView } from "@/components/owner/RolesView";
import { FAMILY_LABEL, type OrgNavFamily } from "@/components/owner/org-nav";
import { useFixtureResource, useOrgResource, type OrgResourceState } from "@/hooks/useOrgResource";
import { useOwnerDashboard } from "@/hooks/useOwnerDashboard";
import { usePermissions } from "@/hooks/usePermissions";
import { apiClient } from "@/lib/api";
import {
  FIXTURE_AUDIT,
  FIXTURE_INVITATIONS,
  FIXTURE_MEMBERS,
  FIXTURE_NOTIFICATIONS,
  FIXTURE_PORTFOLIO,
  FIXTURE_REPOSITORIES,
  FIXTURE_ROLES,
  FIXTURE_TEAMS,
} from "@/lib/fixtures/org-admin";
import { useAuthStore } from "@/store/auth-store";

interface FamilyProps {
  family: OrgNavFamily;
}

function useFamilyBasePath(family: OrgNavFamily): string | undefined {
  const { orgId } = useParams<{ orgId: string }>();
  return family === "owner" ? `/org/${orgId}/owner` : undefined;
}

/** Shell + breadcrumb for an Owner/Admin page. Renders nothing org-specific if the route org is not active. */
export function OrgPage({ family, title, children }: FamilyProps & { title: string; children: React.ReactNode }) {
  const { orgId } = useParams<{ orgId: string }>();
  const currentOrg = useAuthStore((state) => state.currentOrg);
  const matches = Boolean(orgId && currentOrg.id === orgId);

  return (
    <PanelLayout title={title} breadcrumb={[{ label: currentOrg.name || "Organization" }, { label: FAMILY_LABEL[family] }]}>
      {matches ? (
        children
      ) : (
        <OwnerPageState
          state="access-lost"
          description="The active organization does not match this page. Select an authorized workspace and try again."
          onRetry={() => window.location.reload()}
        />
      )}
    </PanelLayout>
  );
}

function useIsCurrentOwner() {
  const ownerId = useAuthStore((state) => state.currentOrg.ownerId);
  const userId = useAuthStore((state) => state.currentUser.id);
  return Boolean(ownerId && userId && ownerId === userId);
}

/** Shared loading / failure states for org resources. */
function ResourceStates<T>({
  state,
  retry,
  requiredPermission,
  label,
  laterTask,
  children,
}: {
  state: OrgResourceState<T>;
  retry: () => void;
  requiredPermission: string;
  label: string;
  /** Task that delivers the backend, shown when fixtures are not allowed (production). */
  laterTask?: string;
  children: (ready: Extract<OrgResourceState<T>, { status: "ready" }>) => React.ReactNode;
}) {
  switch (state.status) {
    case "ready":
      return <>{children(state)}</>;
    case "unavailable":
      return (
        <div className="space-y-3">
          {laterTask && <OwnerLaterBadge task={laterTask} />}
          <OwnerPageState
            state="empty"
            title={`${label.charAt(0).toUpperCase()}${label.slice(1)} are not available yet`}
            description={`This page needs backend work from task ${laterTask ?? "a later task"}. No sample data is shown in production.`}
          />
        </div>
      );
    case "forbidden":
      return <OwnerPageState state="forbidden" requiredPermission={requiredPermission} description={`The server refused to show ${label}.`} />;
    case "access-lost":
      return <OwnerPageState state="access-lost" onRetry={() => window.location.reload()} />;
    case "unauthenticated":
      return <OwnerPageState state="error" title="Session expired" description="Sign in again to continue." onRetry={() => window.location.reload()} />;
    case "error":
      return <OwnerPageState state="error" title={`Unable to load ${label}`} description="Try again in a moment." onRetry={retry} />;
    default:
      return <OwnerPageState state="loading" label={`Loading ${label}`} />;
  }
}

export function OrgDashboardContent({ family }: FamilyProps) {
  const { orgId } = useParams<{ orgId: string }>();
  const orgName = useAuthStore((state) => state.currentOrg.name);
  const { can, canAny, grants, scopeReported } = usePermissions();
  const canViewProjects = can("project.read");
  const { state, retry } = useOwnerDashboard(canViewProjects ? orgId : "");

  if (!canViewProjects) {
    return (
      <OwnerPageState
        state="forbidden"
        requiredPermission="project.read"
        description="You do not have permission to view this organization's projects."
      />
    );
  }
  if (state.status === "unavailable") {
    return (
      <div className="space-y-3">
        <OwnerLaterBadge task="2.1" />
        <OwnerPageState
          state="empty"
          title="The dashboard is not available yet"
          description="Portfolio data needs the project API (tasks 2.1 and 5.3). No sample data is shown in production."
        />
      </div>
    );
  }
  if (state.status === "loading") return <OwnerPageState state="loading" label="Loading organization dashboard" />;
  if (state.status === "error") {
    return <OwnerPageState state="error" title="Unable to load the dashboard" description={state.message} onRetry={retry} />;
  }
  

  return (
    <OwnerDashboardView
      orgId={orgId}
      orgName={orgName}
      projects={state.projects}
      users={state.users}
      canViewProjects={canViewProjects}
      basePath={`/org/${orgId}/${family}`}
      access={{ grants, scopeReported }}
      dataAsOf={state.loadedAt}
    />
  );
}

export function OrgAccessContent({ family }: FamilyProps) {
  const { grants, source, scopeReported } = usePermissions();
  const isCurrentOwner = useIsCurrentOwner();
  return (
    <AccessMapView family={family} grants={grants} source={source} scopeReported={scopeReported} isCurrentOwner={isCurrentOwner} />
  );
}

export function OrgMembersContent({ family }: FamilyProps) {
  const { orgId } = useParams<{ orgId: string }>();
  const { can } = usePermissions();
  const isCurrentOwner = useIsCurrentOwner();
  const canList = can("role.manage");
  const { state, retry } = useOrgResource({
    name: "members",
    orgId,
    enabled: canList,
    fetch: (id) => apiClient.orgMembers(id),
    fixture: FIXTURE_MEMBERS,
  });

  if (!canList) {
    // The view renders the forbidden state (and the invite action if allowed) without data.
    return <MembersView family={family} orgId={orgId} members={[]} source="api" can={can} isCurrentOwner={isCurrentOwner} />;
  }
  return (
    <ResourceStates state={state} retry={retry} requiredPermission="role.manage" label="members">
      {(ready) => (
        <MembersView family={family} orgId={orgId} members={ready.data} source={ready.source} can={can} isCurrentOwner={isCurrentOwner} />
      )}
    </ResourceStates>
  );
}

export function OrgRolesContent({ family }: FamilyProps) {
  const { orgId } = useParams<{ orgId: string }>();
  const { can, grants } = usePermissions();
  const basePath = useFamilyBasePath(family);
  const canManageRoles = can("role.manage");
  const { state, retry } = useOrgResource({
    name: "roles",
    orgId,
    enabled: canManageRoles,
    fetch: (id) => apiClient.orgRoles(id),
    fixture: () => FIXTURE_ROLES,
  });

  if (!canManageRoles) {
    return <RolesView roles={[]} source="api" canManageRoles={false} heldGrants={grants} basePath={basePath} />;
  }
  return (
    <ResourceStates state={state} retry={retry} requiredPermission="role.manage" label="roles">
      {(ready) => <RolesView roles={ready.data} source={ready.source} canManageRoles heldGrants={grants} basePath={basePath} />}
    </ResourceStates>
  );
}

export function OrgInvitationsContent({ family }: FamilyProps) {
  const { orgId } = useParams<{ orgId: string }>();
  const { can } = usePermissions();
  const basePath = useFamilyBasePath(family);
  const enabled = can("member.invite");
  const { state, retry } = useFixtureResource({ name: "invitations", orgId, enabled, fixture: FIXTURE_INVITATIONS });

  if (!enabled) return <InvitationsView invitations={[]} source="api" can={can} basePath={basePath} />;
  return (
    <ResourceStates state={state} retry={retry} requiredPermission="member.invite" label="invitations" laterTask="1.2">
      {(ready) => <InvitationsView invitations={ready.data} source={ready.source} can={can} basePath={basePath} />}
    </ResourceStates>
  );
}

export function OrgTeamsContent({ family }: FamilyProps) {
  const { orgId } = useParams<{ orgId: string }>();
  const { can } = usePermissions();
  const basePath = useFamilyBasePath(family);
  const enabled = can("team.manage");
  const { state, retry } = useFixtureResource({ name: "teams", orgId, enabled, fixture: FIXTURE_TEAMS });

  if (!enabled) return <TeamsView teams={[]} source="api" can={can} basePath={basePath} />;
  return (
    <ResourceStates state={state} retry={retry} requiredPermission="team.manage" label="teams" laterTask="1.2">
      {(ready) => <TeamsView teams={ready.data} source={ready.source} can={can} basePath={basePath} />}
    </ResourceStates>
  );
}

function usePortfolio(name: string) {
  const { orgId } = useParams<{ orgId: string }>();
  const { can } = usePermissions();
  const enabled = can("project.read");
  const resource = useFixtureResource({ name, orgId, enabled, fixture: FIXTURE_PORTFOLIO });
  return { ...resource, can, enabled };
}

export function OrgProjectsContent({ family }: FamilyProps) {
  const { state, retry, can, enabled } = usePortfolio("projects");
  const basePath = useFamilyBasePath(family);
  if (!enabled) return <ProjectsPortfolioView projects={[]} users={[]} teams={[]} source="api" can={can} basePath={basePath} />;
  return (
    <ResourceStates state={state} retry={retry} requiredPermission="project.read" label="projects" laterTask="2.1">
      {(ready) => <ProjectsPortfolioView {...ready.data} source={ready.source} can={can} basePath={basePath} />}
    </ResourceStates>
  );
}

export function OrgHealthContent({ family }: FamilyProps) {
  const { state, retry, can, enabled } = usePortfolio("health");
  const basePath = useFamilyBasePath(family);
  if (!enabled) return <HealthRisksView projects={[]} users={[]} source="api" can={can} basePath={basePath} />;
  return (
    <ResourceStates state={state} retry={retry} requiredPermission="project.read" label="health records" laterTask="5.1">
      {(ready) => <HealthRisksView projects={ready.data.projects} users={ready.data.users} source={ready.source} can={can} basePath={basePath} />}
    </ResourceStates>
  );
}

export function OrgIntegrationsContent({ family }: FamilyProps) {
  const { orgId } = useParams<{ orgId: string }>();
  const { can } = usePermissions();
  const basePath = useFamilyBasePath(family);
  const enabled = can("repo.read");
  const { state, retry } = useFixtureResource({ name: "integrations", orgId, enabled, fixture: FIXTURE_REPOSITORIES });

  if (!enabled) return <IntegrationsView family={family} repositories={[]} source="api" can={can} basePath={basePath} />;
  return (
    <ResourceStates state={state} retry={retry} requiredPermission="repo.read" label="repositories" laterTask="4.1">
      {(ready) => <IntegrationsView family={family} repositories={ready.data} source={ready.source} can={can} basePath={basePath} />}
    </ResourceStates>
  );
}

export function OrgReportsContent({ family }: FamilyProps) {
  const { state, retry, can, enabled } = usePortfolio("reports");
  const basePath = useFamilyBasePath(family);
  if (!enabled) return <ReportsView projects={[]} source="api" can={can} basePath={basePath} />;
  return (
    <ResourceStates state={state} retry={retry} requiredPermission="project.read" label="reports" laterTask="5.5">
      {(ready) => <ReportsView projects={ready.data.projects} source={ready.source} can={can} basePath={basePath} />}
    </ResourceStates>
  );
}

export function OrgNotificationsContent({ family }: FamilyProps) {
  const { orgId } = useParams<{ orgId: string }>();
  const userId = useAuthStore((state) => state.currentUser.id);
  const basePath = `/org/${orgId}/${family}`;
  // Notifications need only an active membership; the list is filtered to the signed-in member.
  const { state, retry } = useFixtureResource({
    name: "notifications",
    orgId,
    enabled: Boolean(userId),
    fixture: (id) => FIXTURE_NOTIFICATIONS(id, userId, basePath),
  });
  if (!userId) return <OwnerPageState state="access-lost" onRetry={() => window.location.reload()} />;
  return (
    <ResourceStates state={state} retry={retry} requiredPermission="an active membership" label="notifications" laterTask="5.2">
      {(ready) => <NotificationsView notifications={ready.data} source={ready.source} />}
    </ResourceStates>
  );
}

export function OrgAuditContent({ family }: FamilyProps) {
  const { orgId } = useParams<{ orgId: string }>();
  const { can } = usePermissions();
  const basePath = useFamilyBasePath(family);
  const enabled = can("audit.read");
  const { state, retry } = useFixtureResource({ name: "audit", orgId, enabled, fixture: FIXTURE_AUDIT });

  if (!enabled) return <AuditView records={[]} source="api" can={can} basePath={basePath} />;
  return (
    <ResourceStates state={state} retry={retry} requiredPermission="audit.read" label="audit records" laterTask="1.4">
      {(ready) => <AuditView records={ready.data} source={ready.source} can={can} basePath={basePath} />}
    </ResourceStates>
  );
}

export function OrgPrivacyContent() {
  const { can } = usePermissions();
  return <PrivacyView can={can} />;
}
