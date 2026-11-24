"use client";

import React, { useCallback } from "react";
import { operationsApi } from "@/lib/admin-api/operations";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { WebhooksView } from "@/components/super-admin/operations/IntegrationViews";
import { useOpsMutation } from "@/components/super-admin/operations/shared";

export default function WebhooksEventsPage() {
  const receipts = useAdminResource(() => operationsApi.webhooks(), "webhooks");
  const outbox = useAdminResource(() => operationsApi.outbox.failed(), "outbox-failed");
  const reloadOutbox = outbox.reload;
  const refresh = useCallback(() => void reloadOutbox(), [reloadOutbox]);
  const { busy, notice, clearNotice, run } = useOpsMutation(refresh);

  return (
    <WebhooksView
      receipts={receipts.state}
      outbox={outbox.state}
      onRetryReceipts={receipts.reload}
      onRetryOutboxList={outbox.reload}
      onRetryEvent={(eventId) => void run(`outbox:${eventId}`, () => operationsApi.outbox.retry(eventId), "Event re-queued for delivery.")}
      busy={busy}
      notice={notice}
      onReload={() => {
        clearNotice();
        void receipts.reload();
        void outbox.reload();
      }}
      onDismissNotice={clearNotice}
    />
  );
}
