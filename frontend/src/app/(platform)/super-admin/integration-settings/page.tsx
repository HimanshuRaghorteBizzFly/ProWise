"use client";

import React from "react";
import { operationsApi } from "@/lib/admin-api/operations";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { IntegrationSettingsView } from "@/components/super-admin/operations/IntegrationSettingsView";
import { useOpsMutation } from "@/components/super-admin/operations/shared";

export default function IntegrationSettingsPage() {
  const { state, reload } = useAdminResource(() => operationsApi.integrationSettings.get(), "integration-settings");
  const { busy, notice, clearNotice, run } = useOpsMutation(reload);

  return (
    <IntegrationSettingsView
      settings={state}
      onRetry={reload}
      onSave={(body) => run("save", () => operationsApi.integrationSettings.update(body), "Integration settings saved.")}
      saving={busy === "save"}
      notice={notice}
      onReload={() => {
        clearNotice();
        void reload();
      }}
      onDismissNotice={clearNotice}
    />
  );
}
