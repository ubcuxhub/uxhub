// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  describe("notes and buttons", () => {
    function renderWith(props: Partial<Parameters<typeof ApplicationDecisionCard>[0]>) {
      render(
        <ApplicationDecisionCard
          state="submitted"
          firstName="Priya"
          offerExpiresAt={null}
          defaultDeadline={defaultDeadline}
          onDecide={vi.fn().mockResolvedValue(undefined)}
          {...props}
        />,
      );
    }
    const notes = () => screen.getAllByRole("note");
    const actions = () =>
      within(screen.getByRole("group", { name: "Decide" }))
        .getAllByRole("button")
        .map((button) => button.textContent);

    it("puts the secondary actions first and the accept last", () => {
      renderWith({});
      expect(actions()).toEqual(["Reject", "Waitlist", "Accept"]);
    });

    it("offers a waitlisted applicant a spot once decisions are out, with their place", () => {
      renderWith({
        state: "waitlisted",
        waitlist: { position: 3, appliedAt: "2026-10-29T18:00:00Z" },
        capacity: 60,
        openSeats: 2,
      });
      expect(actions()).toEqual(["Reject", "Offer spot"]);
      expect(notes()[0].textContent).toBe(
        "Priya is #3 on the waitlist (applied Oct 29). 2 spots are open.",
      );
      expect(notes()[0].getAttribute("data-tone")).toBe("info");
      expect(notes()).toHaveLength(1);
    });

    it("keeps Accept for a waitlisted applicant before release", () => {
      renderWith({ state: "waitlisted", releaseAt: "2031-01-04T17:00:00Z" });
      expect(actions()).toEqual(["Reject", "Accept"]);
      expect(notes()[0].getAttribute("data-tone")).toBe("neutral");
    });

    it("warns before an accept the event has no seat for, and still allows it", () => {
      renderWith({ capacity: 60, openSeats: 0 });
      expect(notes()[1].textContent).toBe(
        "All 60 spots are held, so accepting Priya goes over capacity. Take back an offer or raise the capacity in the event builder to make room.",
      );
      expect(screen.getByRole("button", { name: "Accept" }).hasAttribute("disabled")).toBe(false);
    });

    it("doesn't warn when the accept keeps a seat already held", () => {
      renderWith({ state: "accepted", offerExpiresAt: "2031-11-12T07:45:00Z", capacity: 60, openSeats: 0 });
      expect(notes()).toHaveLength(1);
    });

    it("locks the note once nothing can change", () => {
      renderWith({ state: "registered" });
      expect(screen.queryByRole("button")).toBeNull();
      expect(notes()[0].getAttribute("data-tone")).toBe("locked");
      expect(notes()[0].textContent).toBe("Priya registered, so the decision is final.");
    });
  });
});
