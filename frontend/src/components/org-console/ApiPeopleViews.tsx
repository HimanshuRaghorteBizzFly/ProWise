"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  ArrowRightLeft,
  CheckCircle2,
  Crown,
  Mail,
  Plus,
  Send,
  ShieldAlert,
  UserCheck,
  UserPlus,
  UsersRound,
  UserX,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { usePermissions } from "@/hooks/usePermissions";
import { isStaleVersion, type ApiError } from "@/lib/api";
import type { HandoverItemDto, InvitationDto, MemberDto, RoleDto, TeamDto } from "@/types/api";
import type { PermissionKey } from "@/types/permission";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  ButtonLink,
  DataTable,
  EmptyStateView,
  PageFrame,
  Panel,
  SegmentTabs,
  StatPill,
  StatusBadge,
  formatDateTime,
} from "@/components/delivery/DeliveryUI";
import { FAMILY_LABEL, LoadGate } from "./ApiRoleViews";
import { useOrgHref } from "./OrgUI";
import type { OrgFamily } from "./role-rules";
import { roleDisplayName } from "./permission-key-catalog";
import { StaleVersionBanner } from "./StaleVersionBanner";
import { apiErrorMessage, useOrgId } from "./useRoleApi";
import {
  useHandoverItems,
  useInvitation,
  useInvitations,
  useMemberOwnership,
  useOwnership,
  usePeopleMembers,
  usePeopleMutations,
  useReloadPeople,
  useTeam,
  useTeams,
  useTemplateRoles,
} from "./usePeopleApi";

/**
 * Task 1.2 screens on the real API: invitations, teams, member role / disable with handover, handover items and
 * ownership transfer. No popups: every action lives on its own page with a back link and breadcrumb. A lost
 * race (409 STALE_VERSION) shows the inline reload banner; other errors show their request reference.
 */

/* ======================================================================
 * Shared
 * ==================================================================== */

type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "violet";

const INVITE_TONE: Record<string, StatusTone> = { PENDING: "info", EXPIRED: "warning", ACCEPTED: "success", REVOKED: "neutral" };

/** Error + stale-version state for one page's mutations. */
function useChangeFeedback(orgId: string) {
  const reloadPeople = useReloadPeople(orgId);
  const [error, setError] = useState("");
  const [stale, setStale] = useState<ApiError | null>(null);
  const [reloading, setReloading] = useState(false);
  return {
    error,
    clear: () => {
      setError("");
      setStale(null);
    },
    fail: (failure: unknown) => {
      if (isStaleVersion(failure)) {
        setError("");
        setStale(failure as ApiError);
      } else {
        setError(apiErrorMessage(failure));
      }
    },
    setError,
    banner: stale ? (
      <StaleVersionBanner
        requestId={stale.requestId}
        reloading={reloading}
        onReload={() => {
          setReloading(true);
          void reloadPeople().finally(() => {
            setReloading(false);
            setStale(null);
          });
        }}
      />
    ) : null,
  };
}

function ErrorLine({ message }: { message: string }) {
  if (!message) return null;
  return <p role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">{message}</p>;
}

/** Template roles an actor may hand out: never the owner role, and only roles whose keys the actor holds. */
function useAssignableRoles(roles: RoleDto[]) {
  const { can } = usePermissions();
  return useMemo(
    () =>
      roles
        .filter((role) => role.template && !role.owner_only && role.name !== "PLATFORM_OPERATOR")
        .map((role) => {
          const missing = role.permission_keys.filter((key) => !can(key as PermissionKey));
          return { role, blocked: missing.length ? `needs ${missing.length} permission${missing.length > 1 ? "s" : ""} you don't hold` : "" };
        }),
    [roles, can],
  );
}

function crumbsFor(family: OrgFamily, href: (path?: string) => string, section: { label: string; path: string }, leaf?: string) {
  return [
    { label: FAMILY_LABEL[family], href: href() },
    leaf ? { label: section.label, href: href(section.path) } : { label: section.label },
    ...(leaf ? [{ label: leaf }] : []),
  ];
}

/* ======================================================================
 * Invitations
 * ==================================================================== */

type InviteFilter = "ALL" | InvitationDto["status"];

