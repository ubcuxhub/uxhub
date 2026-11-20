import { describe, expect, it } from "vitest";

import type { EventState, EventStateKind } from "./event-states";
import {
  CANCELED_TITLE,
  getPanelSpec,
  REFUND_DONE,
  REFUND_PENDING,
  type PanelContext,
} from "./registration-panel";

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
  canceled: { kind: "canceled", note: "Moved to January.", ticketId: "t" },
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
    ["canceled", "alert", "Registration"],
    ["reg-upcoming", "alert", "Registration"],
    ["reg-open", "action", "Registration"],
    ["reg-full", "alert", "Registration"],
    ["reg-closed", "alert", "Registration"],
    ["reg-going", "ticket", "Registration"],
    ["reg-checked-in", "ticket", "Registration"],
    ["reg-past", "action", "Registration"],
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

  it("shows an expired ticket once the event ends, checked in or not", () => {
    expect(spec("reg-past-attended").props).toMatchObject({
      badge: { status: "past", label: "Ticket expired" },
      description: "This event has ended.",
      ticketState: "expired",
      ticketNote: "No longer valid",
    });
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

  it("leaves a past event without a ticket as plain copy", () => {
    expect(spec("reg-past").props).not.toHaveProperty("action");
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

  it("says when decisions are released while they're held back", () => {
    const held = getPanelSpec({ kind: "app-in-review", decisionsReleaseAt: DATE }, context);
    expect(held).toMatchObject({
      title: "Application",
      layout: "alert",
      props: {
        variant: "warning",
        title: "Your application is in review",
        description: "Decisions are released Wed, Aug 26, 2026 at 12:00 PM. We’ll also email you then.",
      },
    });
  });

  // The application-emails job sends each released decision, including a
  // later offer to someone on the waitlist; nothing else is promised.
  it("says decisions and waitlist offers are emailed", () => {
    expect(spec("app-in-review").props).toMatchObject({ description: "We’ll email you when there’s a decision, and it’ll show here too." });
    expect(spec("app-waitlisted").props).toMatchObject({
      description:
        "You’ll be notified here on the portal and by email if you’re offered a spot. You don’t need to do anything until then.",
    });
    for (const kind of ["app-accepted", "app-rejected", "app-offer-expired"] as const) {
      expect(JSON.stringify(spec(kind).props)).not.toMatch(/e-?mail/i);
    }
  });

  it("uses the alert variant and icon the copy names", () => {
    expect(spec("reg-full").props).toMatchObject({ variant: "destructive" });
    expect(spec("app-in-review").props).toMatchObject({ variant: "warning" });
    expect(spec("reg-closed").props).toMatchObject({ variant: "neutral" });
    // A lock, as on Applications are closed (Figma 1.12).
    expect((spec("reg-closed").props as { icon?: unknown }).icon).toBeTruthy();
    expect((spec("app-rejected").props as { icon?: unknown }).icon).toBeTruthy();
  });
});

describe("getPanelSpec for a canceled event", () => {
  const canceled = (state: Partial<Extract<EventState, { kind: "canceled" }>>, overrides: Partial<PanelContext> = {}) =>
    getPanelSpec({ kind: "canceled", note: null, ticketId: null, ...state }, { ...context, ...overrides });

  it("shows an alert, never the ticket or its code", () => {
    const spec = canceled({ ticketId: "t" });
    expect(spec).toMatchObject({
      title: "Registration",
      layout: "alert",
      props: { variant: "destructive", title: CANCELED_TITLE },
    });
    expect((spec.props as { icon?: unknown }).icon).toBeTruthy();
  });

  it("gives the note, then where the refund stands", () => {
    expect(canceled({ note: "Moved to January.", ticketId: "t" }, { refund: "not-refunded" }).props).toMatchObject({
      description: `Moved to January. ${REFUND_PENDING}`,
    });
    expect(canceled({ ticketId: "t" }, { refund: "refunded" }).props).toMatchObject({ description: REFUND_DONE });
  });

  it("says nothing about refunds without a payment", () => {
    expect(canceled({ note: "Moved to January.", ticketId: "t" }).props).toMatchObject({
      description: "Moved to January.",
    });
    expect(canceled({ ticketId: "t" }, { refund: null }).props).toMatchObject({
      description: "You don’t need to do anything.",
    });
    expect((canceled({}).props as { description: string }).description).toMatch(/^Keep an eye out/);
  });
});
