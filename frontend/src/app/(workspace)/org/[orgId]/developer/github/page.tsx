"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  GitBranch,
  GitPullRequest,
  GitCommit,
  CheckCircle2,
  Clock,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
} from "lucide-react";
import { developerApi } from "@/lib/developer-api";
import { useProjectStore } from "@/store/project-store";

export default function DeveloperGitHubPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const { gitEvents: storeGitEvents } = useProjectStore();

  const [events, setEvents] = useState<any[]>([]);
  const [repoFilter, setRepoFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const loadActivity = async () => {
    setLoading(true);
    const res = await developerApi.getGitHubActivity();
    if (res && res.length > 0) {
      setEvents(res);
    } else {
      setEvents(storeGitEvents);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeGitEvents]);

  const repositories = [
    { name: "prowise/prowise-backend", defaultBranch: "main", stars: 12, openPRs: 2, status: "Active" },
    { name: "prowise/prowise-frontend", defaultBranch: "main", stars: 8, openPRs: 1, status: "Active" },
    { name: "prowise/fhir-patient-service", defaultBranch: "main", stars: 4, openPRs: 0, status: "Active" },
    { name: "prowise/clinical-decision-engine", defaultBranch: "develop", stars: 15, openPRs: 3, status: "Active" },
  ];

  const filteredEvents = events.filter((evt) => {
    const repo = evt.repositoryName || evt.repo || "";
    const msg = evt.payloadSummary || evt.message || evt.title || "";
    const matchesRepo = repoFilter === "ALL" || repo.includes(repoFilter);
    const matchesSearch =
      repo.toLowerCase().includes(search.toLowerCase()) ||
      msg.toLowerCase().includes(search.toLowerCase());
    return matchesRepo && matchesSearch;
  });

  return (
    <PanelLayout
      title="GitHub Activity & Integrations"
      breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "GitHub Activity" }]}
    >
      <div className="space-y-6">
        {/* Connected Repositories Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-app-text-primary">Connected Repositories</h2>
              <p className="text-xs text-app-text-secondary">
                GitHub organizations and engineering repositories linked to your assigned projects.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadActivity}
              disabled={loading}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Sync Webhooks</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {repositories.map((repo) => (
              <Card key={repo.name} className="p-4 space-y-3 border-l-4 border-l-purple-600">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {repo.defaultBranch}
                  </Badge>
                  <Badge variant="success" className="text-[10px]">
                    {repo.status}
                  </Badge>
                </div>
                <div>
                  <h4 className="font-mono font-bold text-xs text-app-text-primary truncate">
                    {repo.name}
                  </h4>
                  <div className="flex items-center gap-3 text-[11px] text-app-text-muted mt-1.5">
                    <span className="flex items-center gap-1">
                      <GitPullRequest className="w-3 h-3 text-purple-600" /> {repo.openPRs} PRs
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="w-3 h-3" /> CI Passing
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Activity Feed Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-app-text-primary">Live GitHub Event Stream</h3>
              <p className="text-xs text-app-text-secondary">
                Pushes, commits, pull request status checks, and peer review requests.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-app-text-muted" />
                <Input
                  placeholder="Filter commits..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>
              <select
                value={repoFilter}
                onChange={(e) => setRepoFilter(e.target.value)}
                className="rounded-lg border border-app-border bg-app-surface px-2.5 py-1 text-xs text-app-text-primary"
              >
                <option value="ALL">All Repos</option>
                <option value="backend">backend</option>
                <option value="frontend">frontend</option>
                <option value="cds">decision-engine</option>
              </select>
            </div>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="divide-y divide-app-border">
              {filteredEvents.length === 0 ? (
                <div className="py-12 text-center text-xs text-app-text-muted">
                  No GitHub activity recorded matching criteria.
                </div>
              ) : (
                filteredEvents.map((evt) => {
                  const eventType = evt.eventType || evt.type || "PUSH";
                  const repo = evt.repositoryName || evt.repo || "prowise/backend";
                  const msg = evt.payloadSummary || evt.message || evt.title || "Commit and push";
                  const actor = evt.actor || "Developer";

                  return (
                    <div
                      key={evt.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-app-hover transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-app-surface border border-app-border mt-0.5 shrink-0">
                          {eventType === "PULL_REQUEST" || eventType === "PR" ? (
                            <GitPullRequest className="w-4 h-4 text-purple-600" />
                          ) : (
                            <GitCommit className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-app-text-primary">
                              {repo}
                            </span>
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {eventType}
                            </Badge>
                            {evt.ref && (
                              <span className="text-[10px] font-mono text-app-text-muted">
                                {evt.ref}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-app-text-secondary mt-1 font-medium">{msg}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-xs text-app-text-muted sm:text-right">
                        <div>
                          <span className="font-semibold text-app-text-primary block">{actor}</span>
                          <span className="text-[10px]">
                            {new Date(evt.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => window.open("https://github.com", "_blank")}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>
    </PanelLayout>
  );
}
