"use client";

import React, { useState } from "react";
import {
  CheckInDto,
  DeliveryChecklistItem,
  DeliveryEvidenceItem,
  ProjectDto,
} from "@/types/api";

interface DeliveryAcceptanceModalProps {
  isOpen: boolean;
  project: ProjectDto;
  checkins?: CheckInDto[];
  onClose: () => void;
  onSubmit: (data: {
    bound_checkin_id?: string;
    checklist: DeliveryChecklistItem[];
    evidence_summary?: string;
    evidence_items?: DeliveryEvidenceItem[];
  }) => Promise<void>;
}

const DEFAULT_CHECKLIST: DeliveryChecklistItem[] = [
  { id: "code-complete", label: "Core code implementation complete per specification", checked: true, notes: "Verified" },
  { id: "tests-passing", label: "Automated unit and integration test suite passing green", checked: true, notes: "Verified" },
  { id: "peer-reviewed", label: "Peer review completed & PRs merged to main branch", checked: true, notes: "Verified" },
  { id: "docs-updated", label: "Technical documentation, README, and user notes updated", checked: true, notes: "Verified" },
];

export function DeliveryAcceptanceModal({
  isOpen,
  project,
  checkins = [],
  onClose,
  onSubmit,
}: DeliveryAcceptanceModalProps) {
  const [checklist, setChecklist] = useState<DeliveryChecklistItem[]>(DEFAULT_CHECKLIST);
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [evidenceItems, setEvidenceItems] = useState<DeliveryEvidenceItem[]>([
    { type: "PR", title: "Final Deliverable PR", url: "", reference: "" },
  ]);
  const [boundCheckinId, setBoundCheckinId] = useState<string>(
    () => checkins.find((checkin) => checkin.status === "APPROVED" && checkin.percent >= 100)?.id || ""
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const handleAddEvidenceItem = () => {
    setEvidenceItems((prev) => [...prev, { type: "COMMIT", title: "", url: "", reference: "" }]);
  };

  const handleRemoveEvidenceItem = (idx: number) => {
    setEvidenceItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleEvidenceItemChange = (idx: number, field: keyof DeliveryEvidenceItem, val: string) => {
    setEvidenceItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const allChecked = checklist.every((item) => item.checked);
    if (!allChecked) {
      setError("All checklist items must be checked to request delivery acceptance.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        bound_checkin_id: boundCheckinId || undefined,
        checklist,
        evidence_summary: evidenceSummary.trim() || undefined,
        evidence_items: evidenceItems.filter((item) => (item.url ?? "").trim() !== ""),
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit delivery acceptance request.";
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
              <span className="text-emerald-400">📦</span> Request Delivery Acceptance
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Bound checkin */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Associated 100% Progress Check-in
            </label>
            <select
              value={boundCheckinId}
              onChange={(e) => setBoundCheckinId(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="">-- Select 100% Check-in (Optional) --</option>
              {checkins
                .filter((checkin) => checkin.status === "APPROVED" && checkin.percent >= 100)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.accomplished.slice(0, 40)}... (100% - {new Date(c.submitted_at).toLocaleDateString()})
                  </option>
                ))}
            </select>
          </div>

          {/* Delivery Checklist */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
              Delivery Acceptance Checklist (Mandatory)
            </label>
            <div className="space-y-2.5 bg-zinc-950/50 p-4 rounded-lg border border-zinc-800">
              {checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 cursor-pointer group hover:bg-zinc-900/60 p-2 rounded transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => handleToggleChecklist(item.id)}
                    className="mt-0.5 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500/20 bg-zinc-900 cursor-pointer"
                  />
                  <span className="text-sm text-zinc-200 group-hover:text-white transition-colors">
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Evidence Summary */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Delivery Evidence Summary
            </label>
            <textarea
              rows={3}
              value={evidenceSummary}
              onChange={(e) => setEvidenceSummary(e.target.value)}
              placeholder="Describe the completed scope, PRs merged, deployment status, and test coverage..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Evidence Links */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                GitHub Commits / PR Evidence Links
              </label>
              <button
                type="button"
                onClick={handleAddEvidenceItem}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                + Add Link
              </button>
            </div>

            {evidenceItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center bg-zinc-950 p-2 rounded-lg border border-zinc-800">
                <select
                  value={item.type}
                  onChange={(e) => handleEvidenceItemChange(idx, "type", e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                >
                  <option value="PR">PR</option>
                  <option value="COMMIT">Commit</option>
                  <option value="DOC">Doc</option>
                  <option value="OTHER">Other</option>
                </select>
                <input
                  type="text"
                  placeholder="URL (e.g. https://github.com/.../pull/42)"
                  value={item.url ?? ""}
                  onChange={(e) => handleEvidenceItemChange(idx, "url", e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveEvidenceItem(idx)}
                  className="text-zinc-500 hover:text-red-400 text-xs px-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
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
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-lg shadow-emerald-900/40 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Submitting Request..." : "Submit Acceptance Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
