// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatCard } from "./stat-card";

afterEach(cleanup);

describe("StatCard", () => {
  it("rounds rates and always shows their count", () => {
    render(
      <StatCard
        label="Registration rate"
        kind="rate"
        count={412}
        total={528}
        noun="registrants"
      />,
    );

    expect(screen.getByText("78")).toBeTruthy();
    expect(screen.getByText("412 of 528 registrants")).toBeTruthy();
  });

  it("uses the insufficient state when a rate has no total", () => {
    render(
      <StatCard
        label="Registration rate"
        kind="rate"
        count={0}
        total={0}
        noun="registrants"
      />,
    );

    expect(screen.getByText("Not enough data")).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
  });

  it("keeps change styling neutral and gives screen readers the direction", () => {
    const { container } = render(
      <StatCard
        label="Active members"
        kind="value"
        value={312}
        change={{ delta: 24, period: "since last term" }}
      />,
    );

    expect(screen.getByText("Up 24 since last term")).toBeTruthy();
    const change = container.querySelector('[data-slot="stat-card-change"]');
    expect(change?.className).not.toMatch(
      /success|warning|destructive|transaction/,
    );
  });

  it("formats values for Canada and labels the group", () => {
    render(<StatCard label="Members" kind="value" value={1234} />);

    expect(screen.getByRole("group", { name: "Members" })).toBeTruthy();
    expect(screen.getByText("1,234")).toBeTruthy();
  });

  it("marks loading cards busy and renders content-shaped skeletons", () => {
    const { container } = render(
      <StatCard label="Active members" kind="loading" />,
    );

    expect(
      screen.getByRole("group", { name: "Active members", busy: true }),
    ).toBeTruthy();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
  });
});
