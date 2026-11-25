// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DashboardLayout } from "./DashboardLayout";

afterEach(cleanup);
it("keeps a single Event, Links, Statistics, Activity reading and keyboard order", () => {
  render(<DashboardLayout event={<a href="#event">Event</a>} quickLinks={<a href="#links">Links</a>} statistics={<a href="#statistics">Statistics</a>} activity={<a href="#activity">Activity</a>} />);
  expect(screen.getAllByRole("link").map(link => link.textContent)).toEqual(["Event", "Links", "Statistics", "Activity"]);
});
