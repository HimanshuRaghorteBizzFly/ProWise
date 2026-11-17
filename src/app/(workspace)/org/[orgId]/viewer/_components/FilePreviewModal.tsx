"use client";

import React from "react";
import {
  X,
  FileText,
  Download,
  Lock,
  ShieldAlert,
  Calendar,
  User,
  CheckCircle2,
} from "lucide-react";
import { ViewerFileItem } from "../_types";
import { Badge } from "@/components/ui/badge";
import { ReadOnlyBadge } from "./ViewerPrimitives";
import { useViewerStore } from "../_store/useViewerStore";

export function FilePreviewModal({
  file,
  onClose,
}: {
  file: ViewerFileItem | null;
  onClose: () => void;
}) {
  const { downloadPermittedFile } = useViewerStore();

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-app-surface border border-app-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-app-border flex items-center justify-between bg-app-sidebar/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-app-text-primary">{file.name}</span>
                <Badge variant="outline">{file.category}</Badge>
                <ReadOnlyBadge />
              </div>
              <div className="text-xs text-app-text-muted mt-0.5">
                {file.projectName} ({file.projectKey}) • {file.size}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text-primary hover:bg-app-hover transition-colors"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
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
              {/* Watermark Banner */}
              <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-app-border text-[11px] text-app-text-muted select-none">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>PROWISE AUDIT COPY • READ-ONLY PREVIEW</span>
                </div>
                <span>Author: {file.author}</span>
              </div>

              {/* Code / Text viewer */}
              <div className="relative rounded-xl border border-app-border bg-slate-950 text-slate-200 p-4 font-mono text-xs overflow-x-auto leading-relaxed shadow-inner">
                <pre>{file.previewContent}</pre>
              </div>

              {/* Metadata */}
              <div className="text-[11px] text-app-text-muted flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-app-border">
                <span>Last Updated: {new Date(file.updatedAt).toLocaleString()}</span>
                <span>Format: {file.format.toUpperCase()}</span>
                <span className="text-green-600 dark:text-green-400 font-medium">
                  ✓ Permitted Read-Only Download
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-app-border bg-app-sidebar/50 flex items-center justify-between">
          <div>
            {!file.isRestricted && file.permittedDownload && (
              <button
                onClick={() => downloadPermittedFile(file)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Download Permitted File</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-app-border bg-app-surface text-app-text-primary hover:bg-app-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
