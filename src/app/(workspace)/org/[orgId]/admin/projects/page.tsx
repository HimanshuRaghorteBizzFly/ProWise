"use client";

import React from "react";

import { OrgGate } from "@/components/org-console/OrgUI";
import { ProjectsPortfolioView } from "@/components/projects/ApiProjectViews";

/** All projects (task 2.1, real API; the server decides which projects are readable). */
export default function Page() {
  return (
    <OrgGate family="admin">
      <ProjectsPortfolioView base="admin" />
    </OrgGate>
  );
}
