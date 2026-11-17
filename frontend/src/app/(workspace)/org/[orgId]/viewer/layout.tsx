import React from "react";
import { ViewerShell } from "./_components/ViewerShell";

export default function ViewerLayout({ children }: { children: React.ReactNode }) {
  return <ViewerShell>{children}</ViewerShell>;
}