export function InvitationsListView({ family }: { family: OrgFamily }) {
  const orgId = useOrgId();
  const href = useOrgHref(family);
  const state = useInvitations(orgId);
  const [filter, setFilter] = useState<InviteFilter>("ALL");
  return (
    <PageFrame
      crumbs={crumbsFor(family, href, { label: "Invitations", path: "invitations" })}
      title="Invitations"
      description="Single-use links that expire. Resend rotates the link (the old one stops working); revoke is immediate."
      actions={<ButtonLink href={href("invitations/new")}><UserPlus className="w-3.5 h-3.5" /> Invite member</ButtonLink>}
    >
      <LoadGate state={state} family={family} permission="member.invite" what="Invitations">
        {(rows) => {
          const counts = (status: InviteFilter) => (status === "ALL" ? rows.length : rows.filter((row) => row.status === status).length);
          const visible = filter === "ALL" ? rows : rows.filter((row) => row.status === filter);
          return (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatPill label="Pending" value={counts("PENDING")} tone="info" />
                <StatPill label="Expired" value={counts("EXPIRED")} tone="warning" />
                <StatPill label="Accepted" value={counts("ACCEPTED")} tone="success" />
                <StatPill label="Revoked" value={counts("REVOKED")} />
              </div>
              <SegmentTabs<InviteFilter>
                value={filter}
                onChange={setFilter}
                options={(["ALL", "PENDING", "EXPIRED", "ACCEPTED", "REVOKED"] as InviteFilter[]).map((value) => ({
                  value,
                  label: value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase(),
                  count: counts(value),
                }))}
              />
              <DataTable<InvitationDto>
                rows={visible}
                rowHref={(row) => href(`invitations/${row.id}`)}
                empty={{ icon: Mail, title: "No invitations", description: "Invite a member: they get a temporary password (or, with an existing account, an accept link) by email." }}
                columns={[
                  { key: "email", header: "Email", render: (row) => <span className="font-medium">{row.email}</span> },
                  { key: "role", header: "Role", render: (row) => roleDisplayName(row.role_name) },
                  { key: "team", header: "Team", render: (row) => row.team_name ?? "—", hideBelow: "md" },
                  { key: "status", header: "Status", render: (row) => <StatusBadge label={row.status} tone={INVITE_TONE[row.status]} dot /> },
                  { key: "expires", header: "Expires", render: (row) => formatDateTime(row.expires_at), hideBelow: "sm" },
                  { key: "sent", header: "Sent", render: (row) => `${row.send_count}×`, hideBelow: "lg" },
                ]}
              />
            </>
          );
        }}
      </LoadGate>
    </PageFrame>
  );
}

export function InviteMemberView({ family }: { family: OrgFamily }) {
  const orgId = useOrgId();
  const href = useOrgHref(family);
  const router = useRouter();
  const roles = useTemplateRoles(orgId);
  const teams = useTeams(orgId);
  const { createInvitation } = usePeopleMutations(orgId);
  const feedback = useChangeFeedback(orgId);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [days, setDays] = useState("7");
  const activeTeams = teams.kind === "ready" ? teams.data.filter((team) => team.status === "ACTIVE") : [];

  return (
    <PageFrame
      crumbs={crumbsFor(family, href, { label: "Invitations", path: "invitations" }, "Invite member")}
      back={{ href: href("invitations"), label: "Back to invitations" }}
      title="Invite a member"
      description="Someone new gets an email with a temporary password: signing in with it opens their role's dashboard, and they can change it from the account menu. Someone who already has a ProWise account gets a sign-in-and-accept link instead. Neither is ever shown here."
    >
      <LoadGate state={roles} family={family} permission="member.invite" what="Roles">
        {(roleList) => (
          <InviteForm
            roles={roleList}
            teams={activeTeams}
            email={email}
            roleId={roleId}
            teamId={teamId}
            days={days}
            onEmail={setEmail}
            onRole={setRoleId}
            onTeam={setTeamId}
            onDays={setDays}
            saving={createInvitation.isPending}
            error={feedback.error}
            onSubmit={() => {
              if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email.trim())) return feedback.setError("Enter a valid email address.");
              if (!roleId) return feedback.setError("Choose a role.");
              feedback.clear();
              createInvitation.mutate(
                { email: email.trim(), template_role_id: roleId, team_id: teamId || null, expires_in_days: Number(days) },
                {
                  onSuccess: (created) => {
                    toast.success(`Invitation sent to ${created.email}`);
                    router.push(href(`invitations/${created.id}`));
                  },
                  onError: feedback.fail,
                },
              );
            }}
          />
        )}
      </LoadGate>
    </PageFrame>
  );
}

function InviteForm(props: {
  roles: RoleDto[];
  teams: TeamDto[];
  email: string;
  roleId: string;
  teamId: string;
  days: string;
  onEmail: (value: string) => void;
  onRole: (value: string) => void;
  onTeam: (value: string) => void;
  onDays: (value: string) => void;
  saving: boolean;
  error: string;
  onSubmit: () => void;
}) {
  const assignable = useAssignableRoles(props.roles);
  const blocked = assignable.find((entry) => entry.role.id === props.roleId)?.blocked;
  return (
    <Panel title="Invitation" icon={UserPlus} className="max-w-2xl">
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit();
        }}
      >
        <AdminInput label="Email" type="email" autoComplete="off" value={props.email} onChange={(e) => props.onEmail(e.target.value)} />
        <AdminSelect label="Role" value={props.roleId} onChange={(e) => props.onRole(e.target.value)}>
          <option value="">Choose a role…</option>
          {assignable.map(({ role, blocked: reason }) => (
            <option key={role.id} value={role.id} disabled={Boolean(reason)}>
              {roleDisplayName(role.name)}{reason ? ` (${reason})` : ""}
            </option>
          ))}
        </AdminSelect>
        {blocked && <ErrorLine message={`You can't invite into this role: it ${blocked}.`} />}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AdminSelect label="Team (optional)" value={props.teamId} onChange={(e) => props.onTeam(e.target.value)}>
            <option value="">No team</option>
            {props.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </AdminSelect>
          <AdminSelect label="Link expires after" value={props.days} onChange={(e) => props.onDays(e.target.value)}>
            {["1", "3", "7", "14", "30"].map((value) => <option key={value} value={value}>{value} day{value === "1" ? "" : "s"}</option>)}
          </AdminSelect>
        </div>
        <ErrorLine message={props.error} />
        <AdminButton type="submit" isLoading={props.saving}><Send className="w-3.5 h-3.5" /> Send invitation</AdminButton>
      </form>
    </Panel>
  );
}

