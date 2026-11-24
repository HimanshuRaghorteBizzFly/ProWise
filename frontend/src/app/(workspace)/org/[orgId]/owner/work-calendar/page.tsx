"use client";

import { useParams } from "next/navigation";

import { OrgGate } from "@/components/org-console/OrgUI";
import { WorkCalendarView } from "@/components/calendar/CalendarViews";

/** Task 2.3: organization work calendar (editing needs org.manage; others see it read-only). */
export default function WorkCalendarPage() {
  const params = useParams();
  const home = `/org/${(params?.orgId as string) || ""}/owner`;
  return (
    <OrgGate family="owner">
      <WorkCalendarView crumbs={[{ label: "Owner", href: home }]} back={{ href: home, label: "Back to dashboard" }} />
    </OrgGate>
  );
}
