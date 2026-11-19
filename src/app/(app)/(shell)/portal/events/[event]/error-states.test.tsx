// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
// Static image imports don't resolve outside the Next bundler.
vi.mock("@/components/shared/Hubbo", () => ({ Hubbo: () => null }));

import EventPageError from "./error";
import EventNotFound from "./not-found";
import { EventRemovedStatus } from "@/features/events/components/EventPageStatus";

afterEach(cleanup);

it("offers a retry that re-fetches when the event fails to load", () => {
  const retry = vi.fn();
  render(<EventPageError error={new Error("fetch failed")} retry={retry} />);

  expect(screen.getByRole("heading", { level: 1, name: "We couldn't load this event" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to Events" }).getAttribute("href")).toBe("/portal/events");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalledTimes(1);
});

it("tells a member an unpublished event is gone and where to ask about a ticket", () => {
  render(<EventRemovedStatus />);

  expect(screen.getByRole("heading", { level: 1, name: "This event is no longer available" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "ubcuxhub@gmail.com" }).getAttribute("href")).toBe("mailto:ubcuxhub@gmail.com");
  expect(screen.getByRole("link", { name: "Browse events" }).getAttribute("href")).toBe("/portal/events");
});

it("keeps an unknown or missing event neutral, without claiming it was removed", () => {
  render(<EventNotFound />);

  expect(screen.getByRole("heading", { level: 1, name: "We can't find this event" })).toBeTruthy();
  expect(screen.queryByText(/removed/)).toBeNull();
  expect(screen.getByRole("link", { name: "Browse events" }).getAttribute("href")).toBe("/portal/events");
});
