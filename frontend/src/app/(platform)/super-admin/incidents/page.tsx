"use client";

import React, { useCallback, useState } from "react";
import { operationsApi } from "@/lib/admin-api/operations";
import type { IncidentAssignment } from "@/types/admin-operations";
import { useAdminResource, errorMessage, type ResourceState } from "@/components/super-admin/admin-resource";
import { IncidentsView } from "@/components/super-admin/operations/IncidentsView";
import { useOperators, useOpsMutation } from "@/components/super-admin/operations/shared";

export default function IncidentGovernancePage() {
  const { state, reload } = useAdminResource(() => operationsApi.incidents.list(), "incidents");
  const operators = useOperators();
  const [openId, setOpenId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<ResourceState<IncidentAssignment[]> | null>(null);

  const loadAssignments = useCallback(async (incidentId: string | null) => {
    if (!incidentId) {
      setAssignments(null);
      return;
    }
    setAssignments({ status: "loading" });
    try {
      setAssignments({ status: "ready", data: await operationsApi.incidents.assignments(incidentId) });
    } catch (error) {
      setAssignments({ status: "error", message: errorMessage(error) });
    }
  }, []);

  const refresh = useCallback(() => {
    void reload();
    void loadAssignments(openId);
  }, [reload, loadAssignments, openId]);

  const { busy, notice, clearNotice, run } = useOpsMutation(refresh);

  return (
    <IncidentsView
      incidents={state}
      operators={operators}
      onRetry={reload}
      busy={busy}
      notice={notice}
      onReload={() => {
        clearNotice();
        refresh();
      }}
      onDismissNotice={clearNotice}
      onCreate={(body) => run("create", () => operationsApi.incidents.create(body), "Incident declared.")}
      onUpdate={(inc, body) =>
        run(`update:${inc.id}`, () => operationsApi.incidents.update(inc.id, body, inc.version), `Incident ${inc.id} updated.`)
      }
      onAssign={(inc, operatorId, notes) =>
        run(`assign:${inc.id}`, () => operationsApi.incidents.assign(inc.id, operatorId, notes, inc.version), `Incident ${inc.id} assigned.`)
      }
      onResolve={(inc, body) =>
        run(`resolve:${inc.id}`, () => operationsApi.incidents.resolve(inc.id, body, inc.version), `Incident ${inc.id} resolved.`)
      }
      assignments={assignments}
      onOpenIncident={(incidentId) => {
        setOpenId(incidentId);
        clearNotice();
        void loadAssignments(incidentId);
      }}
      onRetryAssignments={() => void loadAssignments(openId)}
    />
  );
}
