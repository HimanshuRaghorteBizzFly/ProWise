"use client";

import React, { useState } from "react";
import { ProjectDto } from "@/types/api";

interface ProjectClosureModalProps {
  isOpen: boolean;
  project: ProjectDto;
  onClose: () => void;
  onCloseProject: (data: {
    handover_note: string;
    reason: string;
    expected_project_version: number;
  }) => Promise<void>;
}

export function ProjectClosureModal({
  isOpen,
  project,
  onClose,
  onCloseProject,
}: ProjectClosureModalProps) {
  const [handoverNote, setHandoverNote] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!handoverNote.trim()) {
      setError("A handover note is required to close the project.");
      return;
    }

    if (!reason.trim()) {
      setError("A closure reason is required to close the project.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onCloseProject({
        handover_note: handoverNote.trim(),
        reason: reason.trim(),
        expected_project_version: project.version,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to close project.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-purple-400">🔒</span> Close Delivered Project
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Handover Note (Mandatory)
            </label>
            <textarea
              rows={3}
              value={handoverNote}
              onChange={(e) => setHandoverNote(e.target.value)}
              placeholder="Operational handover details, documentation links, deployment status, client sign-off..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Closure Reason (Mandatory)
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for closing (e.g. All contract deliverables accepted by stakeholder)..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-purple-500"
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
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-lg shadow-purple-900/40 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Closing Project..." : "Confirm & Close Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
