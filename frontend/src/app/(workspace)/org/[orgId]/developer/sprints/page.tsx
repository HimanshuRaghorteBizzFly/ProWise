"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban,
  Clock,
  PlayCircle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowRight,
  Filter,
} from "lucide-react";
import { developerApi, DeveloperSprint, DeveloperWorkItem } from "@/lib/developer-api";
import { useProjectStore } from "@/store/project-store";
import { toast } from "sonner";

export default function DeveloperSprintsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { workItems } = useProjectStore();

  const [sprints, setSprints] = useState<DeveloperSprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>("sprint-1");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    developerApi.getSprints().then((data) => {
      if (mounted) {
        if (data && data.length > 0) {
          setSprints(data);
          setSelectedSprintId(data[0].id);
        } else {
          // Fallback mock sprints
          const sprint1Tasks: DeveloperWorkItem[] = workItems.map((w: any) => ({
            id: w.id,
            projectId: w.projectId,
            type: w.type || "TASK",
            key: w.key,
            title: w.title,
            primaryAssigneeId: w.primaryAssigneeId,
            state: w.state,
            blocked: Boolean(w.isBlocked),
            weight: w.weight || 1,
            currentRevision: w.currentRevision || 1,
            dueDate: w.dueDate,
            priority: (w.criticality || w.priority || "MEDIUM") as any,
            sprintId: "sprint-1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));

          const mockSprints: DeveloperSprint[] = [
            {
              id: "sprint-1",
              projectId: "proj-structured-cds",
              name: "Sprint 42 — Core Engine & Integration",
              goal: "Deliver Rule Execution Engine and HL7 FHIR client connectors with verification tests.",
              status: "ACTIVE",
              startDate: "2026-11-01T00:00:00Z",
              endDate: "2026-11-20T23:59:59Z",
              tasks: sprint1Tasks,
            },
            {
              id: "sprint-2",
              projectId: "proj-structured-cds",
              name: "Sprint 43 — Security & Production Readiness",
              goal: "OAuth2 mTLS token exchange, audit streaming, and zero-downtime deployment pipelines.",
              status: "PLANNED",
              startDate: "2026-11-21T00:00:00Z",
              endDate: "2026-12-05T23:59:59Z",
              tasks: [],
            },
          ];
          setSprints(mockSprints);
          setSelectedSprintId("sprint-1");
        }
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [workItems]);

  const activeSprint = sprints.find((s) => s.id === selectedSprintId) || sprints[0];

  const handleStateChange = async (taskId: string, newState: any) => {
    if (!activeSprint) return;
    const updatedTasks = activeSprint.tasks.map((t) =>
      t.id === taskId ? { ...t, state: newState } : t
    );
    setSprints((prev) =>
      prev.map((s) => (s.id === activeSprint.id ? { ...s, tasks: updatedTasks } : s))
    );
    await developerApi.updateTaskStatus(taskId, newState);
    toast.success(`Task transitioned to ${newState}`);
  };

  const columns: { state: DeveloperWorkItem["state"]; title: string; color: string; icon: any }[] = [
    { state: "TODO", title: "Backlog / To Do", color: "border-slate-400", icon: Clock },
    { state: "IN_PROGRESS", title: "In Progress", color: "border-blue-500", icon: PlayCircle },
    { state: "IN_REVIEW", title: "In Review", color: "border-amber-500", icon: AlertCircle },
    { state: "DONE", title: "Completed", color: "border-emerald-500", icon: CheckCircle2 },
  ];

  return (
    <PanelLayout
      title="Sprint Board"
      breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Sprint Board" }]}
    >
      <div className="space-y-6">
        {/* Sprint Header & Meta */}
        <div className="p-5 rounded-xl bg-app-surface border border-app-border space-y-4 shadow-subtle">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
                <FolderKanban className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-app-text-primary">
                    {activeSprint?.name || "Active Sprint"}
                  </h2>
                  <Badge variant={activeSprint?.status === "ACTIVE" ? "success" : "secondary"}>
                    {activeSprint?.status || "ACTIVE"}
                  </Badge>
                </div>
                <p className="text-xs text-app-text-secondary mt-0.5">
                  {activeSprint?.goal || "Deliver scheduled engineering deliverables."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <select
                value={selectedSprintId}
                onChange={(e) => setSelectedSprintId(e.target.value)}
                className="rounded-lg border border-app-border bg-app-bg px-3 py-1.5 text-xs font-medium text-app-text-primary"
              >
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-app-text-muted pt-2 border-t border-app-border">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              {activeSprint?.startDate ? new Date(activeSprint.startDate).toLocaleDateString() : "TBD"} –{" "}
              {activeSprint?.endDate ? new Date(activeSprint.endDate).toLocaleDateString() : "TBD"}
            </span>
            <span>&bull;</span>
            <span>Total Tasks: {activeSprint?.tasks?.length || 0}</span>
            <span>&bull;</span>
            <span className="text-emerald-600 font-semibold">
              Done: {activeSprint?.tasks?.filter((t) => t.state === "DONE").length || 0}
            </span>
          </div>
        </div>

        {/* Kanban Board Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {columns.map((col) => {
            const items = (activeSprint?.tasks || []).filter((t) => t.state === col.state);
            const Icon = col.icon;

            return (
              <div
                key={col.state}
                className="rounded-xl border border-app-border bg-app-surface flex flex-col min-h-[460px]"
              >
                <div className={`flex items-center justify-between p-3.5 border-b-2 ${col.color}`}>
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-app-text-secondary" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-app-text-primary">
                      {col.title}
                    </h4>
                  </div>
                  <span className="rounded-full bg-app-bg border border-app-border px-2 py-0.5 text-xs font-bold text-app-text-secondary">
                    {items.length}
                  </span>
                </div>

                <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                  {items.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-xs text-app-text-muted border border-dashed border-app-border rounded-lg">
                      No tasks
                    </div>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-app-border bg-app-bg p-3.5 shadow-subtle hover:shadow-md transition-shadow text-xs space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-blue-600">{item.key}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {item.weight} pts
                          </Badge>
                        </div>
                        <h5 className="font-semibold text-app-text-primary line-clamp-2">{item.title}</h5>

                        <div className="flex items-center justify-between text-[11px] text-app-text-muted pt-1 border-t border-app-border">
                          <span>rev {item.currentRevision}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "No deadline"}
                          </span>
                        </div>

                        {/* Transition Buttons */}
                        <div className="pt-2 flex items-center justify-end gap-1.5 border-t border-app-border">
                          {item.state !== "IN_PROGRESS" && item.state !== "DONE" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => handleStateChange(item.id, "IN_PROGRESS")}
                            >
                              Start
                            </Button>
                          )}
                          {item.state === "IN_PROGRESS" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px] text-amber-600"
                              onClick={() => handleStateChange(item.id, "IN_REVIEW")}
                            >
                              Submit Review
                            </Button>
                          )}
                          {item.state !== "DONE" && (
                            <Button
                              size="sm"
                              className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => handleStateChange(item.id, "DONE")}
                            >
                              Done
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PanelLayout>
  );
}
