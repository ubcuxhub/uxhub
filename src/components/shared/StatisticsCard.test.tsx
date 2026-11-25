// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { StatisticsCard } from "./StatisticsCard";

afterEach(cleanup);

it("keeps title help available across loading and failure while hiding data controls", () => {
  const titleAction = <Button aria-label="About this statistic">Info</Button>;
  const action = <Button>Choose period</Button>;
  const { rerender } = render(<StatisticsCard title="Members" titleAction={titleAction} action={action}>42</StatisticsCard>);
  expect(screen.getByRole("region", { name: "Members" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "About this statistic" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Choose period" })).toBeTruthy();
  rerender(<StatisticsCard title="Members" titleAction={titleAction} action={action} loading />);
  expect(screen.getByRole("region", { name: "Members" }).getAttribute("aria-busy")).toBe("true");
  expect(screen.getByRole("button", { name: "About this statistic" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Choose period" })).toBeNull();
  rerender(<StatisticsCard title="Members" titleAction={titleAction} action={action} message={{ title: "Unavailable", description: "Try again" }} />);
  expect(screen.getByRole("heading", { name: "Members" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "About this statistic" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Choose period" })).toBeNull();
  expect(screen.getByText("Unavailable")).toBeTruthy();
});

it("keeps title help grouped ahead of the period control in reading and focus order", () => {
  render(<StatisticsCard title="Club Members" titleAction={<Button>About members</Button>} action={<Button>Monthly</Button>}>25</StatisticsCard>);
  const heading = screen.getByRole("heading", { name: "Club Members" });
  const help = screen.getByRole("button", { name: "About members" });
  const period = screen.getByRole("button", { name: "Monthly" });
  expect(heading.parentElement).toBe(help.parentElement);
  expect(period.parentElement).toBe(help.parentElement?.parentElement);
  expect(screen.getAllByRole("button").map(button => button.textContent)).toEqual(["About members", "Monthly"]);
});
