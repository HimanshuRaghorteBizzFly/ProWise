"use client";

import React from "react";
import { useParams } from "next/navigation";
import { OrgGate } from "@/components/org-console/OrgUI";
import { OrgIntegrationsView } from "@/components/flow/GitHubIntegration";

/** Integrations: connect GitHub once for the organization (the Prowise GitHub App); projects then pick a repository. */
export default function Page() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  return <OrgGate family="admin"><OrgIntegrationsView orgId={orgId} family="admin" /></OrgGate>;
}
