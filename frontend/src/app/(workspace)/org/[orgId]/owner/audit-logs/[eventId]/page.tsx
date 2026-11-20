"use client";

import React from "react";
import { useParams } from "next/navigation";
import { ArrowRight, Fingerprint, Monitor } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { Avatar, NotFoundState, PageFrame, Panel, StatPill, StatusBadge, formatDateTime, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { AuditSeverityBadge, OrgGate, RoleChip, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

export default function OwnerAuditEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const href = useOrgHref("owner");
  const { status, retry } = useDemoLoad();
  const lk = useOrgLookups();
  const event = useOrgConsoleStore((s) => s.audit.find((e) => e.id === eventId));
  const back = { href: href("audit-logs"), label: "Back to audit log" };
  const crumbs = [{ label: "Owner", href: href() }, { label: "Audit & security", href: href("audit-logs") }, { label: "Event" }];

  if (status === "ready" && !event) {
    return <OrgGate family="owner"><PageFrame crumbs={crumbs} back={back} title="Audit event"><NotFoundState what="Audit event" back={back} /></PageFrame></OrgGate>;
  }
  const actor = lk.member(event?.actorId);

  return (
    <OrgGate family="owner" need="audit.read">
      <PageFrame crumbs={crumbs} back={back} title={event ? `${actor?.name} ${event.action}` : "Audit event"} description={event?.target} status={status} onRetry={retry} skeleton="detail">
        {event && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatPill label="Severity" value={<AuditSeverityBadge severity={event.severity} />} />
              <StatPill label="Category" value={event.category[0] + event.category.slice(1).toLowerCase()} />
              <StatPill label="When (UTC)" value={formatDateTime(event.at)} />
              <StatPill label="Event ID" value={event.id} />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Panel title="Actor" icon={Fingerprint} iconTone="violet">
                <div className="flex items-center gap-3"><Avatar person={actor} /><div className="min-w-0 text-xs"><p className="font-semibold">{actor?.name}</p><p className="text-[var(--color-text-muted)] truncate">{actor?.email}</p><div className="mt-1"><RoleChip role={lk.role(actor?.roleId)} /></div></div></div>
              </Panel>
              <Panel title="Source" icon={Monitor} iconTone="cyan">
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between gap-2"><dt className="text-[var(--color-text-muted)]">IP</dt><dd className="font-mono">{event.ip}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-[var(--color-text-muted)]">Location</dt><dd>{event.location}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-[var(--color-text-muted)]">Device</dt><dd className="text-right">{event.device}</dd></div>
                </dl>
              </Panel>
              <Panel title="Change" icon={ArrowRight} iconTone="amber">
                {event.before || event.after ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <StatusBadge label={event.before ?? "—"} tone="neutral" /><ArrowRight className="w-4 h-4 text-[var(--color-text-muted)]" /><StatusBadge label={event.after ?? "—"} tone="info" />
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)]">No before/after values for this event type.</p>
                )}
              </Panel>
            </div>
          </>
        )}
      </PageFrame>
    </OrgGate>
  );
}
