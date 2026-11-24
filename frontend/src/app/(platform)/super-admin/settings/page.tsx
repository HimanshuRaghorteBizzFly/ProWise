"use client";

import React from "react";
import { platformApi } from "@/lib/admin-api/platform";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { SettingsView } from "@/components/super-admin/SettingsView";

export default function PlatformSettingsPage() {
  const { state, reload } = useAdminResource(() => platformApi.branding.get(), "branding");
  return <SettingsView state={state} onRetry={() => void reload()} api={platformApi} />;
}
