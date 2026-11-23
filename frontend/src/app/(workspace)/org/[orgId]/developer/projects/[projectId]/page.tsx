"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { DevGate } from "@/components/developer/DevUI";
import { useDevProject } from "@/components/developer/useDeveloperData";

/** Opens the project's own workspace by its mode (Individual check-ins or Structured work), from the real project record. */
export default function DeveloperProjectRouterPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "";
  const projectId = (params?.projectId as string) || "";
  const project = useDevProject(projectId);
  const mode = project.kind === "ready" ? project.data.mode : null;

  useEffect(() => {
    if (!mode) return;
    router.replace(`/org/${orgId}/developer/projects/${projectId}/${mode === "STRUCTURED" ? "structured" : "individual"}`);
  }, [mode, orgId, projectId, router]);

  return (
    <PanelLayout title="Project" breadcrumb={[{ label: "My Projects", href: `/org/${orgId}/developer/projects` }, { label: "Project" }]}>
      <DevGate state={project} what="This project" back={{ href: `/org/${orgId}/developer/projects`, label: "Back to my projects" }} skeleton="detail">
        {() => <p className="text-xs text-[var(--color-text-muted)]">Opening the project…</p>}
      </DevGate>
    </PanelLayout>
  );
}
