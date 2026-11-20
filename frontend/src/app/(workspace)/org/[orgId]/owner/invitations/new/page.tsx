"use client";

import React from "react";
import { Info, Mail } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { PageFrame, Panel, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { OrgGate, RoleChip, useOrgHref } from "@/components/org-console/OrgUI";
import { InviteForm } from "@/components/org-console/OrgWidgets";

export default function OwnerInvitePage() {
  const href = useOrgHref("owner");
  const { status, retry } = useDemoLoad(250);
  const roles = useOrgConsoleStore((s) => s.roles);
  const settings = useOrgConsoleStore((s) => s.settings);

  return (
    <OrgGate family="owner" need="member.invite">
      <PageFrame
        crumbs={[{ label: "Owner", href: href() }, { label: "Invitations", href: href("invitations") }, { label: "Invite member" }]}
        back={{ href: href("invitations"), label: "Back to invitations" }}
        title="Invite a member"
        description="As owner you can invite people into any role except Owner."
        status={status}
        onRetry={retry}
        skeleton="detail"
      >
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Panel className="xl:col-span-2" title="Invitation" icon={Mail}><InviteForm family="owner" /></Panel>
          <Panel title="Before you send" icon={Info} iconTone="cyan">
            <ul className="space-y-2.5 text-xs text-[var(--color-text-secondary)]">
              <li>Allowed domains: <b>{settings.allowedDomains.join(", ")}</b></li>
              <li>Invitations expire after <b>7 days</b>.</li>
              <li>MFA is <b>{settings.requireMfa ? "required" : "optional"}</b> on first sign-in.</li>
              <li className="flex flex-wrap items-center gap-1.5">Default role: <RoleChip role={roles.find((r) => r.id === settings.defaultRoleId)} /></li>
            </ul>
          </Panel>
        </div>
      </PageFrame>
    </OrgGate>
  );
}
