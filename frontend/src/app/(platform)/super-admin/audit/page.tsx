"use client";

import React, { useEffect, useMemo, useState } from "react";
import { platformApi } from "@/lib/admin-api/platform";
import { useAdminResource, useDebounced } from "@/components/super-admin/admin-resource";
import {
  AuditLogView,
  EMPTY_AUDIT_FILTERS,
  auditQueryFromFilters,
  type AuditFilters,
} from "@/components/super-admin/AuditLogView";

export default function SuperAdminAuditPage() {
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const applied = useDebounced(filters);
  const query = useMemo(() => auditQueryFromFilters(applied), [applied]);
  const { state, reload } = useAdminResource(() => platformApi.auditLogs.list(query), JSON.stringify(query));

  // Category options come only from categories the server has actually recorded.
  const [categories, setCategories] = useState<string[]>([]);
  useEffect(() => {
    if (state.status !== "ready") return;
    setCategories((prev) => Array.from(new Set([...prev, ...state.data.map((l) => l.category).filter(Boolean)])).sort());
  }, [state]);

  return (
    <AuditLogView
      state={state}
      filters={filters}
      categories={categories}
      onFiltersChange={setFilters}
      onRetry={() => void reload()}
    />
  );
}
