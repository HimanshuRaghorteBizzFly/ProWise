"use client";

import { FolderPlus, UserPlus, UsersRound } from "lucide-react";
import { useParams } from "next/navigation";

import { ButtonLink, PageFrame } from "@/components/delivery/DeliveryUI";
import { LiveOrganizationDashboard } from "@/components/org-console/LiveOrganizationDashboard";
import { OrgGate, useOrgHref } from "@/components/org-console/OrgUI";
import { useLiveDashboardData } from "@/lib/live-dashboard-data";

export default function OwnerDashboardPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const href = useOrgHref("owner");
  const { status, data, errorMessage, retry } = useLiveDashboardData("owner", orgId);

  return (
    <OrgGate family="owner">
      <PageFrame
        crumbs={[{ label: "Owner", href: href() }, { label: "Dashboard" }]}
        title="Organization overview"
        description="Live membership, team, project, and invitation records."
        badge="Organization Owner"
        status={status}
        errorMessage={errorMessage}
        onRetry={retry}
        actions={
          <>
            <ButtonLink href={href("teams/new")} variant="outline"><UsersRound className="w-3.5 h-3.5" /> New team</ButtonLink>
            <ButtonLink href={href("create-project")} variant="outline"><FolderPlus className="w-3.5 h-3.5" /> New project</ButtonLink>
            <ButtonLink href={href("invitations/new")}><UserPlus className="w-3.5 h-3.5" /> Invite member</ButtonLink>
          </>
        }
      >
        {data?.kind === "organization" && <LiveOrganizationDashboard data={data} href={href} />}
      </PageFrame>
    </OrgGate>
  );
}
