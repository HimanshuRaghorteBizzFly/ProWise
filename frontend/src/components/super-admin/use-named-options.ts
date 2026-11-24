"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import type { NamedOption } from "./AnnouncementsView";

/**
 * Organization and plan names from the server, for pickers. A failed read leaves the list empty (the picker then
 * says nothing was returned); no placeholder names are ever shown.
 */
export function useNamedOptions(which: { organizations?: boolean; plans?: boolean }) {
  const [organizations, setOrganizations] = useState<NamedOption[]>([]);
  const [plans, setPlans] = useState<NamedOption[]>([]);
  const wantOrgs = Boolean(which.organizations);
  const wantPlans = Boolean(which.plans);

  useEffect(() => {
    let alive = true;
    if (wantOrgs) {
      apiClient.admin.organizations
        .list()
        .then((rows) => alive && setOrganizations(rows.map((o) => ({ id: o.id, name: o.name }))))
        .catch(() => undefined);
    }
    if (wantPlans) {
      apiClient.admin.plans
        .list()
        .then((rows) => alive && setPlans(rows.map((p) => ({ id: p.id, name: p.name }))))
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, [wantOrgs, wantPlans]);

  return { organizations, plans };
}
