"use client";

import { UserPlus } from "lucide-react";
import { useParams } from "next/navigation";

import { ButtonLink, PageFrame } from "@/components/delivery/DeliveryUI";
import { LiveOrganizationDashboard } from "@/components/org-console/LiveOrganizationDashboard";
import { OrgGate, useOrgHref } from "@/components/org-console/OrgUI";
import { useLiveDashboardData } from "@/lib/live-dashboard-data";

export default function AdminDashboardPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const href = useOrgHref("admin");
  const { status, data, errorMessage, retry } = useLiveDashboardData("admin", orgId);

  return (
    <OrgGate family="admin">
      <PageFrame
        crumbs={[{ label: "Admin", href: href() }, { label: "Dashboard" }]}
        title="Operations overview"
        description="Live membership, team, project, and invitation records."
        badge="Org Admin"
        status={status}
        errorMessage={errorMessage}
        onRetry={retry}
        actions={<ButtonLink href={href("invitations/new")}><UserPlus className="w-3.5 h-3.5" /> Invite member</ButtonLink>}
      >
        {data?.kind === "organization" && <LiveOrganizationDashboard data={data} href={href} />}
      </PageFrame>
    </OrgGate>
  );
}