export function InvitationDetailView({ family, inviteId }: { family: OrgFamily; inviteId: string }) {
  const orgId = useOrgId();
  const href = useOrgHref(family);
  const state = useInvitation(orgId, inviteId);
  const { resendInvitation, revokeInvitation } = usePeopleMutations(orgId);
  const feedback = useChangeFeedback(orgId);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const invitation = state.kind === "ready" ? state.data : null;

  return (
    <PageFrame
      crumbs={crumbsFor(family, href, { label: "Invitations", path: "invitations" }, invitation?.email ?? "Invitation")}
      back={{ href: href("invitations"), label: "Back to invitations" }}
      title={invitation?.email ?? "Invitation"}
      description="The link itself is never stored or shown; only the person who received the email can use it."
    >
      <LoadGate state={state} family={family} permission="member.invite" what="The invitation">
        {(row) => {
          const open = row.status === "PENDING" || row.status === "EXPIRED";
          return (
            <>
              {feedback.banner}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatPill label="Status" value={<StatusBadge label={row.status} tone={INVITE_TONE[row.status]} dot />} />
                <StatPill label="Role" value={roleDisplayName(row.role_name)} />
                <StatPill label="Expires" value={formatDateTime(row.expires_at)} />
                <StatPill label="Sent" value={`${row.send_count}×`} />
              </div>
              <Panel title="Details" icon={Mail}>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <Detail label="Team" value={row.team_name ?? "—"} />
                  <Detail label="Invited by" value={row.invited_by_email} />
                  <Detail label="Created" value={formatDateTime(row.created_at)} />
                  <Detail label="Last sent" value={formatDateTime(row.last_sent_at)} />
                  {row.accepted_at && <Detail label="Accepted" value={formatDateTime(row.accepted_at)} />}
                  {row.revoked_at && <Detail label="Revoked" value={formatDateTime(row.revoked_at)} />}
                </dl>
              </Panel>
              {open ? (
                <Panel title="Actions" icon={Send} description="Resend issues a new link and makes the previous one useless.">
                  <div className="flex flex-wrap items-center gap-2">
                    <AdminButton
                      isLoading={resendInvitation.isPending}
                      onClick={() => {
                        feedback.clear();
                        resendInvitation.mutate({ id: row.id, version: row.version }, {
                          onSuccess: () => toast.success("New link sent; the old link no longer works"),
                          onError: feedback.fail,
                        });
                      }}
                    >
                      <Send className="w-3.5 h-3.5" /> Resend (rotate link)
                    </AdminButton>
                    {!confirmRevoke ? (
                      <AdminButton variant="outline" onClick={() => setConfirmRevoke(true)}><XCircle className="w-3.5 h-3.5" /> Revoke…</AdminButton>
                    ) : (
                      <span className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-700 dark:text-rose-200">
                        The link stops working immediately.
                        <AdminButton size="xs" variant="danger" isLoading={revokeInvitation.isPending} onClick={() => {
                          feedback.clear();
                          revokeInvitation.mutate({ id: row.id, version: row.version }, {
                            onSuccess: () => {
                              setConfirmRevoke(false);
                              toast.success("Invitation revoked");
                            },
                            onError: feedback.fail,
                          });
                        }}>Confirm revoke</AdminButton>
                        <AdminButton size="xs" variant="ghost" onClick={() => setConfirmRevoke(false)}>Cancel</AdminButton>
                      </span>
                    )}
                  </div>
                  <div className="mt-2"><ErrorLine message={feedback.error} /></div>
                </Panel>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)]">This invitation is {row.status.toLowerCase()} and can no longer change.</p>
              )}
            </>
          );
        }}
      </LoadGate>
    </PageFrame>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

/* ======================================================================
 * Teams
 * ==================================================================== */

export function TeamsListView({ family }: { family: OrgFamily }) {
  const orgId = useOrgId();
  const href = useOrgHref(family);
  const state = useTeams(orgId);
  return (
    <PageFrame
      crumbs={crumbsFor(family, href, { label: "Teams", path: "teams" })}
      title="Teams"
      description="Teams group members and have one lead. Lead changes are kept in the ownership history."
      actions={<ButtonLink href={href("teams/new")}><Plus className="w-3.5 h-3.5" /> Create team</ButtonLink>}
    >
      <LoadGate state={state} family={family} permission="team.manage" what="Teams">
        {(rows) => (
          <DataTable<TeamDto>
            rows={rows}
            rowHref={(row) => href(`teams/${row.id}`)}
            empty={{ icon: UsersRound, title: "No teams yet", description: "Create a team and choose its lead." }}
            columns={[
              { key: "name", header: "Team", render: (row) => <span className="font-medium">{row.name}</span> },
              { key: "lead", header: "Lead", render: (row) => row.lead_email ?? <StatusBadge label="No lead" tone="warning" /> },
              { key: "members", header: "Members", render: (row) => row.members.length },
              { key: "status", header: "Status", render: (row) => <StatusBadge label={row.status} tone={row.status === "ACTIVE" ? "success" : "neutral"} dot /> },
            ]}
          />
        )}
      </LoadGate>
    </PageFrame>
  );
}

