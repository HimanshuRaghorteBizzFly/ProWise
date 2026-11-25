"use client";

import React from "react";
import { platformApi } from "@/lib/admin-api/platform";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { AnnouncementsView } from "@/components/super-admin/AnnouncementsView";
import { useNamedOptions } from "@/components/super-admin/use-named-options";

export default function SuperAdminAnnouncementsPage() {
  const { state, reload } = useAdminResource(() => platformApi.announcements.list(), "announcements");
  const { organizations, plans } = useNamedOptions({ organizations: true, plans: true });

  return (
    <AnnouncementsView
      state={state}
      onRetry={() => void reload()}
      api={platformApi}
      plans={plans}
      organizations={organizations}
    />
  );
}
