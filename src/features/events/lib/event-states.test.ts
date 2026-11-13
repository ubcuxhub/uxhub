import { describe, expect, it } from "vitest";

import type { EventApplicationStatus } from "@/lib/supabase/models";

import {
  eventStateFor,
  type StateEvent,
  type StudentEventState,
  type TicketCheckIn,
} from "./event-states";

const now = new Date("2026-10-15T19:00:00Z");
const ms = (offset: number) => new Date(now.getTime() + offset).toISOString();
const hour = 60 * 60 * 1000;
const day = 24 * hour;

// Registration opened yesterday and closes in a week; the event is in two weeks.
const event: StateEvent = {
  starts_at: "2026-10-29T01:00:00Z",
  ends_at: "2026-10-29T04:00:00Z",
  registration_opens_at: "2026-10-14T19:00:00Z",
  registration_closes_at: "2026-10-22T19:00:00Z",
  requires_application: false,
};
const appEvent: StateEvent = { ...event, requires_application: true };
/** Registration closed yesterday; the event is still ahead. */
const closed = { registration_closes_at: ms(-day) };
/** Started yesterday, ends tomorrow. */
const running = { starts_at: ms(-day), ends_at: ms(day) };
const ended = { starts_at: ms(-2 * day), ends_at: ms(-day) };

const nothing: StudentEventState = { ticket: null, application: null, seatsLeft: 5 };
const ticket = (...check_ins: TicketCheckIn[]) => ({ id: "ticket-1", check_ins });
const scan = (checked_in_at: string | null, end_time: string | null = null): TicketCheckIn => ({
  checked_in_at,
  session: { end_time },
});
const application = (
  status: EventApplicationStatus,
  offer_expires_at: string | null = null
) => ({ status, offer_expires_at });

const stateOf = (
  overrides: Partial<StateEvent>,
  student: Partial<StudentEventState> = {},
  base: StateEvent = event
) => eventStateFor({ ...base, ...overrides }, { ...nothing, ...student }, now);

