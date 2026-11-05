"use client";
import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useProjects } from "@/hooks/useProjects";

export default function StructuredSubmitReviewPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const { workItems, updateWorkItem } = useProjects(orgId);
  const [evidence, setEvidence] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Submitted for review!");
    router.push(`/org/${orgId}/developer/projects/${projectId}/structured`);
  };

  return (
    <PanelLayout title="Submit for QA Review" breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Structured", href: `/org/${orgId}/developer/projects/${projectId}/structured` }, { label: "Submit Review" }]}>
      <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)] max-w-lg mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="text-base font-semibold">Submit Task Revision for Review</h3>
          <div>
            <label className="text-xs font-medium block mb-1">Artifact / PR Link</label>
            <Input value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="https://github.com/..." required />
          </div>
          <Button type="submit">Submit to QA</Button>
        </form>
      </Card>
    </PanelLayout>
  );
}
