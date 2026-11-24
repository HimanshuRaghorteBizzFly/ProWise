"use client";

import React from "react";
import { operationsApi } from "@/lib/admin-api/operations";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { GitHubRepositoriesView } from "@/components/super-admin/operations/IntegrationViews";

export default function GitHubIntegrationPage() {
  const { state, reload } = useAdminResource(() => operationsApi.githubRepositories(), "github-repositories");
  return <GitHubRepositoriesView repositories={state} onRetry={reload} />;
}
