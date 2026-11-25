"use client";

import React, { Suspense } from "react";
import { GitHubCallbackView } from "@/components/flow/GitHubIntegration";

/**
 * GitHub App callback URL: GitHub returns the installer here with installation_id, code and state. The page posts them
 * to the API as the signed-in user; the server checks the state and that the GitHub account controls the installation.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <GitHubCallbackView />
    </Suspense>
  );
}