export function TeamNewView({ family }: { family: OrgFamily }) {
  const orgId = useOrgId();
  const href = useOrgHref(family);
  const router = useRouter();
  const members = usePeopleMembers(orgId);
  const { createTeam } = usePeopleMutations(orgId);
  const feedback = useChangeFeedback(orgId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [lead, setLead] = useState("");
  return (
    <PageFrame
      crumbs={crumbsFor(family, href, { label: "Teams", path: "teams" }, "Create team")}
      back={{ href: href("teams"), label: "Back to teams" }}
      title="Create a team"
    >
      <LoadGate state={members} family={family} permission="role.manage" what="Members">
        {(memberList) => (
          <Panel title="Team" icon={UsersRound} className="max-w-2xl">
            <form className="space-y-4" onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) return feedback.setError("Enter a team name.");
              feedback.clear();
              createTeam.mutate({ name: name.trim(), description: description.trim() || null, lead_membership_id: lead || null }, {
                onSuccess: (team) => {
                  toast.success(`${team.name} created`);
                  router.push(href(`teams/${team.id}`));
                },
                onError: feedback.fail,
              });
            }}>
              <AdminInput label="Name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
              <AdminTextarea label="Description (optional)" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
              <AdminSelect label="Lead (optional)" value={lead} onChange={(e) => setLead(e.target.value)}>
                <option value="">No lead yet</option>
                {activeMembers(memberList).map((member) => <option key={member.id} value={member.id}>{member.email}</option>)}
              </AdminSelect>
              <ErrorLine message={feedback.error} />
              <AdminButton type="submit" isLoading={createTeam.isPending}><Plus className="w-3.5 h-3.5" /> Create team</AdminButton>
            </form>
          </Panel>
        )}
      </LoadGate>
    </PageFrame>
  );
}

function activeMembers(members: MemberDto[]) {
  return members.filter((member) => member.status === "ACTIVE");
}

