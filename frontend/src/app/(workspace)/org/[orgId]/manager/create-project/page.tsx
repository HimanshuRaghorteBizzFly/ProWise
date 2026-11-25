"use client";

import React from "react";
import { useParams } from "next/navigation";

import { CreateProjectStart } from "@/components/flow/DraftWizard";

/** Create Project, step 1 (Basics). Saves a private draft; the project exists only after the last step. */
export default function Page() {
  const params = useParams();
  return <CreateProjectStart orgId={(params?.orgId as string) || ""} base="manager" />;
}
