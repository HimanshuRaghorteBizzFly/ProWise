"use client";

import React from "react";
import { Lock, Mail } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { PageFrame, Panel, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { LockNote, OrgGate, RoleChip, useOrgHref } from "@/components/org-console/OrgUI";
import { InviteForm } from "@/components/org-console/OrgWidgets";
import { canAssignRole } from "@/components/org-console/role-rules";

export default function AdminInvitePage() {
  const href = useOrgHref("admin");
  const { status, retry } = useDemoLoad(250);
  const roles = useOrgConsoleStore((s) => s.roles);

  return (
    <OrgGate family="admin" need="member.invite">
      <PageFrame
        crumbs={[{ label: "Admin", href: href() }, { label: "Invitations", href: href("invitations") }, { label: "Invite member" }]}
        back={{ href: href("invitations"), label: "Back to invitations" }}
        title="Invite a member"
        description="You can invite people into roles that don't exceed your own access."
        status={status}
        onRetry={retry}
        skeleton="detail"
      >
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Panel className="xl:col-span-2" title="Invitation" icon={Mail}><InviteForm family="admin" /></Panel>
          <Panel title="Roles you can grant" icon={Lock} iconTone="amber">
            <ul className="space-y-2">
              {roles.filter((r) => r.id !== "role-owner").map((r) => {
                const v = canAssignRole("admin", r, roles);
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                    <RoleChip role={r} />
                    {v.ok ? <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Allowed</span> : <LockNote reason="Above your access" />}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </PageFrame>
    </OrgGate>
  );
}