export function TeamDetailView({ family, teamId }: { family: OrgFamily; teamId: string }) {
  const orgId = useOrgId();
  const href = useOrgHref(family);
  const state = useTeam(orgId, teamId);
  const members = usePeopleMembers(orgId);
  const mutations = usePeopleMutations(orgId);
  const feedback = useChangeFeedback(orgId);
  const team = state.kind === "ready" ? state.data : null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [lead, setLead] = useState("");
  const [addId, setAddId] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!team) return;
    setName(team.name);
    setDescription(team.description ?? "");
    setLead(team.lead_membership_id ?? "");
  }, [team]);

  const done = (message: string) => () => toast.success(message);

  return (
    <PageFrame
      crumbs={crumbsFor(family, href, { label: "Teams", path: "teams" }, team?.name ?? "Team")}
      back={{ href: href("teams"), label: "Back to teams" }}
      title={team?.name ?? "Team"}
      description={team?.description ?? undefined}
    >
      <LoadGate state={state} family={family} permission="team.manage" what="The team">
        {(row) => {
          const archived = row.status === "ARCHIVED";
          const pool = members.kind === "ready" ? activeMembers(members.data) : [];
          const candidates = pool.filter((member) => !row.members.some((m) => m.membership_id === member.id));
          return (
            <>
              {feedback.banner}
              {archived && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] px-3.5 py-2.5 text-xs">
                  <b>Archived.</b> This team is read-only and kept for history.
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatPill label="Status" value={<StatusBadge label={row.status} tone={archived ? "neutral" : "success"} dot />} />
                <StatPill label="Lead" value={row.lead_email ?? "None"} tone={row.lead_email ? "neutral" : "warning"} />
                <StatPill label="Members" value={row.members.length} />
                <StatPill label="Version" value={row.version} />
              </div>
              <ErrorLine message={feedback.error} />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                <Panel title="Details" icon={UsersRound}>
                  <form className="space-y-3" onSubmit={(event) => {
                    event.preventDefault();
                    feedback.clear();
                    mutations.updateTeam.mutate({ id: row.id, name: name.trim(), description: description.trim() || null, version: row.version },
                      { onSuccess: done("Team saved"), onError: feedback.fail });
                  }}>
                    <AdminInput label="Name" value={name} disabled={archived} maxLength={120} onChange={(e) => setName(e.target.value)} />
                    <AdminTextarea label="Description" value={description} disabled={archived} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
                    <AdminButton type="submit" disabled={archived} isLoading={mutations.updateTeam.isPending}>Save details</AdminButton>
                  </form>
                </Panel>
                <Panel title="Team lead" icon={Crown} description="The lead is accountable for the team's work. Changes are recorded in ownership history.">
                  <div className="space-y-3">
                    <AdminSelect label="Lead" value={lead} disabled={archived} onChange={(e) => setLead(e.target.value)}>
                      <option value="">No lead</option>
                      {pool.map((member) => <option key={member.id} value={member.id}>{member.email}</option>)}
                    </AdminSelect>
                    <AdminButton disabled={archived || lead === (row.lead_membership_id ?? "")} isLoading={mutations.changeTeamLead.isPending}
                      onClick={() => {
                        feedback.clear();
                        mutations.changeTeamLead.mutate({ id: row.id, membershipId: lead || null, version: row.version },
                          { onSuccess: done("Team lead changed"), onError: feedback.fail });
                      }}>
                      Change lead
                    </AdminButton>
                  </div>
                </Panel>
              </div>
              <Panel title="Members" icon={UserPlus}>
                {!archived && (
                  <div className="mb-3 flex flex-wrap items-end gap-2">
                    <div className="min-w-[14rem] flex-1">
                      <AdminSelect label="Add member" value={addId} onChange={(e) => setAddId(e.target.value)}>
                        <option value="">Choose an active member…</option>
                        {candidates.map((member) => <option key={member.id} value={member.id}>{member.email}</option>)}
                      </AdminSelect>
                    </div>
                    <AdminButton disabled={!addId} isLoading={mutations.addTeamMember.isPending} onClick={() => {
                      feedback.clear();
                      mutations.addTeamMember.mutate({ id: row.id, membershipId: addId, version: row.version },
                        { onSuccess: () => { setAddId(""); toast.success("Member added"); }, onError: feedback.fail });
                    }}>Add</AdminButton>
                  </div>
                )}
                {row.members.length === 0 ? (
                  <EmptyStateView icon={UsersRound} title="No members" description="Add active members of this workspace." />
                ) : (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {row.members.map((member) => (
                      <li key={member.membership_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                        <span className="min-w-0">
                          <span className="block font-medium truncate">{member.email}</span>
                          <span className="block text-[10px] text-[var(--color-text-muted)]">
                            {roleDisplayName(member.role_template)}{member.membership_id === row.lead_membership_id ? " · Lead" : ""}
                            {member.status !== "ACTIVE" ? ` · ${member.status}` : ""}
                          </span>
                        </span>
                        {!archived && (
                          <AdminButton size="xs" variant="ghost" isLoading={mutations.removeTeamMember.isPending} onClick={() => {
                            feedback.clear();
                            mutations.removeTeamMember.mutate({ id: row.id, membershipId: member.membership_id, version: row.version },
                              { onSuccess: done("Member removed"), onError: feedback.fail });
                          }}>Remove</AdminButton>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              {!archived && (
                <Panel title="Archive team" icon={Archive} description="Archived teams stay in history and can no longer change.">
                  {!confirmArchive ? (
                    <AdminButton variant="outline" onClick={() => setConfirmArchive(true)}><Archive className="w-3.5 h-3.5" /> Archive…</AdminButton>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span>Archive {row.name}?</span>
                      <AdminButton size="xs" variant="danger" isLoading={mutations.archiveTeam.isPending} onClick={() => {
                        feedback.clear();
                        mutations.archiveTeam.mutate({ id: row.id, version: row.version }, {
                          onSuccess: () => { setConfirmArchive(false); toast.success("Team archived"); },
                          onError: feedback.fail,
                        });
                      }}>Confirm archive</AdminButton>
                      <AdminButton size="xs" variant="ghost" onClick={() => setConfirmArchive(false)}>Cancel</AdminButton>
                    </div>
                  )}
                </Panel>
              )}
            </>
          );
        }}
      </LoadGate>
    </PageFrame>
  );
}

/* ======================================================================
 * Members, departure handover
 * ==================================================================== */

type MemberFilter = "ALL" | "ACTIVE" | "DISABLED";

export function MembersListView({ family }: { family: OrgFamily }) {
  const orgId = useOrgId();
  const href = useOrgHref(family);
  const state = usePeopleMembers(orgId);
  const { can } = usePermissions();
  const handover = useHandoverItems(orgId, can("member.disable"));
  const [filter, setFilter] = useState<MemberFilter>("ALL");
  const open = handover.kind === "ready" ? handover.data.filter((item) => item.status === "NEEDS_OWNER") : [];
  return (
    <PageFrame
      crumbs={crumbsFor(family, href, { label: "Members", path: "members" })}
      title="Members"
      description="Change roles through grants, disable with a handover, and keep every change in history."
      actions={can("member.invite") ? <ButtonLink href={href("invitations/new")}><UserPlus className="w-3.5 h-3.5" /> Invite member</ButtonLink> : undefined}
    >
      {open.length > 0 && (
        <Panel title={`Needs owner (${open.length})`} icon={ShieldAlert} iconTone="amber"
          description="Work left without an accountable owner after an emergency disable. Assign a replacement.">
          <HandoverList items={open} href={href} />
        </Panel>
      )}
      <LoadGate state={state} family={family} permission="role.manage" what="Members">
        {(rows) => {
          const visible = filter === "ALL" ? rows : rows.filter((row) => row.status === filter);
          return (
            <>
              <SegmentTabs<MemberFilter>
                value={filter}
                onChange={setFilter}
                options={(["ALL", "ACTIVE", "DISABLED"] as MemberFilter[]).map((value) => ({
                  value,
                  label: value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase(),
                  count: value === "ALL" ? rows.length : rows.filter((row) => row.status === value).length,
                }))}
              />
              <DataTable<MemberDto>
                rows={visible}
                rowHref={(row) => href(`members/${row.id}`)}
                empty={{ icon: UsersRound, title: "No members", description: "Invite people to this workspace." }}
                columns={[
                  { key: "email", header: "Member", render: (row) => <span className="font-medium">{row.email}</span> },
                  { key: "role", header: "Role", render: (row) => roleDisplayName(row.role_template) },
                  { key: "status", header: "Status", render: (row) => <StatusBadge label={row.status} tone={row.status === "ACTIVE" ? "success" : "danger"} dot /> },
                ]}
              />
            </>
          );
        }}
      </LoadGate>
    </PageFrame>
  );
}

function HandoverList({ items, href }: { items: HandoverItemDto[]; href: (path?: string) => string }) {
  return (
    <ul className="divide-y divide-[var(--color-border)]">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
          <span className="min-w-0">
            <span className="block font-medium">{item.subject_label}</span>
            <span className="block text-[10px] text-[var(--color-text-muted)]">Left by {item.departed_email} · {formatDateTime(item.created_at)}</span>
          </span>
          {item.status === "NEEDS_OWNER"
            ? <ButtonLink variant="outline" href={href(`members/handover/${item.id}`)}>Assign owner</ButtonLink>
            : <StatusBadge label={`Resolved → ${item.replacement_email ?? ""}`} tone="success" />}
        </li>
      ))}
    </ul>
  );
}

export function MemberDetailView({ family, memberId }: { family: OrgFamily; memberId: string }) {
  const orgId = useOrgId();
  const href = useOrgHref(family);
  const members = usePeopleMembers(orgId);
  const roles = useTemplateRoles(orgId);
  const { can } = usePermissions();
  const { changeMemberRole, changeMemberStatus } = usePeopleMutations(orgId);
  const feedback = useChangeFeedback(orgId);
  const [roleId, setRoleId] = useState("");
  const member = members.kind === "ready" ? members.data.find((row) => row.id === memberId) ?? null : null;
  const roleList = roles.kind === "ready" ? roles.data : [];
  const assignable = useAssignableRoles(roleList);

  return (
    <PageFrame
      crumbs={crumbsFor(family, href, { label: "Members", path: "members" }, member?.email ?? "Member")}
      back={{ href: href("members"), label: "Back to members" }}
      title={member?.email ?? "Member"}
    >
      <LoadGate state={members} family={family} permission="role.manage" what="Members">
        {(rows) => {
          const row = rows.find((candidate) => candidate.id === memberId);
          if (!row) return <EmptyStateView icon={UserX} title="Member not found" description="This member is not part of this workspace." />;
          const owner = row.role_template === "ORGANIZATION_OWNER";
          const version = row.version ?? 0;
          return (
            <>
              {feedback.banner}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatPill label="Role" value={roleDisplayName(row.role_template)} />
                <StatPill label="Status" value={<StatusBadge label={row.status} tone={row.status === "ACTIVE" ? "success" : "danger"} dot />} />
                <StatPill label="Version" value={version} />
              </div>
              {owner ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-800 dark:text-amber-200">
                  <Crown className="w-4 h-4 shrink-0 mt-0.5" />
                  <span><b>Organization owner.</b> The owner role and status change only through ownership transfer.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                  {can("role.manage") && (
                    <Panel title="Change role" icon={ArrowRightLeft} description="You can only give a role whose permissions you hold yourself.">
                      <div className="space-y-3">
                        <AdminSelect label="New role" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                          <option value="">Choose a role…</option>
                          {assignable.map(({ role, blocked }) => (
                            <option key={role.id} value={role.id} disabled={Boolean(blocked) || role.name === row.role_template}>
                              {roleDisplayName(role.name)}{blocked ? ` (${blocked})` : role.name === row.role_template ? " (current)" : ""}
                            </option>
                          ))}
                        </AdminSelect>
                        <AdminButton disabled={!roleId || row.status !== "ACTIVE"} isLoading={changeMemberRole.isPending} onClick={() => {
                          feedback.clear();
                          changeMemberRole.mutate({ membershipId: row.id, templateRoleId: roleId, version }, {
                            onSuccess: () => { setRoleId(""); toast.success("Role changed"); },
                            onError: feedback.fail,
                          });
                        }}>Change role</AdminButton>
                      </div>
                    </Panel>
                  )}
                  {can("member.disable") && (
                    <Panel title={row.status === "ACTIVE" ? "Disable member" : "Re-enable member"} icon={row.status === "ACTIVE" ? UserX : UserCheck}
                      description={row.status === "ACTIVE"
                        ? "Access stops on their next request. Plan who takes over what they own."
                        : "Restores access with the member's existing role."}>
                      {row.status === "ACTIVE" ? (
                        <ButtonLink variant="outline" href={href(`members/${row.id}/disable`)}><UserX className="w-3.5 h-3.5" /> Disable with handover…</ButtonLink>
                      ) : (
                        <AdminButton isLoading={changeMemberStatus.isPending} onClick={() => {
                          feedback.clear();
                          changeMemberStatus.mutate({ membershipId: row.id, body: { status: "ACTIVE", expected_version: version } }, {
                            onSuccess: () => toast.success("Member re-enabled"),
                            onError: feedback.fail,
                          });
                        }}><UserCheck className="w-3.5 h-3.5" /> Re-enable</AdminButton>
                      )}
                    </Panel>
                  )}
                </div>
              )}
              <ErrorLine message={feedback.error} />
            </>
          );
        }}
      </LoadGate>
    </PageFrame>
  );
}

type HandoverMode = "PLANNED" | "EMERGENCY";

export function MemberDisableView({ family, memberId }: { family: OrgFamily; memberId: string }) {
  const orgId = useOrgId();
  const href = useOrgHref(family);
  const ownership = useMemberOwnership(orgId, memberId);
  const members = usePeopleMembers(orgId);
  const { changeMemberStatus } = usePeopleMutations(orgId);
  const feedback = useChangeFeedback(orgId);
  const [mode, setMode] = useState<HandoverMode>("PLANNED");
  const [replacement, setReplacement] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<HandoverItemDto[] | null>(null);
  const email = ownership.kind === "ready" ? ownership.data.email : "Member";

  return (
    <PageFrame
      crumbs={[
        { label: FAMILY_LABEL[family], href: href() },
        { label: "Members", href: href("members") },
        { label: email, href: href(`members/${memberId}`) },
        { label: "Disable" },
      ]}
      back={{ href: href(`members/${memberId}`), label: "Back to member" }}
      title={`Disable ${email}`}
      description="Access ends on the member's next request. What they own moves to a replacement now, or is flagged “needs owner”."
    >
      <LoadGate state={ownership} family={family} permission="member.disable" what="The member">
        {(data) => {
          if (result) {
            return (
              <Panel title="Member disabled" icon={CheckCircle2} iconTone="emerald">
                <p className="text-xs">{data.email} can no longer access this workspace.</p>
                {result.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold">Needs owner ({result.length})</p>
                    <HandoverList items={result} href={href} />
                  </div>
                )}
                <div className="mt-3"><ButtonLink href={href("members")}>Back to members</ButtonLink></div>
              </Panel>
            );
          }
          if (data.status !== "ACTIVE") {
            return <EmptyStateView icon={UserX} title="Already disabled" description="This member has no access to the workspace." />;
          }
          const pool = members.kind === "ready" ? activeMembers(members.data).filter((member) => member.id !== data.id) : [];
          const needsChoice = data.owned.length > 0;
          return (
            <>
              {feedback.banner}
              <Panel title={`What ${data.email} owns`} icon={Crown}>
                {data.owned.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)]">Nothing is owned by this member. Disabling leaves no orphaned work.</p>
                ) : (
                  <ul className="list-disc pl-5 text-xs space-y-1">
                    {data.owned.map((item) => <li key={`${item.subject_type}-${item.subject_id}`}>{item.label}</li>)}
                  </ul>
                )}
              </Panel>
              <Panel title="Handover" icon={ArrowRightLeft}>
                <fieldset className="space-y-2 text-xs">
                  <legend className="sr-only">Handover</legend>
                  <label className="flex items-start gap-2">
                    <input type="radio" name="mode" checked={mode === "PLANNED"} onChange={() => setMode("PLANNED")} />
                    <span><b>Planned handover.</b> Move everything above to a named active member now.</span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input type="radio" name="mode" checked={mode === "EMERGENCY"} onChange={() => setMode("EMERGENCY")} />
                    <span><b>Emergency disable.</b> No replacement is ready. Each item is flagged “needs owner” for later.</span>
                  </label>
                </fieldset>
                {mode === "PLANNED" && (
                  <div className="mt-3 max-w-md">
                    <AdminSelect label="Replacement" value={replacement} onChange={(e) => setReplacement(e.target.value)}>
                      <option value="">Choose an active member…</option>
                      {pool.map((member) => <option key={member.id} value={member.id}>{member.email}</option>)}
                    </AdminSelect>
                  </div>
                )}
                {mode === "EMERGENCY" && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Access is revoked immediately. Owned work shows under “Needs owner” until someone is assigned.
                  </div>
                )}
                <div className="mt-3 max-w-xl">
                  <AdminTextarea label="Reason (kept in history)" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <AdminButton variant="danger" isLoading={changeMemberStatus.isPending} onClick={() => {
                    if (mode === "PLANNED" && needsChoice && !replacement) return feedback.setError("Choose a replacement, or use emergency disable.");
                    feedback.clear();
                    changeMemberStatus.mutate({
                      membershipId: data.id,
                      body: {
                        status: "DISABLED",
                        reason: reason.trim() || null,
                        expected_version: data.version,
                        replacement_membership_id: mode === "PLANNED" && replacement ? replacement : null,
                        emergency: mode === "EMERGENCY",
                      },
                    }, {
                      onSuccess: (response) => {
                        toast.success("Member disabled");
                        setResult(response.open_handover_items);
                      },
                      onError: feedback.fail,
                    });
                  }}>
                    <UserX className="w-3.5 h-3.5" /> Disable now
                  </AdminButton>
                  <ButtonLink variant="outline" href={href(`members/${data.id}`)}>Cancel</ButtonLink>
                </div>
                <div className="mt-2"><ErrorLine message={feedback.error} /></div>
              </Panel>
            </>
          );
        }}
      </LoadGate>
    </PageFrame>
  );
}

