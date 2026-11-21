"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { ProjectCreateView } from "@/components/projects/ApiProjectViews";

/** Create project (task 2.1, real API; the server decides which projects are readable). */
export default function Page() {
  return (
    <OrgGate family="admin">
      <ProjectCreateView base="admin" />
    </OrgGate>
  );
}
