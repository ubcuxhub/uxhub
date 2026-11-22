// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StatCard } from "./stat-card";

afterEach(cleanup);

describe("StatCard", () => {
  it("shows a rate as a fraction, not a percentage", () => {
    const { container } = render(
      <StatCard label="Registered" kind="rate" count={412} total={528} noun="seats" />,
    );

    const card = screen.getByRole("group", { name: "Registered" });
    expect(card.textContent).toContain("412 / 528 seats");
    expect(card.textContent).not.toContain("%");
    expect(screen.getByText("412 of 528 seats")).toBeTruthy();
    expect(container.querySelector("p.text-h1")?.textContent).toBe("412 / 528 seats");
  });

  it("shows only the detail under a rate", () => {
    render(<StatCard label="Seats held" kind="rate" count={3} total={40} noun="seats" detail="2 going, 1 offer out" />);
    expect(screen.getByText("2 going, 1 offer out")).toBeTruthy();
    expect(screen.queryByText(/ · /)).toBeNull();
  });

  it("formats large numbers and shows a count above the total as is", () => {
    render(<StatCard label="Registered" kind="rate" count={1234} total={1000} noun="seats" />);
    expect(screen.getByRole("group", { name: "Registered" }).textContent).toContain("1,234 / 1,000 seats");
  });

  it("shows 0 / 0 when the total is 0, without dividing", () => {
    render(<StatCard label="Registered" kind="rate" count={0} total={0} noun="seats" />);
    const card = screen.getByRole("group", { name: "Registered" });
    expect(card.textContent).toContain("0 / 0 seats");
    expect(card.textContent).not.toContain("NaN");
    expect(screen.queryByText("Not enough data")).toBeNull();
  });

  it("uses the insufficient state with its reason", () => {
    render(<StatCard label="Sponsor return" kind="insufficient" reason="Fewer than 3 sponsors." />);
    expect(screen.getByText("Not enough data")).toBeTruthy();
    expect(screen.getByText("Fewer than 3 sponsors.")).toBeTruthy();
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

  it("shows a text value as given, with its detail line", () => {
    render(<StatCard label="Team deadline" kind="value" value="Jan 10" detail="Passed · teams are locked" />);

    const card = screen.getByRole("group", { name: "Team deadline" });
    expect(card.textContent).toContain("Jan 10");
    expect(card.textContent).toContain("Passed · teams are locked");
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
