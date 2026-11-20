"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Users,
  Search,
  Filter,
  Mail,
  FolderGit2,
  Shield,
  Layers,
  CheckCircle2,
  UserCheck,
  Eye,
  X,
  Building2,
  Briefcase,
} from "lucide-react";
import {
  ViewerPageHeader,
  ViewerSurfaceCard,
  ViewerKpiCard,
  ViewerFilterBar,
  ViewerPaginationBar,
  ViewerStatusBadge,
  ViewerButton,
  ViewerSerialBadge,
  EmptyState,
} from "../_components/ViewerPrimitives";
import { getViewerMembers } from "../_services/viewer-service";
import { ViewerMember } from "../_types";

export default function ViewerTeamPage() {
  const params = useParams();
  const rawOrgId = params?.orgId as string;
  const orgId = !rawOrgId || rawOrgId === "viewer" ? "org-acme" : rawOrgId;

  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedMember, setSelectedMember] = useState<ViewerMember | null>(null);

  const allMembers = getViewerMembers(orgId);

  // Distinct teams
  const distinctTeams = useMemo(() => {
    const teams = new Set<string>();
    allMembers.forEach((m) => {
      if (m.teamName) teams.add(m.teamName);
    });
    return Array.from(teams);
  }, [allMembers]);

  // Filtered members
  const filteredMembers = useMemo(() => {
    return allMembers.filter((m) => {
      if (teamFilter !== "ALL" && m.teamName !== teamFilter) return false;
      if (roleFilter !== "ALL" && m.role !== roleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.roleLabel.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allMembers, teamFilter, roleFilter, search]);

  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, currentPage, pageSize]);

  const engineerCount = allMembers.filter((m) => m.teamName?.includes("Engineering") || m.role === "DEVELOPER").length;
  const leadCount = allMembers.filter((m) => m.roleLabel.includes("Lead") || m.role === "PROJECT_MANAGER").length;
  const qaCount = allMembers.filter((m) => m.roleLabel.includes("QA") || m.roleLabel.includes("DevOps")).length;

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* 1. Page Header */}
      <ViewerPageHeader
        title="Organization Team Directory"
        description="Authorized view of engineering squads, functional titles, accountable leads, and cross-project personnel allocations."
        badge={`${allMembers.length} Team Members`}
        simulationLabel="Reactive Demo Data"
      />

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <ViewerKpiCard
          label="Total Team Members"
          value={allMembers.length}
          sublabel="Across active departments"
          icon={Users}
          tone="blue"
        />
        <ViewerKpiCard
          label="Engineering Fleet"
          value={engineerCount}
          sublabel="Full-stack & lead engineers"
          icon={Layers}
          tone="emerald"
        />
        <ViewerKpiCard
          label="Squad & Project Leads"
          value={leadCount}
          sublabel="Accountable sprint leadership"
          icon={Briefcase}
          tone="violet"
        />
        <ViewerKpiCard
          label="QA & Infrastructure"
          value={qaCount}
          sublabel="DevOps & quality engineers"
          icon={Shield}
          tone="amber"
        />
      </div>

      {/* 3. Surface Card with Table Page Format */}
      <ViewerSurfaceCard className="overflow-hidden">
        {/* FilterBar */}
        <div className="p-4 border-b border-[var(--color-border,#E2E8F0)]">
          <ViewerFilterBar
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search by name, email, or role..."
            hasActiveFilters={Boolean(search || teamFilter !== "ALL" || roleFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setTeamFilter("ALL");
              setRoleFilter("ALL");
              setCurrentPage(1);
            }}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={teamFilter}
                  onChange={(e) => {
                    setTeamFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Team"
                  className="h-9 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2.5 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Departments &amp; Teams</option>
                  {distinctTeams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Role"
                  className="h-9 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2.5 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All System Roles</option>
                  <option value="DEVELOPER">Developer</option>
                  <option value="PROJECT_MANAGER">Project Manager</option>
                  <option value="VIEWER">Viewer</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>
            }
          />
        </div>

        {/* Table Format with Row Numbering */}
        {filteredMembers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No team members match your filter criteria"
            description="Clear or adjust your search parameters to view personnel."
            actionText="Reset Filters"
            onAction={() => {
              setSearch("");
              setTeamFilter("ALL");
              setRoleFilter("ALL");
              setCurrentPage(1);
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border,#E2E8F0)] bg-[var(--color-sidebar,#F6F8FC)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
                <tr>
                  <th className="px-4 py-3 w-16 text-center whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3">Team Member</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Email Address</th>
                  <th className="px-4 py-3 whitespace-nowrap">System Role</th>
                  <th className="px-4 py-3 hidden md:table-cell">Functional Title</th>
                  <th className="px-4 py-3 hidden lg:table-cell whitespace-nowrap">Squad / Team</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Projects</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border,#E2E8F0)]">
                {paginatedMembers.map((m, idx) => {
                  const serialNum = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedMember(m)}
                      className="border-b border-[var(--color-border,#E2E8F0)] transition-colors hover:bg-[var(--color-hover,#EEF3FB)] cursor-pointer"
                    >
                      {/* 1. Sr. No. (Modern SaaS interactive badge without hash) */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <ViewerSerialBadge num={serialNum} />
                      </td>

                      {/* 2. Member Avatar + Name */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
                            {m.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--color-text-primary,#202124)]">
                              {m.name}
                            </div>
                            <div className="text-[10px] text-[var(--color-text-muted,#80868B)] sm:hidden">
                              {m.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 3. Email */}
                      <td className="px-4 py-3 hidden sm:table-cell font-mono text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                        {m.email}
                      </td>

                      {/* 4. System Role */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2 py-0.5 text-[11px] font-mono font-medium text-[var(--color-text-secondary,#5F6368)]">
                          {m.role}
                        </span>
                      </td>

                      {/* 5. Functional Title */}
                      <td className="px-4 py-3 hidden md:table-cell text-[11px] text-[var(--color-text-primary,#202124)]">
                        {m.roleLabel}
                      </td>

                      {/* 6. Squad / Team */}
                      <td className="px-4 py-3 hidden lg:table-cell whitespace-nowrap text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                        {m.teamName || "General"}
                      </td>

                      {/* 7. Active Projects Count */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                          {m.assignedProjects.length}
                        </span>
                      </td>

                      {/* 8. Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ViewerStatusBadge
                          label={m.status === "ACTIVE" ? "Active" : "Offline"}
                          tone={m.status === "ACTIVE" ? "success" : "neutral"}
                          dot
                        />
                      </td>

                      {/* 9. Action */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMember(m);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)] hover:bg-[var(--color-hover,#EEF3FB)] text-[var(--color-text-primary,#202124)] transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <ViewerPaginationBar
          currentPage={currentPage}
          totalItems={filteredMembers.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </ViewerSurfaceCard>

      {/* Member Details Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[var(--color-surface,#FFFFFF)] border border-[var(--color-border,#E2E8F0)] rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[var(--color-border,#E2E8F0)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-sm text-[var(--color-text-primary,#202124)]">
                  Team Member Dossier (Read-Only)
                </h3>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="p-1 rounded-lg hover:bg-[var(--color-hover,#EEF3FB)] text-[var(--color-text-muted,#80868B)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-lg">
                  {selectedMember.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-base text-[var(--color-text-primary,#202124)]">
                    {selectedMember.name}
                  </h4>
                  <div className="text-[var(--color-text-secondary,#5F6368)] font-mono">
                    {selectedMember.email}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <ViewerStatusBadge label={selectedMember.role} tone="info" />
                    <ViewerStatusBadge
                      label={selectedMember.status}
                      tone={selectedMember.status === "ACTIVE" ? "success" : "neutral"}
                      dot
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--color-border,#E2E8F0)]">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--color-text-muted,#80868B)]">
                    Functional Title
                  </div>
                  <div className="font-medium text-[var(--color-text-primary,#202124)] mt-0.5">
                    {selectedMember.roleLabel}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--color-text-muted,#80868B)]">
                    Department / Squad
                  </div>
                  <div className="font-medium text-[var(--color-text-primary,#202124)] mt-0.5">
                    {selectedMember.teamName || "General Staff"}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--color-border,#E2E8F0)]">
                <div className="text-[10px] uppercase font-bold text-[var(--color-text-muted,#80868B)] mb-2">
                  Assigned Initiatives ({selectedMember.assignedProjects.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMember.assignedProjects.map((p) => (
                    <span
                      key={p.id || p.key}
                      className="px-2.5 py-1 rounded-md bg-[var(--color-app-bg,#F8FAFD)] border border-[var(--color-border,#E2E8F0)] font-mono font-bold text-blue-600 dark:text-blue-400"
                    >
                      {p.key}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] flex justify-end">
              <ViewerButton
                variant="outline"
                size="sm"
                onClick={() => setSelectedMember(null)}
              >
                Close Dossier
              </ViewerButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
