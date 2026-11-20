"use client";

import React from "react";
import { useParams } from "next/navigation";
import { ArrowRight, Fingerprint, Monitor } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { Avatar, LinkRow, NotFoundState, PageFrame, Panel, StatPill, StatusBadge, formatDateTime, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { AuditSeverityBadge, OrgGate, RoleChip, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

export default function AdminAuditEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const href = useOrgHref("admin");
  const { status, retry } = useDemoLoad();
  const lk = useOrgLookups();
  // Organization-settings events are owner-only; admins get not found.
  const event = useOrgConsoleStore((s) => s.audit.find((e) => e.id === eventId && e.category !== "SETTINGS"));
  const back = { href: href("audit-logs"), label: "Back to audit activity" };
  const crumbs = [{ label: "Admin", href: href() }, { label: "Audit activity", href: href("audit-logs") }, { label: "Event" }];

  if (status === "ready" && !event) {
    return <OrgGate family="admin"><PageFrame crumbs={crumbs} back={back} title="Audit event"><NotFoundState what="Audit event" back={back} /></PageFrame></OrgGate>;
  }
  const actor = lk.member(event?.actorId);

  return (
    <OrgGate family="admin" need="audit.read">
      <PageFrame crumbs={crumbs} back={back} title={event ? `${actor?.name} ${event.action}` : "Audit event"} description={event?.target} status={status} onRetry={retry} skeleton="detail">
        {event && actor && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatPill label="Severity" value={<AuditSeverityBadge severity={event.severity} />} />
              <StatPill label="Category" value={event.category[0] + event.category.slice(1).toLowerCase()} />
              <StatPill label="When (UTC)" value={formatDateTime(event.at)} />
              <StatPill label="IP" value={event.ip} />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Panel title="Actor" icon={Fingerprint} iconTone="violet">
                <LinkRow href={href(`members/${actor.id}`)}><Avatar person={actor} size="sm" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{actor.name}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{actor.email}</p></div><RoleChip role={lk.role(actor.roleId)} /></LinkRow>
              </Panel>
              <Panel title="Source" icon={Monitor} iconTone="cyan">
                <p className="text-xs">{event.location}</p><p className="text-[11px] text-[var(--color-text-muted)] mt-1">{event.device}</p>
              </Panel>
              <Panel title="Change" icon={ArrowRight} iconTone="amber">
                {event.before || event.after ? <div className="flex flex-wrap items-center gap-2"><StatusBadge label={event.before ?? "—"} tone="neutral" /><ArrowRight className="w-4 h-4 text-[var(--color-text-muted)]" /><StatusBadge label={event.after ?? "—"} tone="info" /></div> : <p className="text-xs text-[var(--color-text-muted)]">No before/after values.</p>}
              </Panel>
            </div>
          </>
        )}
      </PageFrame>
    </OrgGate>
  );
}
