"use client";

import React from "react";
import { useParams } from "next/navigation";

import { OrgGate } from "@/components/org-console/OrgUI";
import { ProjectEditView } from "@/components/projects/ApiProjectViews";

/** Edit project (task 2.1, real API; the server decides which projects are readable). */
export default function Page() {
  const params = useParams();
  return (
    <OrgGate family="owner">
      <ProjectEditView base="owner" projectId={(params?.projectId as string) ?? ""} />
    </OrgGate>
  );
}
