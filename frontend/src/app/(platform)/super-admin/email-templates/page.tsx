"use client";

import React, { useMemo, useState } from "react";
import { FileText, MailPlus } from "lucide-react";
import { apiClient } from "@/lib/api";
import { platformApi } from "@/lib/admin-api/platform";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { EmailTemplatesView } from "@/components/super-admin/EmailTemplatesView";
import { OperatorEmailDraftsView } from "@/components/super-admin/OperatorEmailDraftsView";
import { TabBar } from "@/components/super-admin/platform-shared";
import { useNamedOptions } from "@/components/super-admin/use-named-options";

type Tab = "templates" | "operator-drafts";

export default function SuperAdminEmailTemplatesPage() {
  const { state, reload } = useAdminResource(() => platformApi.emailTemplates.list(), "email-templates");
  // Header SMTP chip: the real settings from the server; a failed read shows "unavailable", never a guess.
  const { state: smtp } = useAdminResource(() => apiClient.smtp.settings(), "email-templates-smtp");
  const { organizations } = useNamedOptions({ organizations: true });
  const organizationNames = useMemo(() => organizations.map((o) => o.name), [organizations]);

  const [tab, setTab] = useState<Tab>("templates");
  // Operator drafts: server paging (0-based on the wire), default filter = awaiting review.
  const [draftStatus, setDraftStatus] = useState("SUBMITTED");
  const [draftPage, setDraftPage] = useState(1);
  const [draftPageSize, setDraftPageSize] = useState(25);
  const drafts = useAdminResource(
    () => platformApi.emailDrafts.list({ status: draftStatus, page: draftPage - 1, size: draftPageSize }),
    `admin-email-drafts:${draftStatus}:${draftPage}:${draftPageSize}`,
  );
  const draftBadge =
    drafts.state.status === "ready" && draftStatus === "SUBMITTED" ? String(drafts.state.data.total ?? 0) : undefined;

  return (
    <div className="space-y-4">
      <TabBar<Tab>
        tabs={[
          { key: "templates", label: "Templates", icon: FileText },
          { key: "operator-drafts", label: "Operator drafts", icon: MailPlus, badge: draftBadge },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "templates" ? (
        <EmailTemplatesView
          state={state}
          onRetry={() => void reload()}
          api={platformApi}
          organizationNames={organizationNames}
          smtp={smtp}
        />
      ) : (
        <OperatorEmailDraftsView
          state={drafts.state}
          onRetry={() => void drafts.reload()}
          api={platformApi}
          status={draftStatus}
          onStatusChange={(s) => {
            setDraftStatus(s);
            setDraftPage(1);
          }}
          page={draftPage}
          pageSize={draftPageSize}
          onPageChange={setDraftPage}
          onPageSizeChange={(n) => {
            setDraftPageSize(Math.min(100, Math.max(1, n)));
            setDraftPage(1);
          }}
        />
      )}
    </div>
  );
}
