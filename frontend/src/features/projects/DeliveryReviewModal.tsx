"use client";

import React, { useState } from "react";
import {
  AcceptanceRequestDto,
  ProjectBlockerDto,
  ProjectDto,
} from "@/types/api";

interface DeliveryReviewModalProps {
  isOpen: boolean;
  project: ProjectDto;
  request: AcceptanceRequestDto;
  blockers?: ProjectBlockerDto[];
  currentUserId?: string;
  onClose: () => void;
  onDecide: (data: {
    decision: "ACCEPTED" | "REJECTED" | "CHANGES_REQUESTED";
    reason: string;
    expected_project_version: number;
  }) => Promise<void>;
  onWaiveBlocker?: (blockerId: string, reason: string) => Promise<void>;
}

export function DeliveryReviewModal({
  isOpen,
  project,
  request,
  blockers = [],
  currentUserId,
  onClose,
  onDecide,
  onWaiveBlocker,
}: DeliveryReviewModalProps) {
  const [decision, setDecision] = useState<"ACCEPTED" | "REJECTED" | "CHANGES_REQUESTED">("ACCEPTED");
  const [reason, setReason] = useState("");
  const [waiverReason, setWaiverReason] = useState("");
  const [waivingBlockerId, setWaivingBlockerId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isSelfReview = Boolean(currentUserId && currentUserId === request.created_by);

  const openCriticalBlockers = blockers.filter(
    (b) => b.severity === "CRITICAL" && b.status === "OPEN" && !b.waiver
  );

  const hasUnwaivedCritical = openCriticalBlockers.length > 0;

  const handleWaiveSubmit = async (blockerId: string) => {
    if (!onWaiveBlocker || !waiverReason.trim()) return;
    try {
      await onWaiveBlocker(blockerId, waiverReason.trim());
      setWaivingBlockerId(null);
      setWaiverReason("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to waive blocker.";
      setError(msg);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (decision === "ACCEPTED" && hasUnwaivedCritical) {
      setError("Cannot accept delivery while critical blockers remain open without approved waivers.");
      return;
    }

    if (!reason.trim()) {
      setError("A comment or reason is required for the delivery review decision.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onDecide({
        decision,
        reason: reason.trim(),
        expected_project_version: project.version,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record delivery decision.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-blue-400">📋</span> Review Delivery Acceptance
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Project <span className="text-zinc-200 font-semibold">{project.name}</span> ({project.key}) · Submitted by {request.created_by_name ?? request.created_by ?? "Unknown"}
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-950/60 border border-red-800/80 rounded-lg p-3 text-red-200 text-sm">
            {error}
          </div>
        )}

        {isSelfReview && (
          <div className="bg-amber-950/60 border border-amber-800/80 rounded-lg p-3 text-amber-200 text-sm flex items-start gap-2">
            <span>⚠️</span>
            <div>
              <p className="font-semibold">Separation of Duties (Rule D04)</p>
              <p className="text-xs text-amber-300 mt-0.5">
                You cannot verify or approve your own delivery request. Another authorized team lead, project manager, or workspace owner must review it.
              </p>
            </div>
          </div>
        )}

        {/* Unwaived Critical Blockers Warning */}
        {hasUnwaivedCritical && (
          <div className="bg-red-950/40 border border-red-800/80 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
              <span>⛔</span> Critical Blockers Unresolved ({openCriticalBlockers.length})
            </div>
            <p className="text-xs text-zinc-300">
              Delivery acceptance is blocked until all critical blockers are either resolved or granted an authorized waiver with justification.
            </p>
            <div className="space-y-2">
              {openCriticalBlockers.map((b) => (
                <div key={b.id} className="bg-zinc-950 p-3 rounded-lg border border-red-900/50 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-red-400 mr-2">[CRITICAL]</span>
                    <span className="text-sm font-medium text-white">{b.title}</span>
                    {b.description && <p className="text-xs text-zinc-400 mt-0.5">{b.description}</p>}
                  </div>
                  {onWaiveBlocker && (
                    <button
                      type="button"
                      onClick={() => setWaivingBlockerId(b.id)}
                      className="text-xs px-2.5 py-1 bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-600/40 rounded transition-colors font-medium ml-2"
                    >
                      Grant Waiver
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* In-line waiver form */}
            {waivingBlockerId && (
              <div className="bg-zinc-900 border border-amber-700/60 rounded-lg p-3 space-y-2 mt-2">
                <p className="text-xs font-semibold text-amber-300">
                  Approve Waiver for Blocker {openCriticalBlockers.find((b) => b.id === waivingBlockerId)?.title}
                </p>
                <input
                  type="text"
                  placeholder="Mandatory waiver reason (e.g. Postponed to hotfix v1.1 approved by CISO)..."
                  value={waiverReason}
                  onChange={(e) => setWaiverReason(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setWaivingBlockerId(null); setWaiverReason(""); }}
                    className="text-xs text-zinc-400 hover:text-white px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!waiverReason.trim()}
                    onClick={() => handleWaiveSubmit(waivingBlockerId)}
                    className="text-xs px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium disabled:opacity-50"
                  >
                    Confirm Waiver
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submitted Checklist */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Verified Acceptance Checklist
          </label>
          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-2">
            {request.checklist?.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-sm text-zinc-200">
                <span className={item.checked ? "text-emerald-400" : "text-zinc-600"}>
                  {item.checked ? "✓" : "○"}
                </span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Evidence Summary & Links */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Submitted Evidence
          </label>
          {request.evidence_summary && (
            <p className="text-sm text-zinc-300 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
              {request.evidence_summary}
            </p>
          )}
          {request.evidence_items && request.evidence_items.length > 0 && (
            <div className="space-y-1.5">
              {request.evidence_items.map((ev, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-zinc-950 p-2 rounded border border-zinc-800">
                  <span className="font-semibold text-zinc-400 uppercase text-[10px] px-1.5 py-0.5 bg-zinc-800 rounded">
                    {ev.type}
                  </span>
                  {ev.url ? (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline truncate flex-1"
                    >
                      {ev.title ?? ev.url}
                    </a>
                  ) : (
                    <span className="text-zinc-300 truncate flex-1">{ev.title ?? ev.reference ?? "Evidence"}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Review Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-zinc-800">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Decision
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors text-sm font-medium ${
                  decision === "ACCEPTED"
                    ? "bg-emerald-950/40 border-emerald-600 text-emerald-300"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <input
                  type="radio"
                  name="decision"
                  value="ACCEPTED"
                  checked={decision === "ACCEPTED"}
                  onChange={() => setDecision("ACCEPTED")}
                  className="hidden"
                />
                <span>✓ Accept & Deliver</span>
              </label>

              <label
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors text-sm font-medium ${
                  decision === "CHANGES_REQUESTED"
                    ? "bg-amber-950/40 border-amber-600 text-amber-300"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <input
                  type="radio"
                  name="decision"
                  value="CHANGES_REQUESTED"
                  checked={decision === "CHANGES_REQUESTED"}
                  onChange={() => setDecision("CHANGES_REQUESTED")}
                  className="hidden"
                />
                <span>✎ Request Changes</span>
              </label>

              <label
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors text-sm font-medium ${
                  decision === "REJECTED"
                    ? "bg-red-950/40 border-red-600 text-red-300"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                <input
                  type="radio"
                  name="decision"
                  value="REJECTED"
                  checked={decision === "REJECTED"}
                  onChange={() => setDecision("REJECTED")}
                  className="hidden"
                />
                <span>✕ Reject</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Review Comments / Justification (Mandatory)
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide comments on code verification, test passing status, waiver references, or requested changes..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !!isSelfReview || (decision === "ACCEPTED" && hasUnwaivedCritical)}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg shadow-blue-900/40 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Submitting Decision..." : "Submit Review Decision"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
