"use client";

import React from "react";
import { useParams } from "next/navigation";
import { BlockersView } from "@/components/flow/ManagerViews";

export default function Page() {
  const params = useParams();
  return <BlockersView orgId={(params?.orgId as string) || ""} />;
}
