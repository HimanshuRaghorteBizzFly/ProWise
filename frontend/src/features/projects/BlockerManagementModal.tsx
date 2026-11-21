"use client";

import React, { useState } from "react";
import { ProjectBlockerDto, ProjectDto } from "@/types/api";

interface BlockerManagementModalProps {
  isOpen: boolean;
  project: ProjectDto;
  blockers: ProjectBlockerDto[];
  canManageBlockers?: boolean;
  onClose: () => void;
  onCreateBlocker: (data: { title: string; description?: string; severity: "NORMAL" | "CRITICAL" }) => Promise<void>;
  onWaiveBlocker: (blockerId: string, reason: string) => Promise<void>;
  onResolveBlocker: (blockerId: string) => Promise<void>;
}

export function BlockerManagementModal({
  isOpen,
  project,
  blockers,
  canManageBlockers = true,
  onClose,
  onCreateBlocker,
  onWaiveBlocker,
  onResolveBlocker,
}: BlockerManagementModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"NORMAL" | "CRITICAL">("NORMAL");
  const [waiverTargetId, setWaiverTargetId] = useState<string | null>(null);
  const [waiverReason, setWaiverReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onCreateBlocker({
        title: title.trim(),
        description: description.trim() || undefined,
        severity,
      });
      setTitle("");
      setDescription("");
      setSeverity("NORMAL");
      setIsCreating(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to report blocker.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWaive = async (blockerId: string) => {
    if (!waiverReason.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onWaiveBlocker(blockerId, waiverReason.trim());
      setWaiverTargetId(null);
      setWaiverReason("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to waive blocker.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async (blockerId: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onResolveBlocker(blockerId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to resolve blocker.");
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
              <span className="text-amber-400">🚧</span> Project Blockers & Waivers
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Project <span className="text-zinc-200 font-semibold">{project.name}</span> ({project.key})
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

        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-400">
            {blockers.length} {blockers.length === 1 ? "blocker" : "blockers"} recorded
          </p>
          {!isCreating && (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors"
            >
              + Report New Blocker
            </button>
          )}
        </div>

        {/* New Blocker Form */}
        {isCreating && (
          <form onSubmit={handleCreate} className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 space-y-3">
            <h3 className="text-sm font-semibold text-white">Report New Blocker</h3>
            <input
              type="text"
              placeholder="Blocker summary / title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white"
              required
            />
            <textarea
              rows={2}
              placeholder="Detailed description of blocker..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs text-white"
            />
            <div className="flex items-center gap-4 text-xs text-zinc-300">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="severity"
                  checked={severity === "NORMAL"}
                  onChange={() => setSeverity("NORMAL")}
                  className="text-zinc-500"
                />
                Normal Severity
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-red-400 font-semibold">
                <input
                  type="radio"
                  name="severity"
                  checked={severity === "CRITICAL"}
                  onChange={() => setSeverity("CRITICAL")}
                  className="text-red-500"
                />
                CRITICAL (Blocks Delivery Acceptance)
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-xs text-zinc-400 hover:text-white px-3 py-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="px-3 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Save Blocker"}
              </button>
            </div>
          </form>
        )}

        {/* Blockers list */}
        <div className="space-y-3">
          {blockers.length === 0 ? (
            <p className="text-xs text-zinc-500 italic text-center py-4">No active or resolved blockers.</p>
          ) : (
            blockers.map((b) => (
              <div
                key={b.id}
                className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 space-y-2 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          b.severity === "CRITICAL"
                            ? "bg-red-950 text-red-400 border border-red-800/60"
                            : "bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        {b.severity}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          b.status === "OPEN"
                            ? "bg-amber-950 text-amber-300 border border-amber-800/60"
                            : b.status === "WAIVED"
                            ? "bg-purple-950 text-purple-300 border border-purple-800/60"
                            : "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                        }`}
                      >
                        {b.status}
                      </span>
                      <span className="text-sm font-semibold text-white">{b.title}</span>
                    </div>
                    {b.description && <p className="text-xs text-zinc-400">{b.description}</p>}
                  </div>

                  {b.status === "OPEN" && canManageBlockers && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleResolve(b.id)}
                        disabled={isSubmitting}
                        className="text-xs px-2.5 py-1 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-600/40 rounded transition-colors font-medium"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => setWaiverTargetId(b.id)}
                        disabled={isSubmitting}
                        className="text-xs px-2.5 py-1 bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-600/40 rounded transition-colors font-medium"
                      >
                        Waive
                      </button>
                    </div>
                  )}
                </div>

                {/* Waiver display */}
                {b.waiver && (
                  <div className="bg-purple-950/30 border border-purple-800/50 rounded p-2 text-xs text-purple-200 mt-2">
                    <p className="font-semibold text-purple-300">
                      Waived by {b.waiver.actor_name || b.waiver.actor_id} on{" "}
                      {new Date(b.waiver.waived_at).toLocaleDateString()}
                    </p>
                    <p className="mt-0.5 text-zinc-300">&ldquo;{b.waiver.reason}&rdquo;</p>
                  </div>
                )}

                {/* Waiver input */}
                {waiverTargetId === b.id && (
                  <div className="bg-zinc-900 border border-amber-700/60 rounded p-3 space-y-2 mt-2">
                    <p className="text-xs font-semibold text-amber-300">Grant Waiver for {b.title}</p>
                    <input
                      type="text"
                      placeholder="Mandatory waiver reason and authorized approval reference..."
                      value={waiverReason}
                      onChange={(e) => setWaiverReason(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1 text-xs text-white"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => { setWaiverTargetId(null); setWaiverReason(""); }}
                        className="text-xs text-zinc-400 hover:text-white px-2 py-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!waiverReason.trim()}
                        onClick={() => handleWaive(b.id)}
                        className="text-xs px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium disabled:opacity-50"
                      >
                        Confirm Waiver
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
