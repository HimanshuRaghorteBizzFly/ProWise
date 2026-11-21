"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import type { ProjectDto } from "@/types/api";
import { useProjectMembers } from "./useProjectsApi";
import { Plus, Trash2, User, Shield, Briefcase } from "lucide-react";

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
  const { members, isLoading, addMember, removeMember } = useProjectMembers(
    project?.id ?? null,
    orgId
  );

  const [selectedMembershipId, setSelectedMembershipId] = useState("");
  const [role, setRole] = useState("DEVELOPER");
  const [adding, setAdding] = useState(false);

  // Filter out org members who are already added to project
  const availableMembers = orgMembers.filter(
    (om) => !members.some((m) => m.membershipId === om.id || m.userId === om.id)
  );

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMembershipId) return;
    setAdding(true);
    try {
      await addMember({
        membershipId: selectedMembershipId,
        role,
      });
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
      description="Assign workspace members to this project and define their operational roles."
      className="max-w-xl max-h-[85vh] overflow-y-auto"
    >
      <div className="space-y-5 pt-2">
        {/* Add Member Form */}
        <form onSubmit={handleAdd} className="p-3 bg-app-bg border border-app-border rounded-lg space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-app-text-muted">
            Add Workspace Member
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
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

            <div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-xs text-app-text-primary focus:outline-none focus:ring-2 focus:ring-app-accent"
              >
                <option value="DEVELOPER">Developer</option>
                <option value="PROJECT_MANAGER">Project Manager</option>
                <option value="MEMBER">Member</option>
              </select>
            </div>
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
          ) : members.length === 0 ? (
            <div className="py-6 text-center text-xs text-app-text-muted bg-app-bg/50 border border-dashed border-app-border rounded-lg">
              No members assigned yet. Add workspace members using the form above.
            </div>
          ) : (
            <div className="divide-y divide-app-border rounded-lg border border-app-border overflow-hidden">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3 bg-app-surface hover:bg-app-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-medium text-xs">
                      {m.name ? m.name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div>
                      <div className="font-medium text-xs text-app-text-primary flex items-center gap-2">
                        {m.name}
                        {m.role === "PROJECT_MANAGER" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            <Briefcase className="w-2.5 h-2.5" /> PM
                          </span>
                        )}
                        {m.role === "ACCOUNTABLE_DEVELOPER" && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <Shield className="w-2.5 h-2.5" /> Accountable Dev
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-app-text-muted">{m.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-app-text-secondary font-mono capitalize">
                      {m.role.toLowerCase().replace("_", " ")}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemove(m.membershipId)}
                      title="Remove member"
                      className="p-1 rounded text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
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
