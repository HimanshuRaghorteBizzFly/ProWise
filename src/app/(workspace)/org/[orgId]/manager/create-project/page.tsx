"use client";

import React from "react";

import { ProjectCreateView } from "@/components/projects/ApiProjectViews";

/** Create project (task 2.1, real API: POST /v1/organizations/{orgId}/projects; options come from the server). */
export default function Page() {
  return <ProjectCreateView base="manager" />;
}
