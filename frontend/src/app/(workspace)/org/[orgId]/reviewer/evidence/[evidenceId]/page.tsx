"use client";

import React from "react";
import { useParams } from "next/navigation";
import { BadgeCheck, ExternalLink, Flag, GitPullRequestArrow, Microscope } from "lucide-react";
import { toast } from "sonner";
import { useDeliveryStore } from "@/store/delivery-store";
import { VIEWERS } from "@/mocks/delivery-dashboards";
import {
  AdminButton,
  EVIDENCE_LABEL,
  LinkRow,
  NotFoundState,
  PageFrame,
  Panel,
  ReviewStatusBadge,
  StatPill,
  StatusBadge,
  formatDateTime,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";

const STATUS = { TO_INSPECT: ["To inspect", "violet"], VERIFIED: ["Verified", "success"], FLAGGED: ["Flagged", "danger"] } as const;

export default function ReviewerEvidenceDetailPage() {
  const { evidenceId } = useParams<{ evidenceId: string }>();
  const href = useRoleHref("reviewer");
  const { status, retry } = useDemoLoad();
  const lk = useLookups();
  const evidence = useDeliveryStore((s) => s.evidence.find((e) => e.id === evidenceId));
  const review = useDeliveryStore((s) => s.reviews.find((r) => r.id === evidence?.reviewId && r.reviewerId === VIEWERS.reviewer.id));
  const setEvidenceStatus = useDeliveryStore((s) => s.setEvidenceStatus);
  const back = { href: href("evidence"), label: "Back to evidence" };
  const crumbs = [{ label: "QA", href: href() }, { label: "Evidence", href: href("evidence") }, { label: evidence?.title ?? "Evidence" }];

  if (status === "ready" && (!evidence || !review)) {
    return <PageFrame crumbs={crumbs} back={back} title="Evidence"><NotFoundState what="Evidence" back={back} /></PageFrame>;
  }

  const mark = (s: "VERIFIED" | "FLAGGED") => {
    if (!evidence) return;
    setEvidenceStatus(evidence.id, s);
    toast.success(s === "VERIFIED" ? "Evidence verified" : "Evidence flagged", { description: evidence.title });
  };

  return (
    <PageFrame
      crumbs={crumbs}
      back={back}
      title={evidence?.title ?? "Evidence"}
      description={evidence ? `${EVIDENCE_LABEL[evidence.type]} · ${evidence.source}` : undefined}
      status={status}
      onRetry={retry}
      skeleton="detail"
    >
      {evidence && review && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatPill label="State" value={<StatusBadge label={STATUS[evidence.status][0]} tone={STATUS[evidence.status][1]} dot />} />
            <StatPill label="Type" value={EVIDENCE_LABEL[evidence.type]} />
            <StatPill label="Added" value={formatDateTime(evidence.addedAt)} />
            <StatPill label="Review" value={review.code} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Panel className="xl:col-span-2" title="Inspection" icon={Microscope} iconTone="violet">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{evidence.detail}</p>
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {evidence.stats.map((s) => <StatPill key={s.label} label={s.label} value={s.value} />)}
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] p-3 text-[11px] text-[var(--color-text-muted)]">
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate font-mono">{evidence.source}</span>
              </div>
            </Panel>
            <Panel title="Verdict on this item" icon={BadgeCheck} iconTone="emerald" className="self-start">
              <div className="space-y-2">
                <AdminButton className="w-full" disabled={evidence.status === "VERIFIED"} onClick={() => mark("VERIFIED")}>
                  <BadgeCheck className="w-3.5 h-3.5" /> Mark verified
                </AdminButton>
                <AdminButton className="w-full" variant="outline" disabled={evidence.status === "FLAGGED"} onClick={() => mark("FLAGGED")}>
                  <Flag className="w-3.5 h-3.5 text-rose-500" /> Flag a problem
                </AdminButton>
                <p className="text-[10px] text-[var(--color-text-muted)]">Verifying evidence does not approve the work. Decide on the review page.</p>
              </div>
            </Panel>
          </div>
          <Panel title="Linked review" icon={GitPullRequestArrow}>
            <LinkRow href={href(`reviews/${review.id}`)}>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{review.code} · {lk.task(review.taskId)?.title}</p>
                <p className="text-[11px] text-[var(--color-text-muted)] truncate">{lk.person(review.submittedById)?.name} · {lk.project(review.projectId)?.name}</p>
              </div>
              <ReviewStatusBadge status={review.status} />
            </LinkRow>
          </Panel>
        </>
      )}
    </PageFrame>
  );
}
