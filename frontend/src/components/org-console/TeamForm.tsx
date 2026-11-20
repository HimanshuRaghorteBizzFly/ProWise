"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useOrgConsoleStore } from "@/store/org-console-store";
import type { Team } from "@/mocks/org-console";
import { AdminButton, AdminInput, AdminSelect, AdminTextarea, Avatar } from "@/components/delivery/DeliveryUI";
import type { OrgFamily } from "./role-rules";
import { useOrgHref } from "./OrgUI";

/** Create a team (no `team`) or edit its lead and members. */
export function TeamForm({ family, team }: { family: OrgFamily; team?: Team }) {
  const router = useRouter();
  const href = useOrgHref(family);
  const allMembers = useOrgConsoleStore((s) => s.members);
  const teams = useOrgConsoleStore((s) => s.teams);
  const createTeam = useOrgConsoleStore((s) => s.createTeam);
  const updateTeam = useOrgConsoleStore((s) => s.updateTeam);
  const members = allMembers.filter((m) => m.status === "ACTIVE" && m.roleId !== "role-owner");
  const [name, setName] = useState(team?.name ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [leadId, setLeadId] = useState(team?.leadId ?? "");
  const [picked, setPicked] = useState<string[]>(team?.memberIds ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!team) {
      if (name.trim().length < 3) next.name = "Team name needs at least 3 characters.";
      else if (teams.some((t) => t.name.toLowerCase() === name.trim().toLowerCase())) next.name = "A team with this name already exists.";
    }
    if (!leadId) next.lead = "Choose a team lead.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    window.setTimeout(() => {
      if (team) {
        updateTeam(family, team.id, { leadId, memberIds: picked, description: description.trim() });
        setSaving(false);
        toast.success(`${team.name} updated`);
      } else {
        const t = createTeam(family, { name: name.trim(), description: description.trim(), leadId, memberIds: picked });
        toast.success(`${t.name} created`);
        router.push(href(`teams/${t.id}`));
      }
    }, 450);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!team && <AdminInput label="Team name" placeholder="e.g. Growth Squad" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />}
        <AdminSelect label="Team lead" value={leadId} onChange={(e) => setLeadId(e.target.value)} error={errors.lead} options={[{ label: "Choose…", value: "" }, ...members.map((m) => ({ label: `${m.name} · ${m.title}`, value: m.id }))]} />
        <div className="md:col-span-2"><AdminTextarea label="Purpose" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this team own?" /></div>
      </div>
      <div>
        <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Members ({picked.length + (leadId && !picked.includes(leadId) ? 1 : 0)})</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-2">
          {members.map((m) => {
            const on = picked.includes(m.id) || m.id === leadId;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                onClick={() => m.id !== leadId && toggle(m.id)}
                className={cn("flex items-center gap-2.5 rounded-lg border p-2 text-left transition-all duration-200 hover:-translate-y-0.5", on ? "border-blue-500/60 bg-blue-500/10" : "border-[var(--color-border)] hover:bg-[var(--color-hover)]")}
              >
                <Avatar person={m} size="sm" />
                <span className="min-w-0 flex-1"><span className="block text-xs font-semibold truncate">{m.name}</span><span className="block text-[10px] text-[var(--color-text-muted)] truncate">{m.id === leadId ? "Team lead" : m.title}</span></span>
                {on && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
        <AdminButton type="button" variant="outline" onClick={() => router.push(href(team ? `teams/${team.id}` : "teams"))}>Cancel</AdminButton>
        <AdminButton type="submit" isLoading={saving}>{team ? "Save team" : "Create team"}</AdminButton>
      </div>
    </form>
  );
}
