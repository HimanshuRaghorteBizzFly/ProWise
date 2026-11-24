"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MessageSquare, MessageSquareText, Plus, Send } from "lucide-react";
import { toast } from "sonner";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { AdminModal } from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  EmptyStateView,
  PageFrame,
  Panel,
  StatusBadge,
} from "@/components/delivery/DeliveryUI";
import { DecisionBadge, DevGate, SectionGate, changeError, dateTimeText } from "@/components/developer/DevUI";
import {
  useDevDiscussions,
  useDevMutation,
  useDevProjects,
  useDiscussionMessages,
  useMyFeedback,
} from "@/components/developer/useDeveloperData";
import { useOrgId } from "@/components/org-console/useRoleApi";
import { developerApi } from "@/lib/developer-api";

const MAX_MESSAGE = 4000;

function Thread({ discussionId }: { discussionId: string }) {
  const messages = useDiscussionMessages(discussionId);
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const send = useDevMutation((message: string) => developerApi.sendDiscussionMessage(discussionId, message));
  const error = !text.trim() ? "Write a message first." : text.length > MAX_MESSAGE ? `Keep it under ${MAX_MESSAGE} characters.` : undefined;

  return (
    <div className="space-y-3">
      <SectionGate state={messages} what="the messages">
        {(list) =>
          list.length === 0 ? (
            <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No messages yet. Start the conversation.</p>
          ) : (
            <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {list.map((m) => (
                <li key={m.id} className="rounded-lg border border-[var(--color-border)] p-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--color-text-primary)]">{m.authorName || "Member"}</span>
                    <span className="text-[11px] text-[var(--color-text-muted)]">{dateTimeText(m.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[var(--color-text-secondary)]">{m.content || m.message}</p>
                </li>
              ))}
            </ul>
          )
        }
      </SectionGate>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (error) return;
          send.mutate(text.trim(), {
            onSuccess: () => {
              setText("");
              setTouched(false);
            },
            onError: (err) => toast.error(changeError(err)),
          });
        }}
      >
        <AdminTextarea
          aria-label="Message"
          placeholder="Write a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          error={touched ? error : undefined}
          helperText={`${text.length}/${MAX_MESSAGE}`}
        />
        <div className="flex justify-end">
          <AdminButton type="submit" size="sm" isLoading={send.isPending} disabled={send.isPending}>
            <Send className="mr-1 h-3.5 w-3.5" /> Send
          </AdminButton>
        </div>
      </form>
    </div>
  );
}

