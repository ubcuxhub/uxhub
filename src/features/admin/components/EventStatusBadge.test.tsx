// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EventStatusBadge } from "./EventStatusBadge";

afterEach(cleanup);

describe("EventStatusBadge", () => {
  it("says Active for an active event, whatever its stale publish date", () => {
    render(<EventStatusBadge status="active" publishAt="2026-11-20T18:00:00.000Z" />);
    expect(screen.getByText("Active")).toBeTruthy();
  });

  it("says Draft for an unscheduled draft", () => {
    render(<EventStatusBadge status="draft" />);
    expect(screen.getByText("Draft")).toBeTruthy();
  });

  it("gives a scheduled draft its Pacific publish date", () => {
    // 2 AM UTC on the 21st is still the 20th in Vancouver.
    render(<EventStatusBadge status="draft" publishAt="2026-11-21T02:00:00.000Z" />);
    expect(screen.getByText("Scheduled Nov 20")).toBeTruthy();
  });
});