export function HandoverResolveView({ family, itemId }: { family: OrgFamily; itemId: string }) {
  const orgId = useOrgId();
  const href = useOrgHref(family);
  const items = useHandoverItems(orgId);
  const members = usePeopleMembers(orgId);
  const { resolveHandover } = usePeopleMutations(orgId);
  const feedback = useChangeFeedback(orgId);
  const [replacement, setReplacement] = useState("");
  return (
    <PageFrame
      crumbs={crumbsFor(family, href, { label: "Members", path: "members" }, "Assign owner")}
      back={{ href: href("members"), label: "Back to members" }}
      title="Assign a new owner"
    >
      <LoadGate state={items} family={family} permission="member.disable" what="Handover items">
        {(rows) => {
          const item = rows.find((row) => row.id === itemId);
          if (!item) return <EmptyStateView icon={ShieldAlert} title="Item not found" description="This handover item is not part of this workspace." />;
          const pool = members.kind === "ready" ? activeMembers(members.data) : [];
          return (
            <>
              {feedback.banner}
              <Panel title={item.subject_label} icon={ShieldAlert} iconTone="amber" description={`Left by ${item.departed_email} on ${formatDateTime(item.created_at)}`}>
                {item.status === "RESOLVED" ? (
                  <StatusBadge label={`Resolved → ${item.replacement_email ?? ""}`} tone="success" />
                ) : (
                  <div className="space-y-3 max-w-md">
                    <AdminSelect label="New owner" value={replacement} onChange={(e) => setReplacement(e.target.value)}>
                      <option value="">Choose an active member…</option>
                      {pool.map((member) => <option key={member.id} value={member.id}>{member.email}</option>)}
                    </AdminSelect>
                    <AdminButton disabled={!replacement} isLoading={resolveHandover.isPending} onClick={() => {
                      feedback.clear();
                      resolveHandover.mutate({ id: item.id, replacementId: replacement, version: item.version }, {
                        onSuccess: () => toast.success("Owner assigned"),
                        onError: feedback.fail,
                      });
                    }}>Assign owner</AdminButton>
                    <ErrorLine message={feedback.error} />
                  </div>
                )}
              </Panel>
            </>
          );
        }}
      </LoadGate>
    </PageFrame>
  );
}

