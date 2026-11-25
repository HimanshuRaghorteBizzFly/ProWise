"use client";

import React from "react";
import { useParams } from "next/navigation";
import { OrgGate } from "@/components/org-console/OrgUI";
import { CreateProjectStart } from "@/components/flow/DraftWizard";

/** Create Project, step 1 (Basics). Saves a private draft; the project exists only after the last step. */
export default function Page() {
  const params = useParams();
  return <OrgGate family="admin"><CreateProjectStart orgId={(params?.orgId as string) || ""} base="admin" /></OrgGate>;
}
