"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GitPullRequest,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Clock,
  ThumbsUp,
  FileEdit,
  ShieldCheck,
} from "lucide-react";
import { developerApi, DeveloperCodeReview } from "@/lib/developer-api";
import { toast } from "sonner";

export default function DeveloperCodeReviewsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";

  const [reviews, setReviews] = useState<DeveloperCodeReview[]>([]);
  const [activeTab, setActiveTab] = useState<"assigned" | "authored">("assigned");
  const [loading, setLoading] = useState(true);

  // Decision Modal State
  const [selectedReview, setSelectedReview] = useState<DeveloperCodeReview | null>(null);
  const [decision, setDecision] = useState<"APPROVED" | "CHANGES_REQUESTED">("APPROVED");
  const [feedback, setFeedback] = useState("");

  const loadReviews = async () => {
    setLoading(true);
    const res = await developerApi.getReviews(activeTab);
    if (res && res.length > 0) {
      setReviews(res);
    } else {
      // Mock fallback
      const mock: DeveloperCodeReview[] = [
        {
          id: "cr-101",
          projectId: "proj-structured-cds",
          workItemId: "wi-101",
          title: "feat(engine): Implement Drools Rule Engine connector (PR #42)",
          prNumber: 42,
          prUrl: "https://github.com/prowise/decision-engine/pull/42",
          repositoryName: "prowise/decision-engine",
          branch: "feature/engine-connector",
          authorId: "usr-developer-2",
          reviewerId: "usr-developer",
          status: "PENDING",
          createdAt: "2026-11-18T10:00:00Z",
          updatedAt: "2026-11-18T10:00:00Z",
        },
        {
          id: "cr-102",
          projectId: "proj-structured-cds",
          workItemId: "wi-102",
          title: "fix(fhir): Sanitize patient MRN query parameters (PR #43)",
          prNumber: 43,
          prUrl: "https://github.com/prowise/fhir-patient-service/pull/43",
          repositoryName: "prowise/fhir-patient-service",
          branch: "fix/mrn-sanitization",
          authorId: "usr-developer",
          reviewerId: "usr-lead",
          status: "APPROVED",
          createdAt: "2026-11-17T14:30:00Z",
          updatedAt: "2026-11-17T18:00:00Z",
        },
      ];
      setReviews(mock);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSubmitDecision = async () => {
    if (!selectedReview) return;
    const res = await developerApi.submitReviewDecision(selectedReview.id, decision, feedback);
    toast.success(`Review decision submitted: ${decision}`);
    setReviews((prev) =>
      prev.map((r) => (r.id === selectedReview.id ? { ...r, status: decision } : r))
    );
    setSelectedReview(null);
    setFeedback("");
  };

  const displayedReviews = reviews.filter((r) =>
    activeTab === "assigned" ? r.reviewerId === "usr-developer" || true : r.authorId === "usr-developer"
  );

  return (
    <PanelLayout
      title="Code Reviews"
      breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Code Reviews" }]}
    >
      <div className="space-y-6">
        {/* Header & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-app-text-primary">Peer Code Reviews</h2>
            <p className="text-xs text-app-text-secondary mt-0.5">
              Inspect pull requests, provide architecture feedback, and submit delivery approvals.
            </p>
          </div>
          <div className="flex items-center rounded-lg border border-app-border bg-app-surface p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("assigned")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === "assigned"
                  ? "bg-blue-600 text-white"
                  : "text-app-text-secondary hover:text-app-text-primary"
              }`}
            >
              Assigned to Me
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("authored")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === "authored"
                  ? "bg-blue-600 text-white"
                  : "text-app-text-secondary hover:text-app-text-primary"
              }`}
            >
              Authored by Me
            </button>
          </div>
        </div>

        {/* Review Cards List */}
        <div className="space-y-4">
          {displayedReviews.length === 0 ? (
            <Card className="p-12 text-center text-xs text-app-text-muted">
              No code reviews currently awaiting your attention in this queue.
            </Card>
          ) : (
            displayedReviews.map((rev) => (
              <Card
                key={rev.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-subtle transition-shadow"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant={
                        rev.status === "APPROVED"
                          ? "success"
                          : rev.status === "CHANGES_REQUESTED"
                          ? "danger"
                          : rev.status === "MERGED"
                          ? "secondary"
                          : "warning"
                      }
                      className="text-[10px]"
                    >
                      {rev.status}
                    </Badge>
                    <span className="font-mono text-xs font-bold text-blue-600">
                      {rev.repositoryName}
                    </span>
                    <span className="text-[11px] font-mono text-app-text-muted">
                      #{rev.prNumber || "PR"} &bull; {rev.branch}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-app-text-primary">{rev.title}</h4>

                  <div className="flex items-center gap-4 text-xs text-app-text-secondary pt-1">
                    <span>Author: <strong>{rev.authorId}</strong></span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-app-text-muted" />
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  {rev.prUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => window.open(rev.prUrl, "_blank")}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Inspect PR</span>
                    </Button>
                  )}
                  {activeTab === "assigned" && rev.status === "PENDING" && (
                    <Button
                      size="sm"
                      className="text-xs bg-blue-600 hover:bg-blue-700 gap-1"
                      onClick={() => setSelectedReview(rev)}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Submit Decision</span>
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Review Decision Modal */}
        {selectedReview && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-app-surface border border-app-border rounded-xl p-6 w-full max-w-lg shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitPullRequest className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-sm text-app-text-primary">
                    Submit Code Review Decision
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReview(null)}
                  className="text-app-text-muted hover:text-app-text-primary"
                >
                  &times;
                </button>
              </div>

              <div className="p-3 rounded-lg bg-app-bg border border-app-border text-xs space-y-1">
                <p className="font-semibold text-app-text-primary">{selectedReview.title}</p>
                <p className="text-[11px] font-mono text-app-text-muted">{selectedReview.branch}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-app-text-primary block mb-1">
                    Decision
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDecision("APPROVED")}
                      className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        decision === "APPROVED"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                          : "border-app-border bg-app-bg text-app-text-secondary"
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve &amp; Sign-off
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision("CHANGES_REQUESTED")}
                      className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        decision === "CHANGES_REQUESTED"
                          ? "border-amber-500 bg-amber-500/10 text-amber-600"
                          : "border-app-border bg-app-bg text-app-text-secondary"
                      }`}
                    >
                      <AlertCircle className="w-4 h-4" />
                      Request Changes
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-app-text-primary block mb-1">
                    Feedback / Review Notes
                  </label>
                  <textarea
                    rows={4}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Provide constructive feedback, verification notes, or approval summary..."
                    className="w-full rounded-md border border-app-border bg-app-bg p-2 text-xs text-app-text-primary focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedReview(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSubmitDecision}>
                  Submit Sign-off
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PanelLayout>
  );
}