/* ======================================================================
 * Ownership transfer (Owner only)
 * ==================================================================== */

export function TransferOwnershipView() {
  const family: OrgFamily = "owner";
  const orgId = useOrgId();
  const href = useOrgHref(family);
  const state = useOwnership(orgId);
  const queryClient = useQueryClient();
  const { transferOwnership } = usePeopleMutations(orgId);
  const feedback = useChangeFeedback(orgId);
  const [step, setStep] = useState<"choose" | "confirm" | "done">("choose");
  const [target, setTarget] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);

  return (
    <PageFrame
      crumbs={[{ label: FAMILY_LABEL[family], href: href() }, { label: "Transfer ownership" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Transfer ownership"
      description="There is always exactly one owner. After the transfer you become an Organization Admin."
    >
      <LoadGate state={state} family={family} permission="org.manage" what="Ownership">
        {(data) => {
          if (!data.caller_is_owner && step !== "done") {
            return <EmptyStateView icon={Crown} title="Only the owner can transfer" description={`The current owner is ${data.owner_email}.`} />;
          }
          const chosen = data.eligible.find((member) => member.membership_id === target);
          if (step === "done") {
            return (
              <Panel title="Ownership transferred" icon={CheckCircle2} iconTone="emerald">
                <p className="text-xs">{chosen?.email ?? "The new owner"} is now the organization owner. Your role is Organization Admin.</p>
                <div className="mt-3"><ButtonLink href="/select-org">Continue</ButtonLink></div>
              </Panel>
            );
          }
          if (step === "choose") {
            return (
              <Panel title="1 · Choose the new owner" icon={Crown}>
                {data.eligible.length === 0 ? (
                  <EmptyStateView icon={UsersRound} title="No eligible members" description="Only active members can become the owner. Invite or re-enable someone first." />
                ) : (
                  <div className="space-y-3 max-w-md">
                    <AdminSelect label="New owner (active members)" value={target} onChange={(e) => setTarget(e.target.value)}>
                      <option value="">Choose a member…</option>
                      {data.eligible.map((member) => (
                        <option key={member.membership_id} value={member.membership_id}>{member.email} · {roleDisplayName(member.role_template)}</option>
                      ))}
                    </AdminSelect>
                    <AdminButton disabled={!target} onClick={() => setStep("confirm")}>Next: confirm</AdminButton>
                  </div>
                )}
              </Panel>
            );
          }
          return (
            <>
              {feedback.banner}
              <Panel title="2 · Confirm the transfer" icon={ShieldAlert} iconTone="amber">
                <div className="space-y-3 max-w-xl text-xs">
                  <p><b>{chosen?.email}</b> becomes the owner. You ({data.owner_email}) become an Organization Admin and can no longer transfer ownership.</p>
                  <AdminInput label={`Type the workspace slug “${data.organization_slug}” to confirm`} value={confirmation} autoComplete="off"
                    onChange={(e) => setConfirmation(e.target.value)} />
                  <AdminTextarea label="Reason (optional, kept in history)" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                    <span>I understand this takes effect immediately.</span>
                  </label>
                  <ErrorLine message={feedback.error} />
                  <div className="flex flex-wrap gap-2">
                    <AdminButton variant="danger" disabled={!ack || confirmation.trim() !== data.organization_slug} isLoading={transferOwnership.isPending}
                      onClick={() => {
                        feedback.clear();
                        transferOwnership.mutate(
                          { new_owner_membership_id: target, confirmation: confirmation.trim(), reason: reason.trim() || null, expected_version: data.version },
                          {
                            onSuccess: () => {
                              setStep("done");
                              void queryClient.invalidateQueries();
                            },
                            onError: feedback.fail,
                          },
                        );
                      }}>
                      <Crown className="w-3.5 h-3.5" /> Transfer ownership
                    </AdminButton>
                    <AdminButton variant="ghost" onClick={() => setStep("choose")}>Back</AdminButton>
                  </div>
                </div>
              </Panel>
            </>
          );
        }}
      </LoadGate>
    </PageFrame>
  );
}
