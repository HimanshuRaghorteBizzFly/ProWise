"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  AlertTriangle,
  Bug,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Filter,
} from "lucide-react";
import { developerApi, DeveloperBug } from "@/lib/developer-api";
import { toast } from "sonner";

export default function DeveloperBugsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";

  const [bugs, setBugs] = useState<DeveloperBug[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  // New Bug Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("HIGH");
  const [steps, setSteps] = useState("");
  const [environment, setEnvironment] = useState("");

  // Resolve Bug Modal
  const [resolvingBug, setResolvingBug] = useState<DeveloperBug | null>(null);
  const [fixNotes, setFixNotes] = useState("");

  const loadBugs = async () => {
    setLoading(true);
    const res = await developerApi.getBugs();
    if (res && res.length > 0) {
      setBugs(res);
    } else {
      // Mock fallback
      const mock: DeveloperBug[] = [
        {
          id: "bug-1",
          projectId: "proj-structured-cds",
          title: "NullPointerException on null patient observation code",
          description: "When an observation has missing coding array, rule engine throws NPE during fact evaluation.",
          severity: "HIGH",
          status: "OPEN",
          assignedTo: "usr-developer",
          reportedBy: "usr-qa",
          reproductionSteps: "POST /v1/cds/evaluate with observation missing code block.",
          environment: "Staging cluster (k8s)",
          createdAt: "2026-11-18T09:15:00Z",
        },
        {
          id: "bug-2",
          projectId: "proj-individual-solo",
          title: "Memory leak in HL7 v2 parser buffered reader",
          description: "Streams were not closed in try-with-resources block during high throughput benchmark.",
          severity: "MEDIUM",
          status: "RESOLVED",
          assignedTo: "usr-developer",
          reportedBy: "usr-developer",
          fixNotes: "Wrapped StreamReader in AutoCloseable scope.",
          createdAt: "2026-11-16T11:00:00Z",
          resolvedAt: "2026-11-17T16:00:00Z",
        },
      ];
      setBugs(mock);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBugs();
  }, []);

  const handleCreateBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Please provide both title and description.");
      return;
    }

    const payload = {
      projectId: "proj-structured-cds",
      title,
      description,
      severity,
      reproductionSteps: steps,
      environment,
      assignedTo: "usr-developer",
    };

    const res = await developerApi.createBug(payload);
    if (res) {
      setBugs((prev) => [res, ...prev]);
    } else {
      const fallback: DeveloperBug = {
        id: `bug-${Date.now()}`,
        ...payload,
        status: "OPEN",
        createdAt: new Date().toISOString(),
      };
      setBugs((prev) => [fallback, ...prev]);
    }

    toast.success("Bug reported successfully");
    setShowCreateModal(false);
    setTitle("");
    setDescription("");
    setSteps("");
    setEnvironment("");
  };

  const handleResolveBug = async () => {
    if (!resolvingBug) return;
    await developerApi.updateBugStatus(resolvingBug.id, "RESOLVED", fixNotes);
    toast.success(`Bug marked as RESOLVED`);
    setBugs((prev) =>
      prev.map((b) =>
        b.id === resolvingBug.id
          ? { ...b, status: "RESOLVED", fixNotes, resolvedAt: new Date().toISOString() }
          : b
      )
    );
    setResolvingBug(null);
    setFixNotes("");
  };

  const filteredBugs = bugs.filter((b) => {
    const matchesSearch =
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.description.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <PanelLayout
      title="Bugs & Issues"
      breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Bugs & Issues" }]}
    >
      <div className="space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-app-text-primary">Defects &amp; Issue Tracking</h2>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Triage defects, report regressions, and document root-cause fixes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-52">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-app-text-muted" />
              <Input
                placeholder="Search issues..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-app-border bg-app-surface px-2.5 py-1.5 text-xs text-app-text-primary"
            >
              <option value="ALL">All Status</option>
              <option value="OPEN">Open</option>
              <option value="RESOLVED">Resolved</option>
            </select>
            <Button
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Report Bug</span>
            </Button>
          </div>
        </div>

        {/* Bug Table */}
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Title &amp; Root Cause</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBugs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-xs text-app-text-muted">
                    No bugs or defects found in this queue.
                  </TableCell>
                </TableRow>
              ) : (
                filteredBugs.map((bug) => (
                  <TableRow key={bug.id}>
                    <TableCell>
                      <Badge
                        variant={
                          bug.severity === "CRITICAL"
                            ? "danger"
                            : bug.severity === "HIGH"
                            ? "danger"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {bug.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="font-semibold text-xs text-app-text-primary">{bug.title}</div>
                      <div className="text-[11px] text-app-text-secondary truncate mt-0.5">
                        {bug.description}
                      </div>
                      {bug.fixNotes && (
                        <div className="text-[10px] text-emerald-600 font-medium mt-1">
                          Fix: {bug.fixNotes}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={bug.status === "RESOLVED" ? "success" : "warning"} className="text-[10px]">
                        {bug.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-app-text-muted">
                      {bug.environment || "All"}
                    </TableCell>
                    <TableCell className="text-xs text-app-text-secondary">
                      {new Date(bug.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {bug.status !== "RESOLVED" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[11px] h-7 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                          onClick={() => setResolvingBug(bug)}
                        >
                          Resolve
                        </Button>
                      ) : (
                        <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 justify-end">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Report Bug Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-app-surface border border-app-border rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bug className="w-5 h-5 text-rose-600" />
                  <h3 className="font-bold text-sm text-app-text-primary">Report a Defect / Bug</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="text-app-text-muted hover:text-app-text-primary"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateBug} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-medium text-app-text-primary block mb-1">Issue Title</label>
                  <Input
                    required
                    placeholder="e.g. Memory leak in HL7 stream reader..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-app-text-primary block mb-1">Severity</label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as any)}
                      className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical (Blocks Release)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-medium text-app-text-primary block mb-1">Environment</label>
                    <Input
                      placeholder="e.g. Staging, Production, Local"
                      value={environment}
                      onChange={(e) => setEnvironment(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-medium text-app-text-primary block mb-1">Description</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe the bug behavior and impact..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="font-medium text-app-text-primary block mb-1">
                    Reproduction Steps
                  </label>
                  <textarea
                    rows={2}
                    placeholder="1. Send payload... 2. Inspect exception..."
                    value={steps}
                    onChange={(e) => setSteps(e.target.value)}
                    className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-app-border">
                  <Button variant="outline" size="sm" type="button" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" type="submit" className="bg-rose-600 hover:bg-rose-700 text-white">
                    Submit Defect
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Resolve Bug Modal */}
        {resolvingBug && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-app-surface border border-app-border rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-sm text-app-text-primary">Resolve Defect</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setResolvingBug(null)}
                  className="text-app-text-muted hover:text-app-text-primary"
                >
                  &times;
                </button>
              </div>

              <p className="text-xs text-app-text-secondary">
                Document how <strong>{resolvingBug.title}</strong> was resolved.
              </p>

              <div>
                <label className="text-xs font-medium text-app-text-primary block mb-1">
                  Fix Notes / Commit Hash
                </label>
                <textarea
                  rows={3}
                  value={fixNotes}
                  onChange={(e) => setFixNotes(e.target.value)}
                  placeholder="e.g. Wrapped stream in AutoCloseable, merged via PR #44..."
                  className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setResolvingBug(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleResolveBug}
                >
                  Confirm Resolution
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PanelLayout>
  );
}
