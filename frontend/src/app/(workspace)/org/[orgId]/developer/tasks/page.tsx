"use client";

import React from "react";
import { useParams } from "next/navigation";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { PageFrame } from "@/components/delivery/DeliveryUI";
import { DevGate } from "@/components/developer/DevUI";
import { useMe } from "@/components/developer/useDeveloperData";
import { WorkBoard } from "@/components/flow/WorkBoard";
import { useMyBoardItems } from "@/components/flow/useFlowApi";

/**
 * My Work: the developer's board (Created, In progress, In review, Completed) and list of Team tasks, plus one outcome
 * per Solo project. Real data only; the server enforces who may move what.
 */
export default function DeveloperMyWorkPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const base = `/org/${orgId}/developer`;
  const work = useMyBoardItems();
  const me = useMe();

  return (
    <PanelLayout title="My Work">
      <PageFrame
        crumbs={[{ label: "Developer", href: `${base}/dashboard` }, { label: "My Work" }]}
        title="My Work"
        description="Your tasks on a board or a list. Start work, submit it with a note and evidence, and see what is blocked."
      >
        <DevGate state={work} what="Your tasks" back={{ href: `${base}/dashboard`, label: "Back to dashboard" }}>
          {(items) => <WorkBoard items={items} base={base} orgId={orgId} myEmail={me.kind === "ready" ? me.data.email : null} />}
        </DevGate>
      </PageFrame>
    </PanelLayout>
  );
}
