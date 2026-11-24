import React from "react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { PageHeader } from "@/components/owner/primitives";
import type { PermissionKey } from "@/types/permission";

export interface PrivacyViewProps {
  can: (key: PermissionKey) => boolean;
}

/** Owner-only privacy operations (task 5.6). No data is shown until the privacy API exists. */
export function PrivacyView({ can }: PrivacyViewProps) {
  const header = (
    <PageHeader
      title="Data & privacy"
      description="Privacy operations for this organization. Every request is checked again on the server and recorded in the audit log."
    />
  );

  if (!can("org.manage")) {
    return (
      <div className="space-y-4">
        {header}
        <OwnerPageState state="forbidden" requiredPermission="org.manage" description="Data and privacy operations are limited to the organization owner." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <OwnerPanel
          title="Data export"
          description="Request an export of this organization's data. Download links re-check permission when used."
          actions={<OwnerLaterBadge task="5.6" />}
        >
          <LaterActionButton>Request data export</LaterActionButton>
        </OwnerPanel>
        <OwnerPanel
          title="Deletion requests"
          description="Request deletion of personal data for a member, subject to retention rules."
          actions={<OwnerLaterBadge task="5.6" />}
        >
          <LaterActionButton>Request deletion</LaterActionButton>
        </OwnerPanel>
        <OwnerPanel
          title="Retention"
          description="How long audit records, activity and files are kept."
          actions={<OwnerLaterBadge task="5.6" />}
          className="lg:col-span-2"
        >
          <p className="text-sm text-app-text-secondary">Retention policy settings are not configurable yet.</p>
        </OwnerPanel>
      </div>
    </div>
  );
}
