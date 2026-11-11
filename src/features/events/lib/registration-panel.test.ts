import { describe, expect, it } from "vitest";

import type { EventState, EventStateKind } from "./event-states";
import { getPanelSpec, type PanelContext } from "./registration-panel";

// Wed, Aug 26, 2026 at noon Pacific.
const DATE = "2026-08-26T19:00:00Z";

const context: PanelContext = {
  eventName: "Design Sprint",
  eventSlug: "design-sprint",
  endsAt: DATE,
  price: { amount: 15, isMember: false },
  participantPackageUrl: null,
  draftProgress: null,
};

const STATES: Record<EventStateKind, EventState> = {
  "reg-upcoming": { kind: "reg-upcoming", opensAt: DATE },
  "reg-open": { kind: "reg-open", closesAt: DATE },
  "reg-full": { kind: "reg-full" },
  "reg-closed": { kind: "reg-closed", closedAt: DATE },
  "reg-going": { kind: "reg-going", ticketId: "t" },
  "reg-checked-in": { kind: "reg-checked-in", ticketId: "t", checkedInAt: DATE },
  "reg-past": { kind: "reg-past" },
  "reg-past-attended": { kind: "reg-past-attended", ticketId: "t" },
  "app-upcoming": { kind: "app-upcoming", opensAt: DATE },
  "app-open": { kind: "app-open", closesAt: DATE },
  "app-draft": { kind: "app-draft", closesAt: DATE },
  "app-in-review": { kind: "app-in-review" },
  "app-waitlisted": { kind: "app-waitlisted" },
  "app-accepted": { kind: "app-accepted", offerExpiresAt: DATE },
  "app-rejected": { kind: "app-rejected" },
  "app-missed": { kind: "app-missed", closedAt: DATE },
  "app-draft-expired": { kind: "app-draft-expired", closedAt: DATE },
  "app-offer-expired": { kind: "app-offer-expired", offerExpiredAt: DATE, windowOpen: false },
};

const spec = (kind: EventStateKind, overrides: Partial<PanelContext> = {}) =>
  getPanelSpec(STATES[kind], { ...context, ...overrides });

