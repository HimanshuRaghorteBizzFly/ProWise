"use client";

import React from "react";
import { FlaskConical } from "lucide-react";
import { useStore } from "zustand";

import { mocksRequested, readPermissionEnv } from "@/lib/permissions";
import { useAuthStore } from "@/store/auth-store";
import { permissionStore } from "@/store/permission-store";
import { sampleDataStore } from "@/store/sample-data-store";

export function SampleDataBadgeView({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span
      role="status"
      title="This screen shows typed sample data, not live data from the API."
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 text-xs font-semibold text-amber-800 sm:px-2.5 dark:text-amber-300"
    >
      <FlaskConical className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="sm:hidden" aria-hidden="true">Sample</span>
      <span className="sr-only sm:not-sr-only">Sample data</span>
      <span className="sr-only">: not live</span>
    </span>
  );
}

/**
 * Reads the permission and sample-data stores without triggering a load, so roles that never request
 * permissions make no extra API call. Visible whenever fixtures are requested or in use.
 */
export function SampleDataBadge() {
  const orgId = useAuthStore((state) => state.currentOrg.id);
  const fixtureInUse = useStore(
    permissionStore,
    (state) => state.source === "fixture" && state.orgId === orgId,
  );
  const pageFixtureInUse = useStore(sampleDataStore, (state) => Object.keys(state.sources).length > 0);
  return <SampleDataBadgeView visible={fixtureInUse || pageFixtureInUse || mocksRequested(readPermissionEnv())} />;
}
