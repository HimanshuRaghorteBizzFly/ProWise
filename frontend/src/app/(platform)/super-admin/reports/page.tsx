"use client";

import React, { useState } from "react";
import { platformApi } from "@/lib/admin-api/platform";
import type { ReportsOverview } from "@/types/admin-platform";
import { useAdminResource, useDebounced } from "@/components/super-admin/admin-resource";
import { ReportsView, presetRange, rangeError, type ReportRange } from "@/components/super-admin/ReportsView";

export default function ReportsAnalyticsPage() {
  const [range, setRange] = useState<ReportRange>(() => presetRange("6M"));
  const applied = useDebounced(range, 400);
  const invalid = rangeError(applied);
  const { state, reload } = useAdminResource<ReportsOverview | null>(
    () => (invalid ? Promise.resolve(null) : platformApi.reports.overview(applied.from, applied.to)),
    `${applied.from}|${applied.to}`,
  );

  const viewState = invalid
    ? ({ status: "invalid", message: invalid } as const)
    : state.status === "ready" && state.data === null
      ? ({ status: "loading" } as const)
      : (state as React.ComponentProps<typeof ReportsView>["state"]);

  return <ReportsView state={viewState} range={range} onRangeChange={setRange} onRetry={() => void reload()} />;
}