export default function DeveloperDiscussionsPage() {
  const orgId = useOrgId();
  const home = `/org/${orgId}/developer/dashboard`;
  const discussions = useDevDiscussions();
  const projects = useDevProjects();
  const feedback = useMyFeedback();
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ projectId: "", title: "", category: "GENERAL", initialMessage: "" });
  const [touched, setTouched] = useState(false);

  const formErrors: Record<string, string> = {};
  if (!form.projectId) formErrors.projectId = "Choose a project.";
  if (!form.title.trim()) formErrors.title = "Title is required.";
  else if (form.title.trim().length > 200) formErrors.title = "Keep the title under 200 characters.";
  if (form.initialMessage.length > MAX_MESSAGE) formErrors.initialMessage = `Keep it under ${MAX_MESSAGE} characters.`;

  const create = useDevMutation((f: typeof form) =>
    developerApi.createDiscussion({
      projectId: f.projectId,
      title: f.title.trim(),
      category: f.category,
      initialMessage: f.initialMessage.trim() || undefined,
    }),
  );

  const projectName = (id: string) =>
    projects.kind === "ready" ? projects.data.find((p) => p.id === id)?.name ?? "Project" : "Project";

  return (
    <PanelLayout title="Team & Comments">
      <PageFrame
        crumbs={[{ label: "Developer", href: home }, { label: "Team & Comments" }]}
        title="Team & Comments"
        description="Project discussions and reviewer comments on your submissions."
        actions={
          <AdminButton size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> New discussion
          </AdminButton>
        }
      >
        <DevGate state={discussions} what="Discussions" back={{ href: home, label: "Back to dashboard" }}>
          {(list) =>
            list.length === 0 ? (
              <EmptyStateView
                icon={MessageSquare}
                title="No discussions yet"
                description="Start a discussion on one of your projects."
                actionLabel="New discussion"
                onAction={() => setOpen(true)}
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <Panel title="Discussions" icon={MessageSquare}>
                  <ul className="space-y-1">
                    {list.map((d) => {
                      const active = (selected ?? list[0].id) === d.id;
                      return (
                        <li key={d.id}>
                          <button
                            type="button"
                            onClick={() => setSelected(d.id)}
                            aria-current={active}
                            className={`w-full rounded-lg border p-2.5 text-left text-xs transition-colors ${
                              active
                                ? "border-blue-500/40 bg-blue-500/10"
                                : "border-[var(--color-border)] hover:bg-[var(--color-hover)]"
                            }`}
                          >
                            <span className="block truncate font-semibold text-[var(--color-text-primary)]">{d.title}</span>
                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                              {projectName(d.projectId)} · {dateTimeText(d.updatedAt || d.createdAt)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Panel>
                <Panel title={list.find((d) => d.id === (selected ?? list[0].id))?.title ?? "Messages"} icon={MessageSquareText}>
                  <Thread key={selected ?? list[0].id} discussionId={selected ?? list[0].id} />
                </Panel>
              </div>
            )
          }
        </DevGate>

        <Panel title="Reviewer comments" description="Decisions and reasons on your submissions" icon={MessageSquareText}>
          <SectionGate state={feedback} what="reviewer comments">
            {(items) =>
              items.length === 0 ? (
                <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No review decisions on your work yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {items.map((f) => (
                    <li key={f.id} className="space-y-1 py-2.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/org/${orgId}/developer/tasks/${encodeURIComponent(f.work_item_id)}`}
                          className="font-mono font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {f.key}
                        </Link>
                        <span className="text-[var(--color-text-primary)]">{f.title}</span>
                        <DecisionBadge decision={f.decision} />
                        <StatusBadge label={`Revision ${f.revision}`} tone="neutral" />
                      </div>
                      {f.reason && <p className="whitespace-pre-wrap text-[var(--color-text-secondary)]">{f.reason}</p>}
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        {f.reviewer_email ?? "Reviewer"} · {dateTimeText(f.decided_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )
            }
          </SectionGate>
        </Panel>

        <AdminModal isOpen={open} onClose={() => setOpen(false)} title="New discussion" maxWidth="md">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setTouched(true);
              if (Object.keys(formErrors).length > 0) return;
              create.mutate(form, {
                onSuccess: (d) => {
                  toast.success("Discussion started.");
                  setOpen(false);
                  setSelected(d.id);
                  setForm({ projectId: "", title: "", category: "GENERAL", initialMessage: "" });
                  setTouched(false);
                },
                onError: (err) => toast.error(changeError(err)),
              });
            }}
          >
            <SectionGate state={projects} what="your projects">
              {(list) => (
                <AdminSelect
                  label="Project"
                  value={form.projectId}
                  onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                  error={touched ? formErrors.projectId : undefined}
                  options={[{ label: "Choose a project", value: "" }, ...list.map((p) => ({ label: `${p.name} (${p.code})`, value: p.id }))]}
                />
              )}
            </SectionGate>
            <AdminInput
              label="Title"
              value={form.title}
              maxLength={200}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              error={touched ? formErrors.title : undefined}
            />
            <AdminSelect
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={[
                { label: "General", value: "GENERAL" },
                { label: "Question", value: "QUESTION" },
                { label: "Technical", value: "TECHNICAL" },
              ]}
            />
            <AdminTextarea
              label="First message (optional)"
              value={form.initialMessage}
              onChange={(e) => setForm({ ...form, initialMessage: e.target.value })}
              error={touched ? formErrors.initialMessage : undefined}
            />
            <div className="flex justify-end gap-2 pt-1">
              <AdminButton type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </AdminButton>
              <AdminButton type="submit" size="sm" isLoading={create.isPending} disabled={create.isPending}>
                Start discussion
              </AdminButton>
            </div>
          </form>
        </AdminModal>
      </PageFrame>
    </PanelLayout>
  );
}
