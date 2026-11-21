"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FileText,
  Download,
  Lock,
  ShieldAlert,
  Calendar,
  User,
  CheckCircle2,
  Server,
  ShieldCheck,
  Sparkles,
  FileCode,
  Layers,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { ViewerFileItem } from "../_types";
import { Badge } from "@/components/ui/badge";
import { ReadOnlyBadge } from "./ViewerPrimitives";
import { useViewerStore } from "../_store/useViewerStore";

function parseJsonSafe(content: string): any | null {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function formatKeyLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function isOpenApiSpec(obj: any): boolean {
  return Boolean(obj && typeof obj === "object" && (obj.openapi || obj.swagger || (obj.info && obj.paths)));
}

function isTestSuiteReport(obj: any): boolean {
  return Boolean(obj && typeof obj === "object" && (obj.totalTests !== undefined || obj.suite !== undefined));
}

function OpenApiFriendlyView({ data }: { data: any }) {
  const info = data.info || {};
  const paths = data.paths || {};
  const pathEntries = Object.entries(paths);

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <div className="p-4 sm:p-5 rounded-xl border border-app-border bg-app-bg space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                API Specification
              </span>
              {info.version && (
                <span className="text-xs font-mono font-medium text-app-text-secondary bg-app-surface px-2 py-0.5 rounded border border-app-border">
                  v{info.version}
                </span>
              )}
              {data.openapi && (
                <span className="text-[11px] text-app-text-muted">
                  OpenAPI {data.openapi}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-app-text-primary">
              {info.title || "API Service Specification"}
            </h3>
          </div>
        </div>

        {info.description && (
          <p className="text-xs sm:text-sm text-app-text-secondary leading-relaxed bg-app-surface/80 p-3.5 rounded-xl border border-app-border/70">
            {info.description}
          </p>
        )}
      </div>

      {/* Endpoints & Operations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-app-text-muted flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-blue-500" />
            <span>Service Operations &amp; Endpoints ({pathEntries.length})</span>
          </h4>
          <span className="text-[11px] text-app-text-muted">Interactive Contract</span>
        </div>

        <div className="space-y-3">
          {pathEntries.map(([pathName, methods]: [string, any]) => {
            const methodEntries = typeof methods === "object" && methods !== null ? Object.entries(methods) : [];

            return (
              <div key={pathName} className="rounded-xl border border-app-border bg-app-bg overflow-hidden shadow-2xs">
                {/* Path bar */}
                <div className="px-4 py-2.5 bg-app-surface border-b border-app-border flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-app-text-muted">
                    Route
                  </span>
                  <span className="font-mono text-xs font-bold text-app-text-primary">
                    {pathName}
                  </span>
                </div>

                {/* Operations inside this path */}
                <div className="p-4 space-y-3">
                  {methodEntries.map(([methodName, op]: [string, any]) => {
                    const methodUpper = methodName.toUpperCase();
                    const methodTone =
                      methodUpper === "POST"
                        ? "bg-blue-600/10 text-blue-600 border-blue-200 dark:border-blue-900"
                        : methodUpper === "GET"
                        ? "bg-emerald-600/10 text-emerald-600 border-emerald-200 dark:border-emerald-900"
                        : methodUpper === "PUT" || methodUpper === "PATCH"
                        ? "bg-amber-600/10 text-amber-600 border-amber-200 dark:border-amber-900"
                        : "bg-rose-600/10 text-rose-600 border-rose-200 dark:border-rose-900";

                    const responses = op?.responses || {};
                    const responseEntries = Object.entries(responses);

                    return (
                      <div key={methodName} className="space-y-2.5">
                        <div className="flex items-start gap-2.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${methodTone}`}
                          >
                            {methodUpper}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-app-text-primary">
                            {op?.summary || "Execute operation"}
                          </span>
                        </div>

                        {op?.description && (
                          <p className="text-xs text-app-text-secondary pl-1">
                            {op.description}
                          </p>
                        )}

                        {/* Outcomes / Responses */}
                        {responseEntries.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-app-border/60 space-y-1.5">
                            <span className="text-[10px] uppercase font-semibold text-app-text-muted tracking-wider block">
                              Expected Business Outcomes:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {responseEntries.map(([code, resp]: [string, any]) => {
                                const isSuccess = code.startsWith("2");
                                return (
                                  <div
                                    key={code}
                                    className="p-2.5 rounded-lg border border-app-border/80 bg-app-surface/60 flex items-start gap-2 text-xs"
                                  >
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                        isSuccess
                                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                          : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                      }`}
                                    >
                                      {code}
                                    </span>
                                    <span className="text-app-text-secondary text-[11px] leading-tight mt-0.5">
                                      {resp?.description || (isSuccess ? "Success" : "Error")}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TestSuiteFriendlyView({ data }: { data: any }) {
  const criteriaMet = data.criteriaMet === true || data.failed === 0;

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <div className="p-4 sm:p-5 rounded-xl border border-app-border bg-app-bg space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900">
                QA Verification Artifact
              </span>
              {data.version && (
                <span className="text-xs font-mono font-medium text-app-text-secondary bg-app-surface px-2 py-0.5 rounded border border-app-border">
                  v{data.version}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-app-text-primary">
              {data.suite || "Automated Test Suite Run"}
            </h3>
          </div>
          <Badge variant={criteriaMet ? "success" : "danger"}>
            {criteriaMet ? "✓ All Criteria Met" : "Issues Detected"}
          </Badge>
        </div>

        {data.verifiedBy && (
          <div className="text-xs text-app-text-secondary flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Verified By: <strong className="text-app-text-primary font-medium">{data.verifiedBy}</strong></span>
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-app-border bg-app-bg text-center">
          <div className="text-[10px] uppercase font-semibold text-app-text-muted tracking-wider">Total Tests</div>
          <div className="text-2xl font-bold text-app-text-primary mt-1">{data.totalTests ?? "-"}</div>
        </div>
        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
          <div className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-400 tracking-wider">Passed</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{data.passed ?? "-"}</div>
        </div>
        <div className="p-3.5 rounded-xl border border-app-border bg-app-bg text-center">
          <div className="text-[10px] uppercase font-semibold text-app-text-muted tracking-wider">Failed</div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{data.failed ?? "0"}</div>
        </div>
        <div className="p-3.5 rounded-xl border border-app-border bg-app-bg text-center">
          <div className="text-[10px] uppercase font-semibold text-app-text-muted tracking-wider">Execution</div>
          <div className="text-2xl font-bold text-app-text-primary mt-1">
            {data.executionDurationMs ? `${(data.executionDurationMs / 1000).toFixed(2)}s` : "-"}
          </div>
        </div>
      </div>

      {/* Latency / Performance */}
      {(data.meanLatencyMs !== undefined || data.p99LatencyMs !== undefined) && (
        <div className="p-3.5 rounded-xl border border-app-border bg-app-bg flex items-center justify-between text-xs text-app-text-secondary">
          <span className="text-app-text-muted font-medium">Latency Performance:</span>
          <div className="flex items-center gap-4 font-mono text-xs">
            {data.meanLatencyMs !== undefined && (
              <span>Mean: <strong className="text-app-text-primary">{data.meanLatencyMs} ms</strong></span>
            )}
            {data.p99LatencyMs !== undefined && (
              <span>P99: <strong className="text-app-text-primary">{data.p99LatencyMs} ms</strong></span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GenericJsonFriendlyView({ data }: { data: any }) {
  if (typeof data !== "object" || data === null) {
    return <p className="text-sm text-app-text-secondary">{String(data)}</p>;
  }

  const entries = Object.entries(data);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {entries.map(([key, val]) => {
          const label = formatKeyLabel(key);
          const isPrimitive = typeof val === "string" || typeof val === "number" || typeof val === "boolean";

          return (
            <div key={key} className="p-3.5 rounded-xl border border-app-border bg-app-bg space-y-1">
              <div className="text-[10px] uppercase font-semibold text-app-text-muted tracking-wider">
                {label}
              </div>
              <div className="text-sm font-medium text-app-text-primary">
                {typeof val === "boolean" ? (
                  <Badge variant={val ? "success" : "secondary"}>
                    {val ? "Yes / Enabled" : "No / Disabled"}
                  </Badge>
                ) : isPrimitive ? (
                  String(val)
                ) : Array.isArray(val) ? (
                  <span className="text-xs text-app-text-secondary">{val.length} item(s)</span>
                ) : (
                  <span className="text-xs text-app-text-secondary">Structured Data</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FilePreviewModal({
  file,
  onClose,
}: {
  file: ViewerFileItem | null;
  onClose: () => void;
}) {
  const { downloadPermittedFile } = useViewerStore();
  const [viewMode, setViewMode] = useState<"friendly" | "raw">("friendly");

  // Escape key handler
  useEffect(() => {
    if (!file) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [file, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (file) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [file]);

  if (!file) return null;

  const isJsonFormat = file.format?.toLowerCase() === "json" || file.name?.endsWith(".json");
  const parsedJson = isJsonFormat ? parseJsonSafe(file.previewContent) : null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 md:p-8 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-preview-title"
    >
      <div
        className="w-full max-w-3xl bg-app-surface border border-app-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-app-border flex items-center justify-between bg-app-sidebar/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-mono text-xs font-bold text-app-text-primary">
                  {file.name}
                </span>
                <Badge variant="outline">{file.category}</Badge>
                <ReadOnlyBadge />
              </div>
              <div
                id="file-preview-title"
                className="text-xs text-app-text-muted truncate"
              >
                {file.projectName} ({file.projectKey}) • {file.size}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <span className="hidden sm:inline-block text-[11px] text-app-text-muted font-mono px-1.5 py-0.5 rounded bg-app-hover border border-app-border">
              Esc
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-app-text-muted hover:text-app-text-primary hover:bg-app-hover transition-colors"
              title="Close Preview"
              aria-label="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {file.isRestricted ? (
            <div className="p-8 text-center rounded-xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 my-4 space-y-3">
              <ShieldAlert className="w-10 h-10 text-red-500 mx-auto" />
              <h3 className="text-sm font-bold text-red-800 dark:text-red-300">
                403 Forbidden: Restricted File Clearance
              </h3>
              <p className="text-xs text-red-600 dark:text-red-400 max-w-md mx-auto">
                This document contains system credentials and confidential billing keys. Viewers have read-only access to engineering specifications and delivery milestones only.
              </p>
            </div>
          ) : (
            <>
              {/* Watermark Banner with View Mode Switch */}
              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-app-border text-xs text-app-text-muted flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-app-text-primary">
                    PROWISE AUDIT COPY • READ-ONLY PREVIEW
                  </span>
                  <span className="text-app-text-muted">• Author: {file.author}</span>
                </div>

                {/* Non-tech Friendly vs Raw Source Switch (Only for JSON files) */}
                {isJsonFormat && parsedJson && (
                  <div className="flex items-center bg-app-surface rounded-lg p-0.5 border border-app-border">
                    <button
                      type="button"
                      onClick={() => setViewMode("friendly")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                        viewMode === "friendly"
                          ? "bg-blue-600 text-white shadow-2xs"
                          : "text-app-text-secondary hover:text-app-text-primary"
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Document Overview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("raw")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                        viewMode === "raw"
                          ? "bg-blue-600 text-white shadow-2xs"
                          : "text-app-text-secondary hover:text-app-text-primary"
                      }`}
                    >
                      <FileCode className="w-3 h-3" />
                      <span>Raw Source</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Main Document Content */}
              {isJsonFormat && parsedJson && viewMode === "friendly" ? (
                /* Non-tech User Friendly Rendering */
                <div className="space-y-4 animate-in fade-in duration-150">
                  {isOpenApiSpec(parsedJson) ? (
                    <OpenApiFriendlyView data={parsedJson} />
                  ) : isTestSuiteReport(parsedJson) ? (
                    <TestSuiteFriendlyView data={parsedJson} />
                  ) : (
                    <GenericJsonFriendlyView data={parsedJson} />
                  )}
                </div>
              ) : (
                /* Raw Code / Monospaced Preview */
                <div className="relative rounded-xl border border-app-border bg-slate-950 text-slate-200 p-4 font-mono text-xs overflow-x-auto leading-relaxed shadow-inner">
                  <pre>{file.previewContent}</pre>
                </div>
              )}

              {/* Metadata Footer */}
              <div className="text-[11px] text-app-text-muted flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-app-border">
                <span>Last Updated: {new Date(file.updatedAt).toLocaleString()}</span>
                <span>
                  Format:{" "}
                  <strong className="text-app-text-primary font-medium">
                    {isJsonFormat && viewMode === "friendly"
                      ? "Interactive Document"
                      : file.format.toUpperCase()}
                  </strong>
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Permitted Read-Only Download</span>
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-app-border bg-app-sidebar/60 flex items-center justify-between shrink-0">
          <div>
            {!file.isRestricted && file.permittedDownload && (
              <button
                onClick={() => downloadPermittedFile(file)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Download Permitted File</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-colors shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
