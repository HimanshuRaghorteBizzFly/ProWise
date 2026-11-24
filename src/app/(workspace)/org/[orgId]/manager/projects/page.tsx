"use client";

import React from "react";

import { ProjectsPortfolioView } from "@/components/projects/ApiProjectViews";

/** All projects (task 2.1, real API; the server decides which projects are readable). */
export default function Page() {
  return <ProjectsPortfolioView base="manager" />;
}