describe("eventStateFor", () => {
  describe("1. once the event has ended", () => {
    it("is past without a ticket", () => {
      expect(stateOf(ended)).toEqual({ kind: "reg-past" });
    });

    it("is past-attended with a ticket, scanned or not", () => {
      for (const held of [ticket(), ticket(scan(ms(-day - hour)))]) {
        expect(stateOf(ended, { ticket: held })).toEqual({
          kind: "reg-past-attended",
          ticketId: "ticket-1",
        });
      }
    });

    it("beats every application state", () => {
      const statuses: EventApplicationStatus[] = [
        "draft",
        "submitted",
        "waitlisted",
        "accepted",
        "rejected",
      ];
      for (const status of statuses) {
        const state = stateOf(ended, { application: application(status, ms(day)) }, appEvent);
        expect(state, status).toEqual({ kind: "reg-past" });
      }
    });

    it("ends an event without an end time when it starts", () => {
      expect(stateOf({ starts_at: ms(-1), ends_at: null })).toEqual({ kind: "reg-past" });
    });

    it("hasn't ended at exactly its end time", () => {
      const state = stateOf({ starts_at: ms(-hour), ends_at: ms(0) }, { ticket: ticket() });
      expect(state.kind).toBe("reg-going");
    });
  });

  describe("2. with a ticket", () => {
    it("is going until scanned", () => {
      expect(stateOf({}, { ticket: ticket() })).toEqual({
        kind: "reg-going",
        ticketId: "ticket-1",
      });
    });

    it("beats closed, full and every application state", () => {
      expect(stateOf(closed, { ticket: ticket(), seatsLeft: 0 }).kind).toBe("reg-going");
      const accepted = { ticket: ticket(), application: application("accepted", ms(day)) };
      expect(stateOf({}, accepted, appEvent).kind).toBe("reg-going");
    });

    it("is checked in from the scan until its session ends", () => {
      const scannedAt = ms(-hour);
      const during = stateOf(running, { ticket: ticket(scan(scannedAt, ms(hour))) });
      expect(during).toEqual({ kind: "reg-checked-in", ticketId: "ticket-1", checkedInAt: scannedAt });

      const atEnd = stateOf(running, { ticket: ticket(scan(scannedAt, ms(0))) });
      expect(atEnd.kind).toBe("reg-checked-in");
    });

    it("is going again once the session has ended, until the next scan", () => {
      const yesterday = scan(ms(-day), ms(-day + 8 * hour));
      expect(stateOf(running, { ticket: ticket(yesterday) }).kind).toBe("reg-going");

      const today = scan(ms(-hour), ms(hour));
      expect(stateOf(running, { ticket: ticket(yesterday, today) })).toEqual({
        kind: "reg-checked-in",
        ticketId: "ticket-1",
        checkedInAt: today.checked_in_at,
      });
    });

    it("counts a session without an end time until the event ends", () => {
      const state = stateOf(running, { ticket: ticket(scan(ms(-day), null)) });
      expect(state.kind).toBe("reg-checked-in");
    });

    it("names the latest scan when sessions overlap", () => {
      const earlier = scan(ms(-2 * hour), ms(hour));
      const later = scan(ms(-hour), ms(2 * hour));
      const state = stateOf(running, { ticket: ticket(earlier, later) });
      expect(state).toMatchObject({ kind: "reg-checked-in", checkedInAt: later.checked_in_at });
    });

    it("ignores a check-in without a time", () => {
      expect(stateOf(running, { ticket: ticket(scan(null, ms(hour))) }).kind).toBe("reg-going");
    });
  });

  describe("3. before registration opens", () => {
    it("is upcoming, with the opening date", () => {
      const opensAt = ms(day);
      expect(stateOf({ registration_opens_at: opensAt })).toEqual({ kind: "reg-upcoming", opensAt });
      expect(stateOf({ registration_opens_at: opensAt }, {}, appEvent)).toEqual({
        kind: "app-upcoming",
        opensAt,
      });
    });

    it("shows a decided or submitted application over upcoming", () => {
      // An admin moved the opening later after they'd applied.
      const later = { registration_opens_at: ms(day) };
      const cases = [
        ["submitted", "app-in-review"],
        ["waitlisted", "app-waitlisted"],
        ["rejected", "app-rejected"],
        ["accepted", "app-accepted"],
      ] as const;
      for (const [status, kind] of cases) {
        const student = { application: application(status, ms(2 * day)) };
        expect(stateOf(later, student, appEvent).kind, status).toBe(kind);
      }
      const expired = { application: application("accepted", ms(-hour)) };
      expect(stateOf(later, expired, appEvent)).toEqual({
        kind: "app-offer-expired",
        offerExpiredAt: ms(-hour),
        windowOpen: false,
      });
    });

    it("keeps a draft upcoming, since it can't be submitted yet", () => {
      const later = { registration_opens_at: ms(day) };
      const draft = { application: application("draft") };
      expect(stateOf(later, draft, appEvent).kind).toBe("app-upcoming");
    });

    it("opens at exactly the opening time", () => {
      expect(stateOf({ registration_opens_at: ms(0) }).kind).toBe("reg-open");
    });

    it("is open from the start without an opening date", () => {
      expect(stateOf({ registration_opens_at: null }).kind).toBe("reg-open");
    });
  });

  describe("4. an application event", () => {
    it("is open, with the close date, before they start an application", () => {
      expect(stateOf({}, {}, appEvent)).toEqual({
        kind: "app-open",
        closesAt: event.registration_closes_at,
      });
    });

    it("never reads as full", () => {
      expect(stateOf({}, { seatsLeft: 0 }, appEvent).kind).toBe("app-open");
    });

    it("is missed once applications close without one", () => {
      expect(stateOf(closed, {}, appEvent)).toEqual({ kind: "app-missed", closedAt: closed.registration_closes_at });
    });

    it("shows a draft, which expires with the window", () => {
      const draft = { application: application("draft") };
      expect(stateOf({}, draft, appEvent)).toEqual({
        kind: "app-draft",
        closesAt: event.registration_closes_at,
      });
      expect(stateOf(closed, draft, appEvent)).toEqual({
        kind: "app-draft-expired",
        closedAt: closed.registration_closes_at,
      });
    });

    it.each([
      ["submitted", "app-in-review"],
      ["waitlisted", "app-waitlisted"],
      ["rejected", "app-rejected"],
    ] as const)("shows a %s application as %s, open or closed", (status, kind) => {
      const student = { application: application(status) };
      expect(stateOf({}, student, appEvent)).toEqual({ kind });
      expect(stateOf(closed, student, appEvent)).toEqual({ kind });
    });

    it("is accepted until the offer deadline, even after the close", () => {
      const offerExpiresAt = ms(day);
      const student = { application: application("accepted", offerExpiresAt) };
      expect(stateOf({}, student, appEvent)).toEqual({ kind: "app-accepted", offerExpiresAt });
      expect(stateOf(closed, student, appEvent)).toEqual({ kind: "app-accepted", offerExpiresAt });
    });

    it("keeps an offer without a deadline accepted, with no date", () => {
      const student = { application: application("accepted", null) };
      expect(stateOf({}, student, appEvent)).toEqual({ kind: "app-accepted", offerExpiresAt: null });
    });

    it("expires the offer at its deadline, saying whether applications are still open", () => {
      const student = { application: application("accepted", ms(0)) };
      expect(stateOf({}, student, appEvent)).toEqual({
        kind: "app-offer-expired",
        offerExpiredAt: ms(0),
        windowOpen: true,
      });
      expect(stateOf(closed, student, appEvent)).toEqual({
        kind: "app-offer-expired",
        offerExpiredAt: ms(0),
        windowOpen: false,
      });
    });
  });

  describe("5. an event without applications", () => {
    it("is open, with the close date, while seats are left", () => {
      expect(stateOf({})).toEqual({ kind: "reg-open", closesAt: event.registration_closes_at });
      expect(stateOf({}, { seatsLeft: null }).kind).toBe("reg-open");
    });

    it("is full with no seats left", () => {
      expect(stateOf({}, { seatsLeft: 0 })).toEqual({ kind: "reg-full" });
    });

    it("is closed after the close, which beats full", () => {
      const reg = { kind: "reg-closed", closedAt: closed.registration_closes_at };
      expect(stateOf(closed)).toEqual(reg);
      expect(stateOf(closed, { seatsLeft: 0 })).toEqual(reg);
    });

    it("is still open at exactly the close", () => {
      expect(stateOf({ registration_closes_at: ms(0) }).kind).toBe("reg-open");
      expect(stateOf({ registration_closes_at: ms(-1) }).kind).toBe("reg-closed");
    });

    it("ignores an application left over from when the event took them", () => {
      expect(stateOf({}, { application: application("rejected") }).kind).toBe("reg-open");
    });
  });

  describe("without a close date", () => {
    it("closes registration when the event starts", () => {
      const undated = { registration_closes_at: null };
      expect(stateOf(undated)).toEqual({ kind: "reg-open", closesAt: event.starts_at });
      expect(stateOf({ ...undated, ...running })).toEqual({
        kind: "reg-closed",
        closedAt: running.starts_at,
      });
    });

    it("keeps applications open until the event ends, as the apply page does", () => {
      const undated = { registration_closes_at: null, ...running };
      expect(stateOf(undated, {}, appEvent)).toEqual({ kind: "app-open", closesAt: null });
      const draft = { application: application("draft") };
      expect(stateOf(undated, draft, appEvent)).toEqual({ kind: "app-draft", closesAt: null });
    });

    it("stays open with no dates at all", () => {
      const undated = { starts_at: null, ends_at: null, registration_closes_at: null };
      expect(stateOf(undated)).toEqual({ kind: "reg-open", closesAt: null });
    });
  });
});
