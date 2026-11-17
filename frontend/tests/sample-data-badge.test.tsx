import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SampleDataBadgeView } from "../src/components/navigation/sample-data-badge";

describe("Sample data badge", () => {
  it("is visible and announced when fixture data is in use", () => {
    const markup = renderToStaticMarkup(<SampleDataBadgeView visible />);
    expect(markup).toContain("Sample data");
    expect(markup).toContain('role="status"');
    expect(markup).toContain("not live");
  });

  it("renders nothing for live data", () => {
    expect(renderToStaticMarkup(<SampleDataBadgeView visible={false} />)).toBe("");
  });
});