describe("getPanelSpec", () => {
  it.each([
    ["reg-upcoming", "alert", "Registration"],
    ["reg-open", "action", "Registration"],
    ["reg-full", "alert", "Registration"],
    ["reg-closed", "alert", "Registration"],
    ["reg-going", "ticket", "Registration"],
    ["reg-checked-in", "ticket", "Registration"],
    ["reg-past", "alert", "Registration"],
    ["reg-past-attended", "ticket", "Registration"],
    ["app-upcoming", "alert", "Application"],
    ["app-open", "action", "Application"],
    ["app-draft", "action", "Application"],
    ["app-in-review", "alert", "Application"],
    ["app-waitlisted", "alert", "Application"],
    // Accepted: they register next, so the card is Registration again.
    ["app-accepted", "ticket", "Registration"],
    ["app-rejected", "alert", "Application"],
    ["app-missed", "alert", "Application"],
    ["app-draft-expired", "alert", "Application"],
    ["app-offer-expired", "alert", "Application"],
  ] as const)("lays %s out as %s, titled %s", (kind, layout, title) => {
    expect(spec(kind)).toMatchObject({ layout, title });
  });

  it("puts the state's date into the copy, in Pacific time", () => {
    expect(spec("reg-upcoming").props).toMatchObject({
      description: "Registrations open on Wed, Aug 26, 2026.",
    });
    expect(spec("reg-open").props).toMatchObject({ description: "Closes Wed, Aug 26, 2026" });
    expect(spec("reg-past").props).toMatchObject({
      description: "This event ended on Wed, Aug 26, 2026.",
    });
    expect((spec("app-offer-expired").props as { description: string }).description).toContain(
      "wasn’t confirmed by Wed, Aug 26, 2026."
    );
    expect((spec("app-missed").props as { description: string }).description).toMatch(
      /^Applications closed on Wed, Aug 26, 2026\./
    );
  });

  it("leaves the date out when the window has no close", () => {
    const open = getPanelSpec({ kind: "reg-open", closesAt: null }, context);
    expect(open.props).toMatchObject({ description: undefined });
    const draft = getPanelSpec({ kind: "app-draft", closesAt: null }, context);
    expect(draft.props).toMatchObject({ description: "Your answers are saved." });
  });

  it("names the event in the ticket copy", () => {
    expect(spec("reg-going").props).toMatchObject({ title: "You’re going to Design Sprint" });
    expect(spec("reg-past-attended").props).toMatchObject({
      title: "Thanks for coming to Design Sprint",
    });
    expect(spec("app-accepted").props).toMatchObject({ title: "You’re accepted to Design Sprint" });
  });

  it("shows the ticket locked until they register, and used once checked in", () => {
    expect(spec("app-accepted").props).toMatchObject({ ticketState: "locked" });
    expect(spec("reg-going").props).toMatchObject({ ticketState: "active" });
    expect(spec("reg-checked-in").props).toMatchObject({ ticketState: "used" });
  });

  it("sends Register and Confirm to the checkout, Apply and Continue to the form", () => {
    const checkout = { kind: "flow", href: "/portal/events/design-sprint/checkout" };
    const form = { kind: "link", href: "/portal/events/design-sprint/apply" };
    expect(spec("reg-open").props).toMatchObject({ action: { ...checkout, label: "Register" } });
    expect(spec("app-accepted").props).toMatchObject({ primary: { ...checkout, label: "Confirm" } });
    expect(spec("app-open").props).toMatchObject({ action: { ...form, label: "Apply" } });
    expect(spec("app-draft").props).toMatchObject({
      action: { ...form, label: "Continue application" },
    });
  });

  it("offers the participant package only when the event has one", () => {
    expect(spec("reg-going").props).toMatchObject({
      primary: { kind: "view-ticket" },
      secondary: undefined,
    });
    const url = "https://drive.example.com/package";
    for (const kind of ["reg-going", "reg-checked-in"] as const) {
      expect(spec(kind, { participantPackageUrl: url }).props).toMatchObject({
        secondary: { kind: "external", label: "View participant package", href: url },
      });
    }
  });

  it("gives no actions on a past ticket", () => {
    const props = spec("reg-past-attended").props as { primary?: unknown; secondary?: unknown };
    expect(props.primary).toBeUndefined();
    expect(props.secondary).toBeUndefined();
  });

  it("prices the accepted spot by membership, and says nothing when it's free", () => {
    expect(spec("app-accepted").props).toMatchObject({ priceLine: "CA$15.00 for non-members" });
    expect(spec("app-accepted", { price: { amount: 5, isMember: true } }).props).toMatchObject({
      priceLine: "CA$5.00 for members",
    });
    expect(spec("app-accepted", { price: { amount: 0, isMember: true } }).props).toMatchObject({
      priceLine: undefined,
    });
  });

  it("subtitles a ticket with the count and a draft with its progress", () => {
    expect(spec("reg-going").subheading).toBe("1 ticket");
    expect(spec("app-draft", { draftProgress: { answered: 1, total: 3 } }).subheading).toBe(
      "1 of 3 questions answered"
    );
    expect(spec("app-draft").subheading).toBeUndefined();
    expect(spec("app-in-review").subheading).toBeUndefined();
  });

  it("uses the alert variant and icon the copy names", () => {
    expect(spec("reg-full").props).toMatchObject({ variant: "destructive" });
    expect(spec("app-in-review").props).toMatchObject({ variant: "warning" });
    expect(spec("reg-closed").props).toMatchObject({ variant: "neutral" });
    expect((spec("reg-closed").props as { icon?: unknown }).icon).toBeUndefined();
    expect((spec("app-rejected").props as { icon?: unknown }).icon).toBeTruthy();
  });
});
