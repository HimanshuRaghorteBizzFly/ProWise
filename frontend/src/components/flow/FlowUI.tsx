"use client";

import React, { useEffect, useState } from "react";
import { ExternalLink, FileText, GitCommit, GitPullRequest, ImageIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AdminButton, ProgressBar, StatusBadge } from "@/components/delivery/DeliveryUI";
import { changeError, dateTimeText } from "@/components/developer/DevUI";
import { apiClient } from "@/lib/api";
import type { FileViewDto, GitHubActivityDto } from "@/types/flow";
import type { EvidenceItemDto } from "@/types/work";

/** Board columns (owner wording): Created -> In progress -> In review -> Completed. */
export const BOARD_COLUMNS = [
  { state: "TODO", label: "Created" },
  { state: "IN_PROGRESS", label: "In progress" },
  { state: "IN_REVIEW", label: "In review" },
  { state: "DONE", label: "Completed" },
] as const;

export type BoardState = (typeof BOARD_COLUMNS)[number]["state"];

export function columnLabel(state: string): string {
  return BOARD_COLUMNS.find((c) => c.state === state)?.label ?? (state === "CANCELLED" ? "Cancelled" : state);
}

/**
 * One progress figure with its method, never blended: Team = approved points of the active scope; Solo = the approved
 * submission. "Not reported" while nothing is approved. A Solo figure awaiting review is shown separately.
 */
export function ProgressFigure({ percent, label, method, pending, compact = false }: {
  percent: number | null | undefined;
  label: string;
  method?: string | null;
  pending?: number | null;
  compact?: boolean;
}) {
  const reported = percent !== null && percent !== undefined;
  return (
    <div className="min-w-0 space-y-1" data-testid="progress-figure">
      <div className="flex items-baseline gap-2 min-w-0">
        <span className={compact ? "text-sm font-bold tabular-nums" : "text-2xl font-bold tabular-nums"}>
          {reported ? `${percent}%` : label}
        </span>
        {method && <span className="text-[11px] text-[var(--color-text-muted)] truncate">{method}</span>}
      </div>
      {reported && <ProgressBar value={percent ?? 0} size="sm" />}
      {!reported && !compact && (
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Nothing is approved yet. Git activity, time and task counts never set progress.
        </p>
      )}
      {pending !== null && pending !== undefined && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300" data-testid="pending-figure">
          {Number(pending)}% reported, not yet approved
        </p>
      )}
    </div>
  );
}

/** One large progress ring with the % (or "Not reported") as text and the method beneath. Animates on change. */
export function ProgressRing({ percent, label, method, size = 168 }: {
  percent: number | null | undefined;
  label: string;
  method?: string | null;
  size?: number;
}) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const reported = percent !== null && percent !== undefined;
  const value = reported ? Math.max(0, Math.min(100, percent)) : 0;
  return (
    <figure className="flex flex-col items-center gap-2" data-testid="progress-ring">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
          aria-label={reported ? `${value}% complete${method ? `, ${method}` : ""}` : label}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-elevated)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#3B82F6" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <span className={reported ? "text-3xl font-bold tabular-nums" : "text-sm font-semibold text-[var(--color-text-secondary)]"}>
            {reported ? `${value}%` : label}
          </span>
        </div>
      </div>
      {method && <figcaption className="text-xs text-[var(--color-text-muted)] text-center">{method}</figcaption>}
    </figure>
  );
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** Downloads through the authenticated client (the token never goes into a link). */
export async function downloadFile(file: Pick<FileViewDto, "id" | "name">) {
  try {
    const blob = await apiClient.flow.fileBlob(file.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch (error) {
    toast.error(changeError(error));
  }
}

/** An image preview loaded with the session (object URL), with an accessible fallback. */
export function AuthImage({ fileId, alt, className }: { fileId: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    apiClient.flow.fileBlob(fileId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);
  if (failed) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
        <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" /> Image unavailable
      </div>
    );
  }
  if (!url) return <div className={`animate-pulse bg-[var(--color-elevated)] rounded-md ${className ?? "h-24 w-36"}`} aria-label={`Loading ${alt}`} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className ?? "h-24 w-36 rounded-md border border-[var(--color-border)] object-cover"} />;
}

const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

