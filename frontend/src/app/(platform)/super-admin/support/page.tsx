"use client";

import React from "react";
import { operationsApi } from "@/lib/admin-api/operations";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { SupportView } from "@/components/super-admin/operations/SupportView";
import { useOperators, useOpsMutation } from "@/components/super-admin/operations/shared";

export default function SupportOversightPage() {
  const { state, reload } = useAdminResource(() => operationsApi.tickets.list(), "tickets");
  const operators = useOperators();
  const { busy, notice, clearNotice, run } = useOpsMutation(reload);

  return (
    <SupportView
      tickets={state}
      operators={operators}
      onRetry={reload}
      busy={busy}
      notice={notice}
      onReload={() => {
        clearNotice();
        void reload();
      }}
      onDismissNotice={clearNotice}
      onSelect={clearNotice}
      onUpdate={(t, body) => run(`update:${t.id}`, () => operationsApi.tickets.update(t.id, body, t.version), `Ticket ${t.id} updated.`)}
      onAssign={(t, operatorId, notes) =>
        run(`assign:${t.id}`, () => operationsApi.tickets.assign(t.id, operatorId, notes, t.version), `Ticket ${t.id} reassigned.`)
      }
    />
  );
}
