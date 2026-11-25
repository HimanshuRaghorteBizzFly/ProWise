"use client";

import React from "react";
import { useParams } from "next/navigation";

import { ProgressOverviewView } from "@/components/flow/ProgressOverviewView";

/** Approved progress of every project this person can see, labelled with its method (refreshes on focus). */
export default function Page() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  return (
    <ProgressOverviewView orgId={orgId} roleLabel="Team Lead" home={`/org/${orgId}/lead`} projectHref={null} />
  );
}
