"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Info, Layers, User } from "lucide-react";
import { toast } from "sonner";
import { useDeliveryStore } from "@/store/delivery-store";
import { DEMO_TODAY, VIEWERS, type DeliveryMode } from "@/mocks/delivery-dashboards";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  PageFrame,
  Panel,
  useDemoLoad,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { cn } from "@/lib/utils";

interface FormState {
  name: string;
  client: string;
  mode: DeliveryMode;
  teamId: string;
  startDate: string;
  dueDate: string;
  description: string;
}

export default function ManagerCreateProjectPage() {
  const href = useRoleHref("manager");
  const router = useRouter();
  const { status, retry } = useDemoLoad(250);
  const teams = useDeliveryStore((s) => s.teams);
  const people = useDeliveryStore((s) => s.people);
  const createProject = useDeliveryStore((s) => s.createProject);
  const [form, setForm] = useState<FormState>({
    name: "",
    client: "",
    mode: "STRUCTURED",
    teamId: "t-platform",
    startDate: DEMO_TODAY,
    dueDate: "",
    description: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (form.name.trim().length < 3) next.name = "Enter a project name (at least 3 characters).";
    if (!form.client.trim()) next.client = "Enter the client or internal sponsor.";
    if (!form.dueDate) next.dueDate = "Pick a delivery date.";
    else if (form.dueDate <= form.startDate) next.dueDate = "Delivery date must be after the start date.";
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    window.setTimeout(() => {
      const project = createProject(
        { ...form, name: form.name.trim(), client: form.client.trim(), description: form.description.trim() },
        VIEWERS.manager.id
      );
      toast.success(`${project.name} created`, { description: "Next: assign the first pieces of work." });
      router.push(href(`projects/${project.id}`));
    }, 600);
  };

  const teamMembers = people.filter((p) => p.teamId === form.teamId);

  return (
    <PageFrame
      crumbs={[{ label: "Manager", href: href() }, { label: "Portfolio", href: href("projects") }, { label: "Create project" }]}
      back={{ href: href("projects"), label: "Back to portfolio" }}
      title="Create project"
      description="Set up the basics. You can add milestones and assign work right after."
      status={status}
      onRetry={retry}
      skeleton="detail"
    >
      <form onSubmit={submit} noValidate className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel className="xl:col-span-2" title="Project details" icon={FolderPlus}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminInput label="Project name" placeholder="e.g. Gemini Checkout Redesign" value={form.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
            <AdminInput label="Client / sponsor" placeholder="e.g. Northwind Retail" value={form.client} onChange={(e) => set("client", e.target.value)} error={errors.client} />
            <AdminSelect
              label="Delivery team"
              value={form.teamId}
              onChange={(e) => set("teamId", e.target.value)}
              options={teams.map((t) => ({ label: `${t.name} — ${t.focus}`, value: t.id }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <AdminInput label="Start date" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
              <AdminInput label="Delivery date" type="date" value={form.dueDate} min={form.startDate} onChange={(e) => set("dueDate", e.target.value)} error={errors.dueDate} />
            </div>
            <div className="md:col-span-2">
              <AdminTextarea label="Goal & scope" rows={4} placeholder="What will be delivered, for whom, and how will we know it is done?" value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
          </div>
          <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" onClick={() => router.push(href("projects"))}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" isLoading={saving}>
              <FolderPlus className="w-3.5 h-3.5" /> Create project
            </AdminButton>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Delivery mode" description="Decides how progress is reported" icon={Layers} iconTone="violet">
            <div className="space-y-2.5" role="radiogroup" aria-label="Delivery mode">
              {(
                [
                  { value: "STRUCTURED", title: "Structured", icon: Layers, text: "Weighted tasks, approvals and QA review. Best for teams." },
                  { value: "INDIVIDUAL", title: "Individual", icon: User, text: "One accountable developer reports progress through check-ins." },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={form.mode === opt.value}
                  onClick={() => set("mode", opt.value)}
                  className={cn(
                    "w-full text-left rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5",
                    form.mode === opt.value
                      ? "border-blue-500/60 bg-blue-500/10 shadow-sm"
                      : "border-[var(--color-border)] bg-[var(--color-app-bg)] hover:border-blue-500/30"
                  )}
                >
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <opt.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" /> {opt.title}
                  </span>
                  <span className="mt-1 block text-[11px] text-[var(--color-text-secondary)]">{opt.text}</span>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Who joins" description={`${teamMembers.length} people in the selected team`} icon={Info} iconTone="cyan">
            <ul className="space-y-1.5 text-xs">
              {teamMembers.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{p.name}</span>
                  <span className="text-[11px] text-[var(--color-text-muted)] truncate">{p.title}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </form>
    </PageFrame>
  );
}
