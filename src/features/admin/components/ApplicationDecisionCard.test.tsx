// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { datetimeLocalToTimestamptz } from "@/lib/date";

import { ApplicationDecisionCard } from "./ApplicationDecisionCard";

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

const defaultDeadline = { date: "2031-01-11", time: "23:45" } as const;

function renderCard(
  state: Parameters<typeof ApplicationDecisionCard>[0]["state"],
  onDecide = vi.fn().mockResolvedValue(undefined),
  offerExpiresAt: string | null = null,
) {
  render(
    <ApplicationDecisionCard
      state={state}
      firstName="Priya"
      offerExpiresAt={offerExpiresAt}
      defaultDeadline={defaultDeadline}
      onDecide={onDecide}
    />,
  );
  return onDecide;
}
const labels = () => screen.getAllByRole("button").map((button) => button.textContent);

describe("ApplicationDecisionCard", () => {
  it("offers what each state allows", () => {
    renderCard("submitted");
    expect(labels()).toEqual(expect.arrayContaining(["Accept", "Waitlist", "Reject"]));
    cleanup();
    renderCard("accepted", undefined, "2031-11-12T07:45:00Z");
    expect(labels()).toEqual(expect.arrayContaining(["Move deadline", "Take back offer"]));
    cleanup();
    renderCard("offer_expired");
    expect(labels()).toEqual(expect.arrayContaining(["Offer again", "Reject"]));
    cleanup();
    renderCard("rejected");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Priya was rejected. The decision is final.")).toBeTruthy();
  });

  it("accepts with the chosen Pacific deadline", async () => {
    const onDecide = renderCard("submitted");
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(onDecide).toHaveBeenCalledTimes(1));
    expect(onDecide).toHaveBeenCalledWith("accept", datetimeLocalToTimestamptz("2031-01-11T23:45"));
  });

  it("waitlists without a deadline", async () => {
    const onDecide = renderCard("submitted");
    fireEvent.click(screen.getByRole("button", { name: "Waitlist" }));
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith("waitlist", null));
  });

  it("confirms before rejecting", async () => {
    const onDecide = renderCard("submitted");
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onDecide).not.toHaveBeenCalled();
    expect(await screen.findByText("Reject Priya’s application?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Keep reviewing" }));
    expect(onDecide).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    const confirm = (await screen.findAllByRole("button", { name: "Reject" })).at(-1)!;
    fireEvent.click(confirm);
    await waitFor(() => expect(onDecide).toHaveBeenCalledWith("reject", null));
  });

  it("shows a failure and keeps the form", async () => {
    const onDecide = vi.fn().mockRejectedValue(new Error("boom"));
    renderCard("submitted", onDecide);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn’t save the decision");
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
  });
});
