"use client";
import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProjects } from "@/hooks/useProjects";

export default function DeveloperProjectRouterPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const { projects } = useProjects(orgId);

  useEffect(() => {
    const project = projects.find(p => p.id === projectId);
    if (project?.mode === "STRUCTURED") {
      router.replace(`/org/${orgId}/developer/projects/${projectId}/structured`);
    } else {
      router.replace(`/org/${orgId}/developer/projects/${projectId}/individual`);
    }
  }, [projects, projectId, orgId, router]);

  return (
    <div className="min-h-[300px] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
