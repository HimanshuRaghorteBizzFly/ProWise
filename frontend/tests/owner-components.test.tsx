import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { OwnerChartFrame } from "../src/components/owner/OwnerChartFrame";
import { OwnerKpiCard } from "../src/components/owner/OwnerKpiCard";
import { OwnerPageState } from "../src/components/owner/OwnerPageState";
import { OwnerPanel } from "../src/components/owner/OwnerPanel";
import { OwnerTable } from "../src/components/owner/OwnerTable";

describe("Owner shared components", () => {
  it("renders KPI values with a labeled group and tabular figures", () => {
    const markup = renderToStaticMarkup(
      <OwnerKpiCard label="Active projects" value={12} detail="Across the organization" />,
    );

    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-label="Active projects"');
    expect(markup).toContain("tabular-nums");
    expect(markup).toContain(">12<");
  });

  it("renders panels as labeled regions with their content", () => {
    const markup = renderToStaticMarkup(
      <OwnerPanel title="Portfolio" description="Current delivery overview">
        <p>Project summary</p>
      </OwnerPanel>,
    );

    expect(markup).toContain('role="region"');
    expect(markup).toContain('aria-labelledby="');
    expect(markup).toContain("<h2");
    expect(markup).toContain("Portfolio");
    expect(markup).toContain("Project summary");
  });

  it("gives chart content a caption and responsive container", () => {
    const markup = renderToStaticMarkup(
      <OwnerChartFrame title="Projects by health" description="Health status by project">
        <svg aria-hidden="true" />
      </OwnerChartFrame>,
    );

    expect(markup).toContain("<figure");
    expect(markup).toContain("<figcaption");
    expect(markup).toContain("Projects by health");
    expect(markup).toContain("min-w-0");
    expect(markup).toContain("h-[clamp(");
  });

  it("makes horizontally scrollable tables keyboard reachable and named", () => {
    const markup = renderToStaticMarkup(
      <OwnerTable label="Organization members">
        <tbody>
          <tr>
            <td>Member</td>
          </tr>
        </tbody>
      </OwnerTable>,
    );

    expect(markup).toContain('role="region"');
    expect(markup).toContain('aria-label="Organization members"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain("overflow-x-auto");
    expect(markup).toContain("<table");
  });

  it("announces loading and empty states accessibly", () => {
    const loadingMarkup = renderToStaticMarkup(
      <OwnerPageState state="loading" label="Loading organization overview" />,
    );
    const emptyMarkup = renderToStaticMarkup(
      <OwnerPageState
        state="empty"
        title="No projects yet"
        description="Projects will appear here when they are created."
        action={{ label: "Create a project", onAction: vi.fn() }}
      />,
    );

    expect(loadingMarkup).toContain('role="status"');
    expect(loadingMarkup).toContain('aria-busy="true"');
    expect(loadingMarkup).toContain("Loading organization overview");
    expect(emptyMarkup).toContain('role="status"');
    expect(emptyMarkup).toContain("No projects yet");
    expect(emptyMarkup).toContain("Create a project");
  });

  it("announces failures and access denial with the requested recovery", () => {
    const onRetry = vi.fn();
    const errorMarkup = renderToStaticMarkup(
      <OwnerPageState state="error" title="Unable to load projects" onRetry={onRetry} />,
    );
    const forbiddenMarkup = renderToStaticMarkup(
      <OwnerPageState state="forbidden" requiredPermission="project:read" />,
    );
    const accessLostMarkup = renderToStaticMarkup(
      <OwnerPageState state="access-lost" description="Your workspace expired." onRetry={onRetry} />,
    );

    expect(errorMarkup).toContain('role="alert"');
    expect(errorMarkup).toContain("Unable to load projects");
    expect(errorMarkup).toContain(">Retry<");
    expect(forbiddenMarkup).toContain('role="alert"');
    expect(forbiddenMarkup).toContain("project:read");
    expect(accessLostMarkup).toContain('role="alert"');
    expect(accessLostMarkup).toContain("Access lost");
    expect(accessLostMarkup).toContain("Your workspace expired.");
  });
});
