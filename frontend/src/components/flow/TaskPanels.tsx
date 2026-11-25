"use client";

import React from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";

import { SectionGate, changeError, dateTimeText } from "@/components/developer/DevUI";
import { useOrgId } from "@/components/org-console/useRoleApi";
import { apiClient } from "@/lib/api";
import type { FileViewDto } from "@/types/flow";
import { CommitList, formatBytes } from "./FlowUI";
import { useFlowMutation, useTaskActivity, useTaskCommits, useUploadFile } from "./useFlowApi";

const SCREENSHOT_MAX = 5 * 1024 * 1024;
const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Commits and pull requests linked to the task (fetched on submit, by webhook, or on demand). */
export function TaskCommits({ itemId, itemKey }: { itemId: string; itemKey: string }) {
  const commits = useTaskCommits(itemId);
  const refresh = useFlowMutation(() => apiClient.flow.refreshTaskCommits(itemId));
  return (
    <SectionGate state={commits} what="commits">
      {(items) => (
        <CommitList items={items} refreshing={refresh.isPending}
          empty={`No commits linked yet. Put ${itemKey} in a commit message, branch name or pull request title.`}
          onRefresh={() => refresh.mutate(undefined, {
            onSuccess: (result) => {
              if (!result.connected) toast.info("This project has no connected GitHub repository yet. Ask an admin to connect one.");
              else if (!result.ok) toast.error(result.problem ?? "GitHub could not be read.");
              else toast.success(result.linked === 0 ? "No new commits found." : `${result.linked} new item${result.linked === 1 ? "" : "s"} linked.`);
            },
            onError: (e) => toast.error(changeError(e)),
          })} />
      )}
    </SectionGate>
  );
}

const ACTION_LABEL: Record<string, string> = {
  "work_item.created": "Created",
  "work_item.assigned": "Assignment changed",
  "work_item.started": "Moved to In progress",
  "work_item.submitted": "Submitted for review",
  "work_item.accepted": "Approved and completed",
  "work_item.completed": "Completed",
  "work_item.changes_requested": "Changes requested",
  "work_item.reopened": "Reopened",
  "work_item.updated": "Details changed",
  "work_item.checks_defined": "Required checks changed",
  "work_item.check_marked": "Check marked",
  "work_item.retired": "Retired",
};

/** Append-only history of the task. */
export function TaskActivity({ itemId }: { itemId: string }) {
  const activity = useTaskActivity(itemId);
  return (
    <SectionGate state={activity} what="activity">
      {(rows) => rows.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">No activity yet.</p>
      ) : (
        <ol className="relative border-l border-[var(--color-border)] ml-1.5 space-y-3" aria-label="Task activity">
          {rows.map((row, i) => (
            <li key={`${row.occurred_at}-${i}`} className="ml-4">
              <span className="absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full bg-blue-500" aria-hidden="true" />
              <p className="text-xs font-medium">{ACTION_LABEL[row.action] ?? row.action}</p>
              {row.reason && <p className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">{row.reason}</p>}
              <p className="text-[10px] text-[var(--color-text-muted)]">{row.actor_email ?? "System"} · {dateTimeText(row.occurred_at)}</p>
            </li>
          ))}
        </ol>
      )}
    </SectionGate>
  );
}

/** Screenshot upload (PNG, JPG or WebP, 5 MB) for a task or a Solo project; returns the stored file. */
export function ScreenshotUploader({ target, onUploaded, disabled }: {
  target: { workItemId?: string; projectId?: string };
  onUploaded: (file: FileViewDto) => void;
  disabled?: boolean;
}) {
  const orgId = useOrgId();
  const upload = useUploadFile(orgId);
  const pick = (files: FileList | null) => {
    Array.from(files ?? []).forEach((file) => {
      if (!SCREENSHOT_TYPES.includes(file.type)) return toast.error(`${file.name}: screenshots must be PNG, JPG or WebP.`);
      if (file.size > SCREENSHOT_MAX) return toast.error(`${file.name} is larger than ${formatBytes(SCREENSHOT_MAX)}.`);
      upload.mutate({ file, kind: "SCREENSHOT", ...target }, {
        onSuccess: onUploaded,
        onError: (e) => toast.error(`${file.name}: ${changeError(e)}`),
      });
    });
  };
  return (
    <label className={`inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-medium ${disabled ? "opacity-50" : "cursor-pointer hover:bg-[var(--color-hover)]"}`}>
      <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
      {upload.isPending ? "Uploading…" : "Add screenshot"}
      <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" disabled={disabled}
        aria-label="Add screenshot (PNG, JPG or WebP, up to 5 MB)" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
    </label>
  );
}