/** Evidence items of a submission: links open in a new tab, files preview (images) or download, SHAs are labelled. */
export function EvidenceList({ items, files, filesAreImages = false }: {
  items: EvidenceItemDto[];
  files?: FileViewDto[];
  /** Solo submissions only attach screenshots: preview every FILE item. */
  filesAreImages?: boolean;
}) {
  if (items.length === 0) return <p className="text-xs text-[var(--color-text-muted)]">No evidence attached.</p>;
  return (
    <ul className="space-y-2">
      {items.map((item, index) => {
        const listed = item.type === "FILE" ? files?.find((f) => f.id === item.ref) : undefined;
        const file = listed ?? (item.type === "FILE" && filesAreImages
          ? { id: item.ref, name: item.label || "screenshot", content_type: "image/*" } : undefined);
        return (
          <li key={`${item.type}-${item.ref}-${index}`} className="text-xs min-w-0">
            <span className="mr-1.5 text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">{item.type.replace("_", " ")}</span>
            {item.type === "FILE" ? (
              file && file.content_type.startsWith("image/") ? (
                <span className="block mt-1">
                  <AuthImage fileId={file.id} alt={item.label || file.name} />
                  <button type="button" className="mt-1 text-blue-600 dark:text-blue-400 hover:underline" onClick={() => downloadFile(file)}>
                    {file.name}
                  </button>
                </span>
              ) : (
                <button type="button" className="text-blue-600 dark:text-blue-400 hover:underline"
                  onClick={() => downloadFile({ id: item.ref, name: item.label || "file" })}>
                  {item.label || file?.name || "Download file"}
                </button>
              )
            ) : /^https?:\/\//.test(item.ref) ? (
              <a href={item.ref} target="_blank" rel="noreferrer noopener" className="text-blue-600 dark:text-blue-400 hover:underline break-all">
                {item.label || item.ref}
              </a>
            ) : (
              <span className={COMMIT_SHA.test(item.ref) ? "font-mono" : "break-words"}>
                {item.label ? `${item.label}: ` : ""}{item.ref}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Commits and pull requests linked to the task by its key. Evidence only: never progress. */
export function CommitList({ items, onRefresh, refreshing, empty }: {
  items: GitHubActivityDto[];
  onRefresh?: () => void;
  refreshing?: boolean;
  empty: string;
}) {
  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">{empty}</p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]" aria-label="Linked commits">
          {items.map((c) => (
            <li key={c.id} className="py-2 flex items-start gap-2 min-w-0">
              {c.type === "PULL_REQUEST"
                ? <GitPullRequest className="w-3.5 h-3.5 mt-0.5 shrink-0 text-violet-600" aria-hidden="true" />
                : <GitCommit className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate" title={c.message ?? c.title}>{c.title}</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {c.type === "PULL_REQUEST" ? `#${c.pr_number}${c.state ? ` · ${c.state}` : ""}` : (c.sha ?? "").slice(0, 7)}
                  {" · "}{c.author} · {dateTimeText(c.occurred_at)}
                  {c.match_reason ? ` · matched by ${c.match_reason.toLowerCase().replace("_", " ")}` : ""}
                </p>
              </div>
              {c.url && (
                <a href={c.url} target="_blank" rel="noreferrer noopener" className="shrink-0 text-blue-600 dark:text-blue-400"
                  aria-label={`Open ${c.type === "PULL_REQUEST" ? "pull request" : "commit"} on GitHub`}>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {onRefresh && (
        <AdminButton size="xs" variant="outline" onClick={onRefresh} isLoading={refreshing}>
          <RefreshCw className="w-3 h-3" /> Fetch from GitHub
        </AdminButton>
      )}
      <p className="text-[10px] text-[var(--color-text-muted)]">Commits are evidence only. They never set completion or progress.</p>
    </div>
  );
}

export function FileRow({ file, onRemove }: { file: FileViewDto; onRemove?: () => void }) {
  return (
    <li className="flex items-center gap-2 py-1.5 text-xs min-w-0">
      <FileText className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
      <button type="button" className="truncate text-left text-blue-600 dark:text-blue-400 hover:underline" onClick={() => downloadFile(file)}>
        {file.name}
      </button>
      <span className="shrink-0 text-[10px] text-[var(--color-text-muted)]">{formatBytes(file.size)}</span>
      {onRemove && (
        <AdminButton type="button" size="xs" variant="ghost" onClick={onRemove} aria-label={`Remove ${file.name}`}>
          Remove
        </AdminButton>
      )}
    </li>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const label = role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
  return <StatusBadge label={label} tone="neutral" />;
}
