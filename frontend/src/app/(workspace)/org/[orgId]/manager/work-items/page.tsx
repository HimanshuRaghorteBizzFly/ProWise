"use client";

import React from "react";
import { useParams } from "next/navigation";
import { AllWorkView } from "@/components/flow/ManagerViews";

export default function Page() {
  const params = useParams();
  return <AllWorkView orgId={(params?.orgId as string) || ""} />;
}
