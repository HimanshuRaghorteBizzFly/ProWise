"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { FolderKanban } from "lucide-react";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { EmptyStateView, PageFrame, SegmentTabs } from "@/components/delivery/DeliveryUI";
import { MyCheckInProjectsView } from "@/components/progress/CheckInViews";
import { DevGate } from "@/components/developer/DevUI";
import { useDevProjects } from "@/components/developer/useDeveloperData";
import { StructuredProgressView } from "@/components/developer/progress/StructuredProgressView";
import { cn } from "@/lib/utils";

type Mode = "INDIVIDUAL" | "STRUCTURED";

/**
 * Progress & Tracker. Individual: self-reported check-ins, which become the project figure only after approval.
 * Structured: the server-calculated figure from accepted work over the approved baseline. Neither is ever derived
 * from tasks, elapsed time or Git activity on this page.
 */
export default function DeveloperProgressPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/developer/dashboard`;
  const back = { href: home, label: "Back to dashboard" };
  const crumbs = [{ label: "Developer", href: home }, { label: "Progress & Tracker" }];
  const [mode, setMode] = useState<Mode>("INDIVIDUAL");

  return (
    <PanelLayout title="Progress & Tracker">
      <div className="space-y-5">
        <SegmentTabs<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "INDIVIDUAL", label: "Individual" },
            { value: "STRUCTURED", label: "Structured" },
          ]}
        />
        {mode === "INDIVIDUAL" ? (
          <div className="space-y-3">
            <p className="text-xs text-[var(--color-text-secondary)]">
              Individual progress is self-reported in check-ins. A check-in becomes the project figure only after it is
              approved; it is never derived from tasks, time or Git activity.
            </p>
            <MyCheckInProjectsView orgId={orgId} crumbs={crumbs} back={back} />
          </div>
        ) : (
          <StructuredSection orgId={orgId} crumbs={crumbs} back={back} />
        )}
      </div>
    </PanelLayout>
  );
}

function StructuredSection({ orgId, crumbs, back }: {
  orgId: string;
  crumbs: { label: string; href?: string }[];
  back: { href: string; label: string };
}) {
  const projects = useDevProjects();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <PageFrame crumbs={crumbs} back={back} title="Structured progress"
      description="Calculated from accepted work and approved baseline weights. A reopened prerequisite suspends credit for dependent work.">
      <DevGate state={projects} what="Projects" back={back}>
        {(all) => {
          const structured = all.filter((p) => p.mode === "STRUCTURED");
          if (structured.length === 0) {
            return <EmptyStateView icon={FolderKanban} title="No Structured projects" description="You are not assigned to a Structured project in this workspace." />;
          }
          const current = structured.find((p) => p.id === selected) ?? structured[0];
          return (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Structured projects">
                {structured.map((p) => (
                  <button key={p.id} type="button" role="tab" aria-selected={p.id === current.id}
                    onClick={() => setSelected(p.id)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                      p.id === current.id
                        ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]",
                    )}>
                    {p.code} · {p.name}
                  </button>
                ))}
              </div>
              <StructuredProgressView key={current.id} orgId={orgId} projectId={current.id} />
            </div>
          );
        }}
      </DevGate>
    </PageFrame>
  );
}
