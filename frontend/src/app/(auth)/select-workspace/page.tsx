"use client";

import { SelectWorkspaceView } from "@/components/auth/WorkspaceViews";

/** Shown when the signed-in user has more than one active workspace: the choice binds the session (task 1.3). */
export default function SelectWorkspacePage() {
  return <SelectWorkspaceView />;
}
