"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FolderGit2,
  Search,
  Filter,
  ArrowRight,
  Clock,
  AlertTriangle,
  FileCheck,
  GitPullRequest,
  Activity,
  Layers,
} from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useDeliveryStore } from "@/store/delivery-store";
import { developerApi, DeveloperProject } from "@/lib/developer-api";

export default function DeveloperProjectsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "org-acme";
  const { projects: storeProjects } = useProjects(orgId);
  const deliveryProjects = useDeliveryStore((s) => s.projects);

  const [projects, setProjects] = useState<DeveloperProject[]>([]);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<"ALL" | "INDIVIDUAL" | "STRUCTURED">("ALL");

  useEffect(() => {
    let mounted = true;
    developerApi.getProjects(orgId).then((data) => {
      if (mounted) {
        const storeMapped: DeveloperProject[] = storeProjects.map((p) => ({
          id: p.id,
          orgId: p.orgId,
          name: p.name,
          code: p.key,
          description: p.description,
          mode: p.mode,
          status: p.lifecycle,
          completionPercent: p.lastProgressPercent >= 0 ? p.lastProgressPercent : 0,
          targetCompletionDate: p.targetDate,
          blockedTasksCount: 0,
          overdueTasksCount: 0,
        }));

        const existingCodes = new Set(storeMapped.map((p) => p.code.toLowerCase()));

        const deliveryMapped: DeveloperProject[] = deliveryProjects
          .filter((p) => !existingCodes.has(p.code.toLowerCase()))
          .map((p) => ({
            id: p.id,
            orgId: orgId,
            name: p.name,
            code: p.code,
            description: p.description,
            mode: p.mode,
            status: p.status === "ACTIVE" ? "ACTIVE" : "PLANNED",
            completionPercent: p.progress || 0,
            targetCompletionDate: p.dueDate,
            blockedTasksCount: 0,
            overdueTasksCount: 0,
          }));

        const combined = [...storeMapped, ...deliveryMapped];
        setProjects(combined);
      }
    });
    return () => {
      mounted = false;
    };
  }, [orgId, storeProjects, deliveryProjects]);

  const filtered = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase());
    const matchesMode = modeFilter === "ALL" || p.mode === modeFilter;
    return matchesSearch && matchesMode;
  });

  return (
    <PanelLayout
      title="My Assigned Projects"
      breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "My Projects" }]}
    >
      <div className="space-y-6">
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-app-text-primary">Assigned Projects</h2>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Live projects assigned to your developer profile across individual check-in and structured baseline modes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-app-text-muted" />
              <Input
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
            <div className="flex items-center rounded-lg border border-app-border p-0.5 bg-app-surface text-xs">
              <button
                type="button"
                onClick={() => setModeFilter("ALL")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  modeFilter === "ALL"
                    ? "bg-blue-600 text-white"
                    : "text-app-text-secondary hover:text-app-text-primary"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setModeFilter("INDIVIDUAL")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  modeFilter === "INDIVIDUAL"
                    ? "bg-blue-600 text-white"
                    : "text-app-text-secondary hover:text-app-text-primary"
                }`}
              >
                Individual
              </button>
              <button
                type="button"
                onClick={() => setModeFilter("STRUCTURED")}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  modeFilter === "STRUCTURED"
                    ? "bg-blue-600 text-white"
                    : "text-app-text-secondary hover:text-app-text-primary"
                }`}
              >
                Structured
              </button>
            </div>
          </div>
        </div>

        {/* Project Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-app-text-muted">
              No assigned projects found matching your criteria.
            </div>
          ) : (
            filtered.map((p) => {
              const percent = Math.min(100, Math.max(0, Number(p.completionPercent) || 0));
              const remaining = 100 - percent;
              const isIndividual = p.mode === "INDIVIDUAL";
              const targetRoute = isIndividual
                ? `/org/${orgId}/developer/projects/${p.id}/individual`
                : `/org/${orgId}/developer/projects/${p.id}/structured`;

              return (
                <Card
                  key={p.id}
                  className={`p-5 flex flex-col justify-between border-t-4 transition-all hover:shadow-md ${
                    isIndividual ? "border-t-blue-500" : "border-t-indigo-500"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-600">{p.code}</span>
                          <Badge variant={isIndividual ? "default" : "secondary"} className="text-[10px]">
                            {p.mode}
                          </Badge>
                        </div>
                        <h3 className="font-bold text-sm text-app-text-primary mt-1">{p.name}</h3>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {p.status || "ACTIVE"}
                      </Badge>
                    </div>

                    <p className="text-xs text-app-text-secondary line-clamp-2">
                      {p.description || "Active engineering deliverable with baseline verification."}
                    </p>

                    {/* Progress Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-app-text-muted">Progress</span>
                        <span className="text-app-text-primary font-bold">{percent}%</span>
                      </div>
                      <div className="w-full bg-app-border rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            isIndividual ? "bg-blue-600" : "bg-indigo-600"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-app-text-muted">
                        <span>{remaining}% remaining</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {p.targetCompletionDate
                            ? new Date(p.targetCompletionDate).toLocaleDateString()
                            : "No target"}
                        </span>
                      </div>
                    </div>

                    {/* Status badges */}
                    <div className="flex items-center gap-2 pt-1">
                      {p.blockedTasksCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-rose-600 font-semibold bg-rose-500/10 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-2.5 h-2.5" /> {p.blockedTasksCount} Blocked
                        </span>
                      )}
                      {p.overdueTasksCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full">
                          <Clock className="w-2.5 h-2.5" /> {p.overdueTasksCount} Overdue
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-app-border flex items-center justify-between gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => router.push(`/org/${orgId}/developer/progress`)}
                    >
                      <Activity className="w-3 h-3 mr-1" />
                      View Progress
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs"
                      onClick={() => router.push(targetRoute)}
                    >
                      <span>{isIndividual ? "Check-in" : "Board"}</span>
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </PanelLayout>
  );
}
