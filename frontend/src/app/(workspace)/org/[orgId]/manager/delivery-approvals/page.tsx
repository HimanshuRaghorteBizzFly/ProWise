"use client";

import React from "react";
import { useParams } from "next/navigation";

import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { PageHeader } from "@/components/owner/primitives";
import { PanelLayout } from "@/components/layouts/panel-layout";

export default function ManagerDeliveryApprovalsPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";

  return (
    <PanelLayout
      title="Delivery acceptance"
      breadcrumb={[{ label: "Project Manager", href: `/org/${orgId}/manager` }, { label: "Delivery acceptance" }]}
    >
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Delivery acceptance"
          description="Delivery acceptance is not granted by the project permission matrix."
        />
        <OwnerPageState
          state="forbidden"
          description="No delivery-acceptance permission key is defined for this role. No delivery records or actions are available here."
        />
      </div>
    </PanelLayout>
  );
}
