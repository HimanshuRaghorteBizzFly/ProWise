"use client";

import { NoWorkspaceView } from "@/components/auth/WorkspaceViews";

/** Signed in without an active membership: explain it and offer to create a company. Never a platform dashboard. */
export default function NoWorkspacePage() {
  return <NoWorkspaceView />;
}
