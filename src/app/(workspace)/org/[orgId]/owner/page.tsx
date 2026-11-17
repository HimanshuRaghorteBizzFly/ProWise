"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Users,
  ShieldCheck,
  CreditCard,
  Mail,
  FolderGit2,
  KeyRound,
  AlertTriangle,
  Plus,
  Send,
  Trash2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useProjectStore } from "@/store/project-store";
import { SEEDED_MEMBERSHIPS, SEEDED_USERS, SEEDED_TEAMS, SEEDED_INVITATIONS } from "@/lib/mock-data";
import { SystemRole } from "@/types";
import { toast } from "sonner";

export default function OrganizationOwnerDashboard() {
  const params = useParams();
  const router = useRouter();
  const orgId = (params?.orgId as string) || "org-acme";
  const { currentOrg, currentUser } = useAuthStore();
  const { projects } = useProjectStore();

  const [activeTab, setActiveTab] = useState<"overview" | "members" | "teams" | "transfer" | "settings">("overview");

  // Invitations state
  const [invitations, setInvitations] = useState(SEEDED_INVITATIONS);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SystemRole>("DEVELOPER");

  // Teams state
  const [teams, setTeams] = useState(SEEDED_TEAMS);
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamLeadId, setNewTeamLeadId] = useState("usr-lead");

  // Ownership transfer state
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState("usr-admin");
  const [transferConfirmationText, setTransferConfirmationText] = useState("");

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const newInv = {
      id: `inv-${Date.now()}`,
      orgId,
      email: inviteEmail,
      role: inviteRole,
      token: `inv_tok_${Math.random().toString(36).substring(2, 9)}`,
      expiresAt: "2026-11-20T00:00:00Z",
      status: "PENDING" as const,
      invitedBy: currentUser.id,
    };
    setInvitations([newInv, ...invitations]);
    setIsInviteDialogOpen(false);
    setInviteEmail("");
    toast.success(`Single-use invitation dispatched to ${inviteEmail} with role ${inviteRole}.`);
  };

  const handleRevokeInvite = (id: string) => {
    setInvitations(invitations.map((inv) => (inv.id === id ? { ...inv, status: "REVOKED" } : inv)));
    toast.info("Invitation revoked immediately. Secret token invalidated.");
  };

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    const newTeam = {
      id: `team-${Date.now()}`,
      orgId,
      name: newTeamName,
      leadId: newTeamLeadId,
      memberIds: [newTeamLeadId],
      description: "Custom project delivery squad",
      archived: false,
    };
    setTeams([...teams, newTeam]);
    setIsTeamDialogOpen(false);
    setNewTeamName("");
    toast.success(`Team "${newTeamName}" created with assigned Team Lead.`);
  };

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferConfirmationText !== "TRANSFER") {
      toast.error('You must type "TRANSFER" exactly to confirm.');
      return;
    }

    // Blueprint V1.1 Last-Owner Restriction Check:
    if (selectedNewOwnerId === currentUser.id) {
      toast.error("Ownership Transfer Blocked: You cannot transfer ownership to yourself.");
      return;
    }

    setIsTransferDialogOpen(false);
    toast.success(
      "Ownership transfer initiated. Legal confirmation logged to audit trail."
    );
  };

  return (
    <PanelLayout
      title="Organization Owner Dashboard"
      breadcrumb={[{ label: currentOrg.name }, { label: "Owner Panel" }]}
    >
      <div className="space-y-6">
        {/* Workspace Owner Header Banner */}
        <div className="p-4 rounded-xl bg-app-surface border border-app-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-subtle">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-app-text-primary">{currentOrg.name}</h2>
                <Badge variant="default">{currentOrg.plan} Plan</Badge>
                <Badge variant="success">Active</Badge>
              </div>
              <p className="text-xs text-app-text-secondary mt-0.5">
                Timezone: {currentOrg.timezone} • Workdays: Mon–Fri (8 hrs/day) • Primary Owner: Sarah Chen
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setIsTeamDialogOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> New Team
            </Button>
            <Button size="sm" onClick={() => setIsInviteDialogOpen(true)}>
              <Mail className="w-3.5 h-3.5 mr-1" /> Invite Member
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-app-border space-x-4">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "overview"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Overview &amp; Portfolio ({projects.length})
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "members"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Members &amp; Invitations ({invitations.filter((i) => i.status === "PENDING").length} pending)
          </button>
          <button
            onClick={() => setActiveTab("teams")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "teams"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Teams ({teams.length})
          </button>
          <button
            onClick={() => setActiveTab("transfer")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "transfer"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Ownership Transfer
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === "settings"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-app-text-muted hover:text-app-text-primary"
            }`}
          >
            Calendar &amp; Work Policies
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="text-xs text-app-text-muted">Total Projects</div>
                <div className="text-2xl font-bold text-app-text-primary mt-1">{projects.length}</div>
                <div className="text-[10px] text-green-600 mt-0.5">3 Active Delivery</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-app-text-muted">Active Members</div>
                <div className="text-2xl font-bold text-app-text-primary mt-1">7</div>
                <div className="text-[10px] text-app-text-muted mt-0.5">Across 2 squads</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-app-text-muted">Commercial Plan</div>
                <div className="text-2xl font-bold text-app-text-primary mt-1">Enterprise</div>
                <div className="text-[10px] text-emerald-600 mt-0.5">Renews Nov 2027</div>
              </Card>
              <Card className="p-4">
                <div className="text-xs text-app-text-muted">GitHub Integrations</div>
                <div className="text-2xl font-bold text-app-text-primary mt-1">3 Repos</div>
                <div className="text-[10px] text-green-600 mt-0.5">Webhook Active</div>
              </Card>
            </div>

            {/* Projects Portfolio */}
            <Card className="p-0 overflow-hidden">
              <div className="p-4 border-b border-app-border flex items-center justify-between">
                <div>
                  <CardTitle>Organization Project Portfolio</CardTitle>
                  <CardDescription>
                    All active, delivered, and archived delivery work streams under your tenant.
                  </CardDescription>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Lifecycle</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Target Date</TableHead>
                    <TableHead>Health</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-bold text-blue-600 font-mono text-xs">{p.key}</TableCell>
                      <TableCell className="font-semibold text-xs">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{p.mode}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.lifecycle === "ACTIVE" ? "success" : p.lifecycle === "DELIVERED" ? "info" : "outline"}>
                          {p.lifecycle}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-xs">
                        {p.lastProgressPercent >= 0 ? `${Math.round(p.lastProgressPercent)}%` : "Not Reported"}
                      </TableCell>
                      <TableCell className="text-xs text-app-text-secondary">{p.targetDate}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            p.health === "ON_TRACK"
                              ? "success"
                              : p.health === "DELAYED"
                              ? "danger"
                              : "warning"
                          }
                        >
                          {p.health.replace("_", " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {/* Tab 2: Members & Invitations */}
        {activeTab === "members" && (
          <div className="space-y-6">
            <Card className="p-0 overflow-hidden">
              <div className="p-4 border-b border-app-border flex items-center justify-between">
                <div>
                  <CardTitle>Active Organization Members</CardTitle>
                  <CardDescription>
                    Assigned roles adhere to least privilege. No member can elevate beyond their grant.
                  </CardDescription>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Assigned Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SEEDED_MEMBERSHIPS.map((m) => {
                    const u = SEEDED_USERS.find((usr) => usr.id === m.userId);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-semibold text-xs">{u?.name}</TableCell>
                        <TableCell className="text-xs text-app-text-secondary">{u?.email}</TableCell>
                        <TableCell>
                          <Badge variant="default">{m.role.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="success">{m.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-app-text-muted">
                          {new Date(m.joinedAt || "").toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>

            {/* Pending Invitations */}
            <Card className="p-0 overflow-hidden">
              <div className="p-4 border-b border-app-border flex items-center justify-between">
                <div>
                  <CardTitle>Pending &amp; Historical Invitations</CardTitle>
                  <CardDescription>
                    Expiring single-use invitation tokens. Resending rotates the secret token.
                  </CardDescription>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invitee Email</TableHead>
                    <TableHead>Target Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium text-xs">{inv.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{inv.role.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            inv.status === "PENDING"
                              ? "warning"
                              : inv.status === "ACCEPTED"
                              ? "success"
                              : "danger"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-app-text-muted">{inv.expiresAt}</TableCell>
                      <TableCell className="text-right">
                        {inv.status === "PENDING" && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toast.success(`Secret token re-rotated for ${inv.email}`)}
                            >
                              Resend
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleRevokeInvite(inv.id)}
                            >
                              Revoke
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {/* Tab 3: Teams */}
        {activeTab === "teams" && (
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-app-border flex items-center justify-between">
              <div>
                <CardTitle>Teams &amp; Squads</CardTitle>
                <CardDescription>
                  Team Leads manage sprint work and dependencies within their assigned squads.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setIsTeamDialogOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Team
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t) => {
                  const lead = SEEDED_USERS.find((u) => u.id === t.leadId);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-semibold text-xs">{t.name}</TableCell>
                      <TableCell className="text-xs font-medium text-blue-600">{lead?.name}</TableCell>
                      <TableCell className="text-xs text-app-text-secondary">{t.memberIds.length} members</TableCell>
                      <TableCell className="text-xs text-app-text-muted">{t.description}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Tab 4: Ownership Transfer */}
        {activeTab === "transfer" && (
          <Card className="p-6 max-w-2xl border-red-200 dark:border-red-900/50">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-app-text-primary">
                  Transfer Organization Workspace Ownership
                </h3>
                <p className="text-xs text-app-text-secondary mt-1 leading-relaxed">
                  Under the <strong>Blueprint V1.1 Last-Owner Restriction</strong>, an organization must always possess
                  exactly one active, accountable owner. The owner cannot self-demote without appointing an eligible active member.
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-app-border space-y-3 text-xs">
              <div className="font-semibold text-app-text-primary">Select New Accountable Owner:</div>
              <select
                value={selectedNewOwnerId}
                onChange={(e) => setSelectedNewOwnerId(e.target.value)}
                className="w-full h-9 rounded-lg border border-app-border bg-app-surface px-3 text-xs text-app-text-primary"
              >
                <option value="usr-admin">Marcus Vance (Current Organization Admin)</option>
                <option value="usr-manager">Elena Rostova (Current Project Manager)</option>
              </select>

              <div className="pt-2">
                <Button variant="danger" size="sm" onClick={() => setIsTransferDialogOpen(true)}>
                  Initiate Ownership Handover
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Tab 5: Settings & Calendar */}
        {activeTab === "settings" && (
          <Card className="p-6 max-w-2xl space-y-4">
            <CardTitle className="text-sm">Work Calendar &amp; Timezone Boundaries</CardTitle>
            <CardDescription>
              Deadline cutoffs and overdue triggers are computed using the project&apos;s local timezone and organization workdays.
            </CardDescription>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
              <div className="p-3 rounded-lg border border-app-border bg-app-sidebar/50">
                <span className="text-app-text-muted">Standard Workweek:</span>
                <p className="font-semibold text-app-text-primary mt-1">Monday – Friday</p>
              </div>
              <div className="p-3 rounded-lg border border-app-border bg-app-sidebar/50">
                <span className="text-app-text-muted">Daily Capacity:</span>
                <p className="font-semibold text-app-text-primary mt-1">8.0 hours / day</p>
              </div>
              <div className="p-3 rounded-lg border border-app-border bg-app-sidebar/50">
                <span className="text-app-text-muted">Primary Timezone:</span>
                <p className="font-semibold text-app-text-primary mt-1">America/New_York (IANA)</p>
              </div>
              <div className="p-3 rounded-lg border border-app-border bg-app-sidebar/50">
                <span className="text-app-text-muted">Check-In Grace Period:</span>
                <p className="font-semibold text-app-text-primary mt-1">1 Working Day</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Invite Member Dialog */}
      <Dialog
        isOpen={isInviteDialogOpen}
        onClose={() => setIsInviteDialogOpen(false)}
        title="Invite New Organization Member"
        description="Generates an expiring single-use invite link and notifies the recipient."
      >
        <form onSubmit={handleSendInvite} className="space-y-4 pt-2">
          <Input
            label="Work Email Address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@acmehealth.com"
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-app-text-secondary">
              Assigned Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="flex h-9 w-full rounded-lg border border-app-border bg-app-surface px-3 py-1 text-sm text-app-text-primary"
            >
              <option value="DEVELOPER">Developer (Solo Check-ins &amp; Structured Tasks)</option>
              <option value="TEAM_LEAD">Team Lead (Sprint Coordination &amp; Blockers)</option>
              <option value="PROJECT_MANAGER">Project Manager (Scope Baselines &amp; Delivery)</option>
              <option value="QA_REVIEWER">QA / Reviewer (Acceptance &amp; Verification)</option>
              <option value="VIEWER">Viewer (Read-only Stakeholder)</option>
              <option value="ORGANIZATION_ADMIN">Organization Admin</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Dispatch Invitation</Button>
          </div>
        </form>
      </Dialog>

      {/* Create Team Dialog */}
      <Dialog
        isOpen={isTeamDialogOpen}
        onClose={() => setIsTeamDialogOpen(false)}
        title="Create Engineering Squad / Team"
        description="Squads group team members under an accountable Team Lead."
      >
        <form onSubmit={handleCreateTeam} className="space-y-4 pt-2">
          <Input
            label="Team Name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="e.g. Analytics &amp; Reporting Squad"
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-app-text-secondary">
              Assigned Team Lead
            </label>
            <select
              value={newTeamLeadId}
              onChange={(e) => setNewTeamLeadId(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-app-border bg-app-surface px-3 py-1 text-sm text-app-text-primary"
            >
              <option value="usr-lead">David Kim (Current Team Lead)</option>
              <option value="usr-admin">Marcus Vance (Organization Admin)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsTeamDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Team</Button>
          </div>
        </form>
      </Dialog>

      {/* Transfer Ownership Confirmation Dialog */}
      <Dialog
        isOpen={isTransferDialogOpen}
        onClose={() => setIsTransferDialogOpen(false)}
        title="Confirm Irreversible Ownership Transfer"
        description="This action irrevocably relinquishes your primary Owner authority to the nominated successor."
      >
        <form onSubmit={handleExecuteTransfer} className="space-y-4 pt-2">
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300">
            To proceed, type <strong>TRANSFER</strong> below to certify that you understand this handover.
          </div>

          <Input
            label='Type "TRANSFER" to confirm'
            value={transferConfirmationText}
            onChange={(e) => setTransferConfirmationText(e.target.value)}
            placeholder="TRANSFER"
            required
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button type="button" variant="outline" onClick={() => setIsTransferDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              Confirm Handover
            </Button>
          </div>
        </form>
      </Dialog>
    </PanelLayout>
  );
}

