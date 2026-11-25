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
    <OrgGate family="admin"><ProgressOverviewView orgId={orgId} roleLabel="Admin" home={`/org/${orgId}/admin`} projectHref={(id) => `/org/${orgId}/admin/projects/${id}`} /></OrgGate>
  );
}
