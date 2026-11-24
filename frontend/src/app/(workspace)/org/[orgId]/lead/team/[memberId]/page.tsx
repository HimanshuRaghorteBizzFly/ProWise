import { ModuleUnavailable } from "@/components/feedback/ModuleUnavailable";

<<<<<<< HEAD
import { previewEnabled } from "@/lib/permissions";
import { WorkItemsView, WorkItemView, TeamWorkView, TeamMemberView, ProjectPlanningView } from "@/components/work/WorkListViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";

import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { BellRing, ListChecks, Mail, MapPin, MessageSquareText, UserPlus } from "lucide-react";
import {
  AdminButton,
  Avatar,
  ButtonLink,
  DataTable,
  NotFoundState,
  PageFrame,
  Panel,
  ProgressBar,
  StatPill,
  StatusBadge,
  SurfaceCard,
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL,
  TaskStatusBadge,
  daysFromToday,
  dueLabel,
  formatDateTime,
  useDemoLoad,
  useLookups,
  useRoleHref,
  utilisationTone,
} from "@/components/delivery/DeliveryUI";
import { DonutChart } from "@/components/delivery/DeliveryCharts";
import { useLeadTeam } from "@/components/delivery/useLeadTeam";

function PreviewTeamLeadMemberPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const href = useRoleHref("lead");
  const { status, retry } = useDemoLoad();
  const lk = useLookups();
  const t = useLeadTeam();
  const member = t.members.find((m) => m.id === memberId);
  const tasks = useMemo(() => t.tasks.filter((x) => x.assigneeId === memberId), [t.tasks, memberId]);
  const checkIn = t.checkIns.find((c) => c.memberId === memberId);
  const back = { href: href("team"), label: "Back to members" };
  const crumbs = [{ label: "Lead", href: href() }, { label: "Members", href: href("team") }, { label: member?.name ?? "Member" }];

  // Team Leads only see their own team: anyone else is treated as not found.
  if (status === "ready" && !member) {
    return <PageFrame crumbs={crumbs} back={back} title="Team member"><NotFoundState what="Team member" back={back} /></PageFrame>;
  }

  const u = utilisationTone(member?.pct ?? 0);
  const open = tasks.filter((x) => x.status !== "DONE");

  return (
    <PageFrame
      crumbs={crumbs}
      back={back}
      title={member?.name ?? "Team member"}
      description={member ? `${member.title} · ${t.team.name}` : undefined}
      status={status}
      onRetry={retry}
      skeleton="detail"
      actions={<ButtonLink href={href(`assignments?member=${memberId}`)}><UserPlus className="w-3.5 h-3.5" /> Assign work</ButtonLink>}
    >
      {member && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <SurfaceCard className="p-5 flex flex-col items-center text-center gap-3">
              <Avatar person={member} size="lg" />
              <div className="flex flex-col gap-1 text-[11px] text-[var(--color-text-secondary)]">
                <span className="inline-flex items-center gap-1.5 justify-center"><Mail className="w-3.5 h-3.5" />{member.email}</span>
                <span className="inline-flex items-center gap-1.5 justify-center"><MapPin className="w-3.5 h-3.5" />{member.location}</span>
              </div>
              <div className="flex flex-wrap justify-center gap-1">{member.skills.map((s) => <StatusBadge key={s} label={s} tone="violet" />)}</div>
              <div className="w-full space-y-1 pt-2">
                <div className="flex justify-between text-[11px]"><span>Load</span><span className="font-bold" style={{ color: u.color }}>{member.pct}%</span></div>
                <ProgressBar value={Math.min(100, member.pct)} color={u.color} />
              </div>
            </SurfaceCard>
            <Panel title="Work mix" icon={ListChecks} iconTone="violet" className="lg:col-span-1">
              <DonutChart
                height={160}
                centerLabel="tasks"
                data={(["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE"] as const).map((s) => ({ name: TASK_STATUS_LABEL[s], value: tasks.filter((x) => x.status === s).length, color: TASK_STATUS_COLOR[s] }))}
              />
            </Panel>
            <div className="lg:col-span-1 xl:col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <StatPill label="Open" value={open.length} />
                <StatPill label="Overdue" value={open.filter((x) => daysFromToday(x.dueDate) < 0).length} tone="danger" />
                <StatPill label="Due today" value={open.filter((x) => daysFromToday(x.dueDate) === 0).length} tone="warning" />
                <StatPill label="In review" value={tasks.filter((x) => x.status === "IN_REVIEW").length} />
              </div>
              <Panel title="Latest check-in" icon={MessageSquareText} iconTone="teal">
                {checkIn ? (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={checkIn.status === "SUBMITTED" ? "Submitted" : checkIn.status === "OVERDUE" ? "Overdue" : "Due"} tone={checkIn.status === "SUBMITTED" ? "success" : checkIn.status === "OVERDUE" ? "danger" : "warning"} dot />
                      <span className="text-[11px] text-[var(--color-text-muted)]">Due {formatDateTime(checkIn.dueAt)} UTC · confidence {checkIn.confidence}%</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">{checkIn.lastSummary}</p>
                    {checkIn.status !== "SUBMITTED" && (
                      <AdminButton size="xs" variant="subtle" onClick={() => toast.success(`Reminder sent to ${member.name}`)}>
                        <BellRing className="w-3 h-3" /> Send reminder
                      </AdminButton>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)]">No check-ins scheduled.</p>
                )}
              </Panel>
            </div>
          </div>

          <Panel title="Assigned tasks" description="Open a task to update it" icon={ListChecks} bodyClassName="p-0">
            <DataTable
              rows={tasks}
              rowHref={(x) => href(`work-items/${x.id}`)}
              empty={{ icon: ListChecks, title: "No tasks", description: "Assign work to this person." }}
              columns={[
                { key: "t", header: "Task", className: "w-[55%] md:w-[40%]", render: (x) => <div className="min-w-0"><p className="font-semibold truncate">{x.title}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{x.key} · {lk.project(x.projectId)?.name}</p></div> },
                { key: "s", header: "Status", render: (x) => <TaskStatusBadge status={x.status} /> },
                { key: "p", header: "Progress", hideBelow: "lg", render: (x) => <ProgressBar value={x.progress} size="sm" showLabel /> },
                { key: "d", header: "Due", hideBelow: "md", render: (x) => { const d = dueLabel(x.dueDate, x.status === "DONE"); return <StatusBadge label={d.label} tone={d.tone} />; } },
              ]}
            />
          </Panel>
        </>
      )}
    </PageFrame>
  );
=======
/** No backend API serves this module yet, so the route shows a notice instead. */
export default function Page({ params }: { params: { orgId: string } }) {
  return <ModuleUnavailable module="Team members" homeHref={`/org/${encodeURIComponent(params.orgId)}/lead`} homeLabel="Back to dashboard" />;
>>>>>>> 29db595 (Initial ProWise project upload)
}

/** Task 3.1: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function TeamLeadMemberPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/lead`;
  if (previewEnabled()) return <PreviewTeamLeadMemberPage />;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <TeamMemberView membershipId={(params?.memberId as string) ?? ""} crumbs={[{ label: "Team Lead", href: home }, { label: "My team", href: `${home}/team` }]}
        back={{ href: `${home}/team`, label: "Back to my team" }} itemHref={(entry) => `${home}/work-items/${entry.item.id}`} />
    </RequireAnyKey>
  );
}
