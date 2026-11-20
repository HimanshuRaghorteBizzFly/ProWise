"use client";

import { useMemo } from "react";
import { useDeliveryStore } from "@/store/delivery-store";
import { VIEWERS } from "@/mocks/delivery-dashboards";

/** Everything the Team Lead may see: only their own team's people and work. */
export function useLeadTeam(forceEmpty = false) {
  const teams = useDeliveryStore((s) => s.teams);
  const people = useDeliveryStore((s) => s.people);
  const tasks = useDeliveryStore((s) => s.tasks);
  const blockers = useDeliveryStore((s) => s.blockers);
  const checkIns = useDeliveryStore((s) => s.checkIns);
  const dependencies = useDeliveryStore((s) => s.dependencies);

  return useMemo(() => {
    const team = teams.find((t) => t.id === VIEWERS.lead.teamId)!;
    const memberSet = new Set(team.memberIds);
    const members = forceEmpty ? [] : people.filter((p) => memberSet.has(p.id));
    const teamTasks = forceEmpty
      ? []
      : tasks.filter((t) => (t.assigneeId ? memberSet.has(t.assigneeId) : t.teamId === team.id));
    const taskIds = new Set(teamTasks.map((t) => t.id));
    return {
      team,
      members: members.map((m) => ({ ...m, pct: Math.round((m.assignedHours / m.capacityHours) * 100) })),
      tasks: teamTasks,
      blockers: blockers.filter((b) => taskIds.has(b.taskId)),
      checkIns: forceEmpty ? [] : checkIns.filter((c) => memberSet.has(c.memberId)),
      dependencies: dependencies.filter((d) => taskIds.has(d.fromTaskId) || taskIds.has(d.toTaskId)),
      isTeamTask: (id: string) => taskIds.has(id),
      isMember: (id: string) => memberSet.has(id),
    };
  }, [teams, people, tasks, blockers, checkIns, dependencies, forceEmpty]);
}
