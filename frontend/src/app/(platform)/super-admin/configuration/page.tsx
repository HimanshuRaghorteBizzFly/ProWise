"use client";

import React from "react";
import { platformApi } from "@/lib/admin-api/platform";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { ConfigurationView } from "@/components/super-admin/ConfigurationView";
import { useNamedOptions } from "@/components/super-admin/use-named-options";

export default function PlatformConfigurationPage() {
  const policies = useAdminResource(() => platformApi.policies.get(), "policies");
  const flags = useAdminResource(() => platformApi.featureFlags.list(), "feature-flags");
  const licenses = useAdminResource(() => platformApi.licenses.list(), "licenses");
  const { organizations, plans } = useNamedOptions({ organizations: true, plans: true });

  return (
    <ConfigurationView
      policies={policies.state}
      flags={flags.state}
      licenses={licenses.state}
      onReloadPolicies={() => void policies.reload()}
      onReloadFlags={() => void flags.reload()}
      onReloadLicenses={() => void licenses.reload()}
      api={platformApi}
      organizations={organizations}
      plans={plans}
    />
  );
}
