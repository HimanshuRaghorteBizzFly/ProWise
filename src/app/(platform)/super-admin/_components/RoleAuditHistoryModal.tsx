"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  History,
  Info,
  Search,
  Shield,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminRole, SuperAdminActivity } from "../_types";
import { useSuperAdminStore } from "../_store/useSuperAdminStore";
import {
  AdminButton,
  AdminModal,
  AdminSelect,
  StatusBadge,
} from "./SuperAdminPrimitives";

interface RoleAuditHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: AdminRole[];
  initialRoleFilter?: string;
}

export const RoleAuditHistoryModal: React.FC<RoleAuditHistoryModalProps> = ({
  isOpen,
  onClose,
  roles,
  initialRoleFilter = "ALL",
}) => {
  const activities = useSuperAdminStore((s) => s.activities);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(initialRoleFilter);
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");

  React.useEffect(() => {
    if (initialRoleFilter) setSelectedRoleId(initialRoleFilter);
  }, [initialRoleFilter]);

  // Filter activities for Role governance
  const roleActivities = useMemo(() => {
    return activities.filter((act) => {
      // Must be related to Role or Security / Access
      const isRoleRelated =
        act.category === "ROLE" ||
        act.action.toLowerCase().includes("role") ||
        act.action.toLowerCase().includes("permission") ||
        act.summary.toLowerCase().includes("role");

      if (!isRoleRelated) return false;

      // Filter by role target if specified
      if (selectedRoleId !== "ALL") {
        const targetRole = roles.find((r) => r.id === selectedRoleId);
        if (targetRole) {
          const matchTarget =
            act.targetLabel?.toLowerCase().includes(targetRole.name.toLowerCase()) ||
            act.summary.toLowerCase().includes(targetRole.name.toLowerCase()) ||
            act.summary.toLowerCase().includes(targetRole.slug.toLowerCase());
          if (!matchTarget) return false;
        }
      }

      // Filter by severity
      if (severityFilter !== "ALL" && act.severity !== severityFilter) {
        return false;
      }

      // Filter by text search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          act.action.toLowerCase().includes(q) ||
          act.summary.toLowerCase().includes(q) ||
          act.actorName.toLowerCase().includes(q) ||
          act.actorEmail.toLowerCase().includes(q) ||
          (act.targetLabel && act.targetLabel.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [activities, roles, selectedRoleId, severityFilter, searchQuery]);

  // Export audit logs as CSV
  const exportAuditLog = () => {
    if (roleActivities.length === 0) {
      toast.error("No audit logs to export");
      return;
    }

    const headers = ["ID", "Timestamp", "Category", "Action", "Actor", "Email", "Target", "Severity", "Summary"];
    const rows = roleActivities.map((a) => [
      a.id,
      a.timestamp,
      a.category,
      `"${a.action.replace(/"/g, '""')}"`,
      `"${a.actorName}"`,
      a.actorEmail,
      `"${a.targetLabel || ""}"`,
      a.severity,
      `"${a.summary.replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `prowise_rbac_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${roleActivities.length} RBAC audit records`);
  };

  if (!isOpen) return null;

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title="Role & RBAC Audit History"
      description="Complete chronological timeline of role definitions, permission mutations, and member authorizations."
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Filters Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search actions, actors, or targets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="sm:col-span-4">
            <AdminSelect
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="text-xs py-1.5"
            >
              <option value="ALL">All Roles & Scopes</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.scope || "ORG"})
                </option>
              ))}
            </AdminSelect>
          </div>

          <div className="sm:col-span-3">
            <AdminSelect
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs py-1.5"
            >
              <option value="ALL">All Severities</option>
              <option value="INFO">Info</option>
              <option value="WARNING">Warning</option>
              <option value="CRITICAL">Critical</option>
            </AdminSelect>
          </div>
        </div>

        {/* Audit Count and Export */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-1">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-500" />
            <span>
              Showing <strong className="text-slate-900 dark:text-white">{roleActivities.length}</strong> recorded audit events
            </span>
          </div>

          <button
            type="button"
            onClick={exportAuditLog}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        {/* Timeline Log */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 max-h-[52vh] overflow-y-auto bg-white dark:bg-slate-900">
          {roleActivities.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <Shield className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              No role audit records match the current filter.
            </div>
          ) : (
            roleActivities.map((act) => {
              const date = new Date(act.timestamp);
              const formattedDate = date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const formattedTime = date.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={act.id}
                  className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition flex items-start gap-3.5"
                >
                  {/* Severity indicator */}
                  <div className="mt-0.5 flex-shrink-0">
                    {act.severity === "CRITICAL" ? (
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                        <ShieldAlert className="w-4 h-4" />
                      </div>
                    ) : act.severity === "WARNING" ? (
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Info className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Body content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-slate-900 dark:text-white">
                          {act.action}
                        </span>
                        {act.targetLabel && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {act.targetLabel}
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            act.severity === "CRITICAL"
                              ? "bg-red-500/10 text-red-600"
                              : act.severity === "WARNING"
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-blue-500/10 text-blue-600"
                          }`}
                        >
                          {act.severity}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        <span>
                          {formattedDate} at {formattedTime}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-2">
                      {act.summary}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <strong className="text-slate-700 dark:text-slate-300 font-medium">
                          {act.actorName}
                        </strong>{" "}
                        ({act.actorEmail})
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <p className="text-[11px] text-slate-400">
            Audit entries are immutably signed and retained for SOC2 compliance.
          </p>
          <AdminButton variant="outline" size="sm" onClick={onClose}>
            Close
          </AdminButton>
        </div>
      </div>
    </AdminModal>
  );
};
