"use client";

import React from "react";
import { useParams } from "next/navigation";
import { OrgGate } from "@/components/org-console/OrgUI";
import { ProgressOverviewView } from "@/components/flow/ProgressOverviewView";

/** Approved progress of every project this person can see, labelled with its method (refreshes on focus). */
export default function Page() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  return (
    <OrgGate family="owner"><ProgressOverviewView orgId={orgId} roleLabel="Owner" home={`/org/${orgId}/owner`} projectHref={(id) => `/org/${orgId}/owner/projects/${id}`} /></OrgGate>
  );
}
