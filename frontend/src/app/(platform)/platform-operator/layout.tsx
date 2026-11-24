import React from "react";
import { OperatorShell } from "./_components/OperatorShell";

export default function PlatformOperatorLayout({ children }: { children: React.ReactNode }) {
  return <OperatorShell>{children}</OperatorShell>;
}
