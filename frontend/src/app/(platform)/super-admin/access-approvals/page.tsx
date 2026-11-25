"use client";

import React from "react";
import { operationsApi } from "@/lib/admin-api/operations";
import { useAdminResource, useOrgNames } from "@/components/super-admin/admin-resource";
import { AccessApprovalsView } from "@/components/super-admin/operations/AccessApprovalsView";
import { useOpsMutation } from "@/components/super-admin/operations/shared";

export default function SupportAccessApprovalsPage() {
  const { state, reload } = useAdminResource(() => operationsApi.accessRequests.list(), "access-requests");
  const orgName = useOrgNames();
  const { busy, notice, clearNotice, run } = useOpsMutation(reload);

  return (
    <AccessApprovalsView
      requests={state}
      orgName={orgName}
      onRetry={reload}
      busy={busy}
      notice={notice}
      onReload={() => {
        clearNotice();
        void reload();
      }}
      onDismissNotice={clearNotice}
      onApprove={(r) => void run(`approve:${r.id}`, () => operationsApi.accessRequests.approve(r.id, r.version), "Support access approved.")}
      onReject={(r) => void run(`reject:${r.id}`, () => operationsApi.accessRequests.reject(r.id, r.version), "Support access request rejected.")}
    />
  );
}
