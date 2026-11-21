"use client";

import React from "react";
import { useParams } from "next/navigation";

import { ProjectEditView } from "@/components/projects/ApiProjectViews";

/** Edit project (task 2.1, real API; the server decides which projects are readable). */
export default function Page() {
  const params = useParams();
  return <ProjectEditView base="manager" projectId={(params?.projectId as string) ?? ""} />;
}
