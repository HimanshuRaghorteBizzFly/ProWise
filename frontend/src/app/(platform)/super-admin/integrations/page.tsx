"use client";

import React from "react";
import { operationsApi } from "@/lib/admin-api/operations";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { IntegrationsOverviewView } from "@/components/super-admin/operations/IntegrationViews";

export default function IntegrationOverviewPage() {
  const integrations = useAdminResource(() => operationsApi.integrations(), "integrations");
  const repositories = useAdminResource(() => operationsApi.githubRepositories(), "github-repositories");

  return (
    <IntegrationsOverviewView
      integrations={integrations.state}
      repositories={repositories.state}
      onRetryIntegrations={integrations.reload}
      onRetryRepositories={repositories.reload}
    />
  );
}
