"use client";

import React from "react";
import { useParams } from "next/navigation";

import { DraftStepView, type DraftStep } from "@/components/flow/DraftWizard";

/** One step of a Create Project draft (documents, phases and tasks, GitHub, people, approvers, review). */
export default function Page() {
  const params = useParams();
  return <DraftStepView orgId={(params?.orgId as string) || ""} base="manager" draftId={(params?.draftId as string) || ""}
    step={((params?.step as string) || "basics") as DraftStep} />;
}
