"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import type { ProjectDto } from "@/types/api";
import { useProjectMembers } from "./useProjectsApi";
import { Plus, Trash2 } from "lucide-react";

interface OrgMemberOption {
  id: string;
  name: string;
  email: string;
}

interface ProjectMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectDto | null;
  orgMembers: OrgMemberOption[];
  orgId: string;
}

export function ProjectMembersModal({
  isOpen,
  onClose,
  project,
  orgMembers,
  orgId,
}: ProjectMembersModalProps) {
  const { members, isLoading, error, addMember, removeMember } = useProjectMembers(
    project?.id ?? null,
    orgId
  );

  const [selectedMembershipId, setSelectedMembershipId] = useState("");
  const [adding, setAdding] = useState(false);

  // Filter out org members who are already added to project
  const availableMembers = orgMembers.filter(
    (om) => !members.some((member) => member.membership_id === om.id)
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMembershipId) return;
    setAdding(true);
    try {
      await addMember(selectedMembershipId);
      setSelectedMembershipId("");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (membershipId: string) => {
    if (confirm("Are you sure you want to remove this member from the project?")) {
      await removeMember(membershipId);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage Members: ${project?.name ?? ""}`}
      description="Assign workspace members to this project. Project manager and accountable assignments are shown where applicable."
      className="max-w-xl max-h-[85vh] overflow-y-auto"
    >
      <div className="space-y-5 pt-2">
        {/* Add Member Form */}
        <form onSubmit={handleAdd} className="p-3 bg-app-bg border border-app-border rounded-lg space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-app-text-muted">
            Add Workspace Member
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <select
                value={selectedMembershipId}
                onChange={(e) => setSelectedMembershipId(e.target.value)}
                className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-xs text-app-text-primary focus:outline-none focus:ring-2 focus:ring-app-accent"
              >
                <option value="">Select Member...</option>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.email})
                  </option>
                ))}
              </select>
            </div>

            <p className="self-center text-[11px] text-app-text-muted">
              Project membership does not assign organization roles.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={!selectedMembershipId || adding}
              isLoading={adding}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Member
            </Button>
          </div>
        </form>

        {/* Existing Members List */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-app-text-muted mb-2">
            Current Members ({members.length})
          </h4>

          {isLoading ? (
            <div className="py-6 text-center text-xs text-app-text-muted">
              Loading members...
            </div>
          ) : error ? (
            <div role="alert" className="py-4 text-center text-xs text-red-600">
              {error}
            </div>
          ) : members.length === 0 ? (
            <div className="py-6 text-center text-xs text-app-text-muted bg-app-bg/50 border border-dashed border-app-border rounded-lg">
              No members assigned yet. Add workspace members using the form above.
            </div>
          ) : (
            <div className="divide-y divide-app-border rounded-lg border border-app-border overflow-hidden">
              {members.map((m) => (
                (() => {
                  const isProjectManager = project?.project_manager?.membership_id === m.membership_id;
                  const isAccountable = project?.accountable?.membership_id === m.membership_id;
                  const role = isProjectManager && isAccountable
                    ? "Project Manager / Accountable"
                    : isProjectManager
                    ? "Project Manager"
                    : isAccountable
                    ? "Accountable"
                    : "Member";
                  const cannotRemove = isProjectManager || isAccountable;

                  return (
                <div
                  key={m.membership_id}
                  className="flex items-center justify-between p-3 bg-app-surface hover:bg-app-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-medium text-xs">
                      {m.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-xs text-app-text-primary">{m.email}</div>
                      <div className="text-[11px] text-app-text-muted">{m.membership_id}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-app-text-secondary font-mono capitalize">
                      {role}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemove(m.membership_id)}
                      disabled={cannotRemove}
                      title="Remove member"
                      className="p-1 rounded text-red-500 hover:bg-red-500/10 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                  );
                })()
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-app-border">
          <Button type="button" variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
