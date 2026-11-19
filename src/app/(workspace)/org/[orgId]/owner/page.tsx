"use client";

import React from "react";
import { PanelLayout } from "@/components/layouts/panel-layout";

export default function OrganizationOwnerDashboard() {
  return (
    <PanelLayout title="Dashboard">
      <section
        role="status"
        aria-live="polite"
        className="rounded-xl border border-app-border bg-app-surface p-5"
      >
        <h1 className="text-lg font-semibold text-app-text-primary">Owner dashboard</h1>
        <p className="mt-2 text-sm text-app-text-secondary">
          This dashboard will be developed next.
        </p>
      </section>
    </PanelLayout>
  );
}
