"use client";

import React from "react";
import { useParams } from "next/navigation";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { PageFrame } from "@/components/delivery/DeliveryUI";
import { DeveloperDashboardView, NotificationsAction } from "@/components/developer/DeveloperDashboardView";
import {
  useDevCalendar,
  useDevDashboard,
  useDevProjects,
  useMyBlockers,
  useMyFeedback,
  useMyWorkItems,
  useStructuredProgress,
} from "@/components/developer/useDeveloperData";

/** Developer dashboard: the caller's own projects, work, blockers, deadlines and GitHub evidence, all from the API. */
export default function DeveloperDashboardPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const base = `/org/${orgId}/developer`;
  const dashboard = useDevDashboard();
  const projects = useDevProjects();
  const work = useMyWorkItems();
  const blockers = useMyBlockers();
  const feedback = useMyFeedback();
  const calendar = useDevCalendar();

  return (
    <PanelLayout title="Developer Dashboard">
      <PageFrame
        crumbs={[{ label: "Developer", href: base }, { label: "Dashboard" }]}
        title="Dashboard"
        description="Your assigned work, open blockers, review feedback and deadlines. GitHub activity is shown as evidence only."
        actions={<NotificationsAction base={base} dashboard={dashboard} />}
      >
        <DeveloperDashboardView
          base={base}
          dashboard={dashboard}
          projects={projects}
          work={work}
          blockers={blockers}
          feedback={feedback}
          calendar={calendar}
          useStructuredProgress={useStructuredProgress}
        />
      </PageFrame>
    </PanelLayout>
  );
}
