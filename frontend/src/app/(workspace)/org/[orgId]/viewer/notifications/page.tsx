"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Check,
  Filter,
  Sparkles,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldCheck,
  Clock,
  Eye,
  MailOpen,
  X,
  ExternalLink,
} from "lucide-react";
import {
  ViewerPageHeader,
  ViewerSurfaceCard,
  ViewerKpiCard,
  ViewerFilterBar,
  ViewerPaginationBar,
  ViewerStatusBadge,
  ViewerSerialBadge,
  ViewerButton,
  EmptyState,
} from "../_components/ViewerPrimitives";
import { useViewerStore } from "../_store/useViewerStore";
import { ViewerNotificationItem } from "../_types";
import { toast } from "sonner";

export default function ViewerNotificationsPage() {
  const params = useParams();
  const router = useRouter();
  const rawOrgId = params?.orgId as string;
  const orgId = !rawOrgId || rawOrgId === "viewer" ? "org-acme" : rawOrgId;

  const {
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useViewerStore();

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "UNREAD" | "READ">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [inspectNotif, setInspectNotif] = useState<ViewerNotificationItem | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (filterMode === "UNREAD" && n.read) return false;
      if (filterMode === "READ" && !n.read) return false;
      if (categoryFilter !== "ALL" && n.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [notifications, filterMode, categoryFilter, search]);

  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredNotifications.slice(start, start + pageSize);
  }, [filteredNotifications, currentPage, pageSize]);

  const getCategoryTone = (category: string) => {
    switch (category) {
      case "HEALTH_ALERT":
        return "danger";
      case "MILESTONE":
        return "success";
      case "DELIVERY":
        return "violet";
      case "DIGEST":
        return "info";
      case "GOVERNANCE":
        return "warning";
      default:
        return "neutral";
    }
  };

  const handleMarkRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    markNotificationAsRead(id);
    toast.success("Notification marked as read");
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
    toast.success("All notifications marked as read");
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* 1. Page Header */}
      <ViewerPageHeader
        title="Stakeholder Notifications Feed"
        description="Inspect personal milestone announcements, project health alerts, and weekly progress digest publications delivered to your account."
        badge={`${unreadCount} Unread`}
        simulationLabel="Reactive Demo Data"
        actions={
          unreadCount > 0 ? (
            <ViewerButton
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              className="gap-1.5 text-blue-600 dark:text-blue-400"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark All as Read</span>
            </ViewerButton>
          ) : undefined
        }
      />

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <ViewerKpiCard
          label="Total Notifications"
          value={notifications.length}
          sublabel="Personal activity feed"
          icon={Bell}
          tone="blue"
        />
        <ViewerKpiCard
          label="Unread Alerts"
          value={unreadCount}
          sublabel="Pending stakeholder review"
          trend={{ value: `${unreadCount} unread`, positive: unreadCount === 0 }}
          icon={AlertTriangle}
          tone={unreadCount > 0 ? "amber" : "emerald"}
        />
        <ViewerKpiCard
          label="Milestone Bulletins"
          value={notifications.filter((n) => n.category === "MILESTONE").length}
          sublabel="Verified milestone completions"
          icon={CheckCheck}
          tone="emerald"
        />
        <ViewerKpiCard
          label="Digest Publications"
          value={notifications.filter((n) => n.category === "DIGEST").length}
          sublabel="Automated progress rollups"
          icon={Layers}
          tone="violet"
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
            searchPlaceholder="Search notification title or message content..."
            hasActiveFilters={Boolean(search || filterMode !== "ALL" || categoryFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setFilterMode("ALL");
              setCategoryFilter("ALL");
              setCurrentPage(1);
            }}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterMode}
                  onChange={(e) => {
                    setFilterMode(e.target.value as "ALL" | "UNREAD" | "READ");
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Status"
                  className="h-9 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2.5 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Updates ({notifications.length})</option>
                  <option value="UNREAD">Unread Only ({unreadCount})</option>
                  <option value="READ">Read Only ({notifications.length - unreadCount})</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Category"
                  className="h-9 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2.5 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Categories</option>
                  <option value="HEALTH_ALERT">Health Alerts</option>
                  <option value="MILESTONE">Milestones</option>
                  <option value="DIGEST">Weekly Digests</option>
                  <option value="DELIVERY">Deliveries</option>
                  <option value="GOVERNANCE">Governance</option>
                </select>
              </div>
            }
          />
        </div>

        {/* Table Format with Numbering */}
        {filteredNotifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications in this view"
            description="You're all caught up on stakeholder bulletins and milestone alerts."
            actionText="Reset Filters"
            onAction={() => {
              setSearch("");
              setFilterMode("ALL");
              setCategoryFilter("ALL");
              setCurrentPage(1);
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border,#E2E8F0)] bg-[var(--color-sidebar,#F6F8FC)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
                <tr>
                  <th className="px-4 py-3 w-16 text-center whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3">Notification Bulletin & Content</th>
                  <th className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">Category</th>
                  <th className="px-4 py-3 whitespace-nowrap">Timestamp</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border,#E2E8F0)]">
                {paginatedNotifications.map((notif, idx) => {
                  const serialNum = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={notif.id}
                      onClick={() => setInspectNotif(notif)}
                      className={`group border-b border-[var(--color-border,#E2E8F0)] transition-colors hover:bg-[var(--color-hover,#EEF3FB)] cursor-pointer ${
                        !notif.read ? "bg-blue-50/20 dark:bg-blue-950/20 font-medium" : ""
                      }`}
                    >
                      {/* 1. Sr. No. (Modern SaaS interactive badge without hash) */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <ViewerSerialBadge num={serialNum} />
                      </td>

                      {/* 2. Status Badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ViewerStatusBadge
                          label={notif.read ? "Read" : "Unread"}
                          tone={notif.read ? "neutral" : "warning"}
                          dot={!notif.read}
                        />
                      </td>

                      {/* 3. Title & Message */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[var(--color-text-primary,#202124)] group-hover:text-blue-600 transition-colors">
                          {notif.title}
                        </div>
                        <div className="text-[11px] text-[var(--color-text-secondary,#5F6368)] line-clamp-1 max-w-lg mt-0.5">
                          {notif.message}
                        </div>
                      </td>

                      {/* 4. Category */}
                      <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                        <ViewerStatusBadge
                          label={notif.category.replace("_", " ")}
                          tone={getCategoryTone(notif.category)}
                        />
                      </td>

                      {/* 5. Timestamp */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-[var(--color-text-muted,#80868B)]">
                        {notif.timestamp.split("T")[0]}
                      </td>

                      {/* 6. Action */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {!notif.read ? (
                            <button
                              type="button"
                              onClick={(e) => handleMarkRead(notif.id, e)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)] hover:bg-[var(--color-hover,#EEF3FB)] text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Mark Read</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setInspectNotif(notif)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)] hover:bg-[var(--color-hover,#EEF3FB)] text-[var(--color-text-primary,#202124)] transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600" />
                              <span>View</span>
                            </button>
                          )}
                          {notif.link && (
                            <button
                              type="button"
                              onClick={() => {
                                markNotificationAsRead(notif.id);
                                router.push(notif.link!);
                              }}
                              className="inline-flex items-center gap-1 p-1 text-xs rounded-lg border border-[var(--color-border,#E2E8F0)] hover:bg-[var(--color-hover,#EEF3FB)] text-[var(--color-text-primary,#202124)] cursor-pointer"
                              title="Go to linked workspace page"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
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
          totalItems={filteredNotifications.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </ViewerSurfaceCard>

      {/* Interactive Notification Inspection Modal */}
      {inspectNotif && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setInspectNotif(null)}
        >
          <div
            className="w-full max-w-md bg-[var(--color-surface,#FFFFFF)] border border-[var(--color-border,#E2E8F0)] rounded-2xl shadow-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border,#E2E8F0)]">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-[var(--color-text-primary,#202124)]">
                  Notification Bulletin
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectNotif(null)}
                className="p-1 rounded-lg hover:bg-[var(--color-hover,#EEF3FB)] text-[var(--color-text-muted,#80868B)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <ViewerStatusBadge
                  label={inspectNotif.category.replace("_", " ")}
                  tone={getCategoryTone(inspectNotif.category)}
                  dot
                />
                <span className="font-mono text-[11px] text-[var(--color-text-muted,#80868B)]">
                  {inspectNotif.timestamp}
                </span>
              </div>

              <h4 className="font-bold text-sm text-[var(--color-text-primary,#202124)]">
                {inspectNotif.title}
              </h4>

              <div className="p-3.5 rounded-xl border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] text-[var(--color-text-primary,#202124)] leading-relaxed">
                {inspectNotif.message}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border,#E2E8F0)]">
              {!inspectNotif.read ? (
                <ViewerButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    markNotificationAsRead(inspectNotif.id);
                    setInspectNotif({ ...inspectNotif, read: true });
                    toast.success("Marked as read");
                  }}
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mark Read</span>
                </ViewerButton>
              ) : (
                <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Read
                </span>
              )}

              <div className="flex items-center gap-2">
                {inspectNotif.link && (
                  <ViewerButton
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      markNotificationAsRead(inspectNotif.id);
                      setInspectNotif(null);
                      router.push(inspectNotif.link!);
                    }}
                  >
                    <span>Open Linked Page</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </ViewerButton>
                )}
                <ViewerButton
                  variant="outline"
                  size="sm"
                  onClick={() => setInspectNotif(null)}
                >
                  Close
                </ViewerButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
