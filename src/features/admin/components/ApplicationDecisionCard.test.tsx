// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { datetimeLocalToTimestamptz, formatTimestamp } from "@/lib/date";

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

  it("shows the server's refusal in place", async () => {
    const onDecide = vi.fn().mockResolvedValue("This applicant already registered, so the offer can’t be changed.");
    renderCard("submitted", onDecide);
    fireEvent.click(screen.getByRole("button", { name: "Waitlist" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "This applicant already registered, so the offer can’t be changed.",
    );
  });

  describe("before decisions are released", () => {
    const releaseAt = "2031-01-04T17:00:00Z";

    function renderUnreleased(
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
          releaseAt={releaseAt}
          onDecide={onDecide}
        />,
      );
      return onDecide;
    }

    it("says the decision is hidden, and lets a rejection change", () => {
      renderUnreleased("rejected");
      expect(screen.getByText(`Hidden from Priya until ${formatTimestamp(releaseAt)}.`)).toBeTruthy();
      expect(
        screen.getByText("Priya is marked as rejected. You can change this until decisions are released."),
      ).toBeTruthy();
      expect(labels()).toEqual(expect.arrayContaining(["Accept", "Waitlist"]));
    });

    it("lets an accepted applicant be waitlisted", () => {
      renderUnreleased("accepted", undefined, "2031-01-11T07:45:00Z");
      expect(labels()).toEqual(expect.arrayContaining(["Move deadline", "Waitlist", "Take back offer"]));
    });

    it("refuses a deadline before the release", async () => {
      const onDecide = vi.fn().mockResolvedValue(undefined);
      render(
        <ApplicationDecisionCard
          state="submitted"
          firstName="Priya"
          offerExpiresAt={null}
          defaultDeadline={{ date: "2031-01-03", time: "23:45" }}
          releaseAt={releaseAt}
          onDecide={onDecide}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Accept" }));
      expect((await screen.findByText("Pick a time after decisions are released."))).toBeTruthy();
      expect(onDecide).not.toHaveBeenCalled();
    });

    it("says a rejection can still change", async () => {
      renderUnreleased("submitted");
      fireEvent.click(screen.getByRole("button", { name: "Reject" }));
      expect(
        await screen.findByText(
          "Priya will see “Not selected” on the event page once decisions are released. You can change this until then.",
        ),
      ).toBeTruthy();
    });
  });
});
