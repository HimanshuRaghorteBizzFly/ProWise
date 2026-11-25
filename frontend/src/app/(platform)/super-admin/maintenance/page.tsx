"use client";

import React from "react";
import { operationsApi } from "@/lib/admin-api/operations";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { MaintenanceView } from "@/components/super-admin/operations/MaintenanceView";
import { useOpsMutation } from "@/components/super-admin/operations/shared";

export default function MaintenanceModePage() {
  const { state, reload } = useAdminResource(() => operationsApi.maintenance.list(), "maintenance");
  const { busy, notice, clearNotice, run } = useOpsMutation(reload);

  return (
    <MaintenanceView
      windows={state}
      onRetry={reload}
      busy={busy}
      notice={notice}
      onReload={() => {
        clearNotice();
        void reload();
      }}
      onDismissNotice={clearNotice}
      onCreate={(body) => run("create", () => operationsApi.maintenance.create(body), "Maintenance window scheduled.")}
      onUpdate={(w, body) =>
        run(
          body.status ? `update:${w.id}` : `edit:${w.id}`,
          () => operationsApi.maintenance.update(w.id, body, w.version),
          body.status ? `Maintenance window marked ${body.status.toLowerCase().replace("_", " ")}.` : "Maintenance window updated.",
        )
      }
    />
  );
}
