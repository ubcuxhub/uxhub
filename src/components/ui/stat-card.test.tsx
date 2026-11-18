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

  it("explains the count behind a rate", () => {
    render(<StatCard label="Seats held" kind="rate" count={3} total={40} noun="seats" detail="2 tickets, 1 offer" />);
    expect(screen.getByText("3 of 40 seats · 2 tickets, 1 offer")).toBeTruthy();
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

it.each([[12,48,"of 48 going · 25%"],[0,0,"of 0 going · 0%"]] as const)("keeps count primary with a safe denominator/rate caption",(count,total,caption)=>{
  render(<StatCard label="Checked in" kind="count" count={count} total={total} noun="going" showRate/>);
  expect(screen.getByText(String(count))).toBeTruthy();expect(screen.getByText(caption)).toBeTruthy();
});
