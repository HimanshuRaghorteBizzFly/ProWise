"use client";

import React from "react";
import { useParams } from "next/navigation";

import { ProjectWorkspaceView } from "@/components/projects/ApiProjectViews";

/** Project workspace (task 2.1, real API; the server decides which projects are readable). */
export default function Page() {
  const params = useParams();
  return <ProjectWorkspaceView base="manager" projectId={(params?.projectId as string) ?? ""} />;
}
