import { describe, expect, it } from "vitest";

import type { EventApplicationStatus } from "@/lib/supabase/models";

import { eventBadgeFor, type StudentEventState } from "./event-badge";

const now = new Date("2026-10-15T19:00:00Z");

// Registration opened yesterday and closes in a week; the event is in two weeks.
const event = {
  starts_at: "2026-10-29T01:00:00Z",
  ends_at: "2026-10-29T04:00:00Z",
  registration_opens_at: "2026-10-14T19:00:00Z",
  registration_closes_at: "2026-10-22T19:00:00Z",
};
const ended = {
  ...event,
  starts_at: "2026-10-01T01:00:00Z",
  ends_at: "2026-10-01T04:00:00Z",
};

const nothing: StudentEventState = { ticket: null, application: null, seatsLeft: 5 };
const ticket = { check_ins: [] };
const scanned = { check_ins: [{ checked_in_at: "2026-10-01T02:00:00Z" }] };
const application = (
  status: EventApplicationStatus,
  offer_expires_at: string | null = null
) => ({ status, offer_expires_at });

describe("eventBadgeFor", () => {
  describe("the student's own badge", () => {
    it.each([
      ["submitted", "under_review"],
      ["waitlisted", "waitlisted"],
      ["rejected", "not_selected"],
    ] as const)("shows a %s application as %s", (status, badge) => {
      const state = { ...nothing, application: application(status) };
      expect(eventBadgeFor(event, state, now)).toEqual({ status: badge });
    });

    it("shows the event's availability for an unsubmitted draft", () => {
      const state = { ...nothing, application: application("draft") };
      expect(eventBadgeFor(event, state, now)).toEqual(eventBadgeFor(event, nothing, now));
    });

    it("asks an accepted student to register by the offer deadline", () => {
      const state = {
        ...nothing,
        application: application("accepted", "2026-10-21T06:59:00Z"),
      };
      expect(eventBadgeFor(event, state, now)).toEqual({
        status: "register_by",
        date: "Oct 20",
      });
    });

    it("shows an accepted offer whose deadline passed as expired", () => {
      const state = {
        ...nothing,
        application: application("accepted", "2026-10-14T19:00:00Z"),
      };
      expect(eventBadgeFor(event, state, now)).toEqual({ status: "offer_expired" });
    });

    it("shows a ticket as Going", () => {
      expect(eventBadgeFor(event, { ...nothing, ticket }, now)).toEqual({
        status: "going",
      });
    });

    it("shows a scanned ticket as Checked in while the event runs", () => {
      expect(eventBadgeFor(event, { ...nothing, ticket: scanned }, now)).toEqual({
        status: "checked_in",
      });
    });
  });

  describe("the event's availability", () => {
    it("shows when registration opens", () => {
      const notYet = { ...event, registration_opens_at: "2026-10-20T19:00:00Z" };
      expect(eventBadgeFor(notYet, nothing, now)).toEqual({
        status: "opens",
        date: "Oct 20",
      });
    });

    it("shows open registration while seats are left", () => {
      expect(eventBadgeFor(event, nothing, now)).toEqual({
        status: "registration_open",
      });
    });

    it("treats missing registration dates as always open", () => {
      const undated = {
        ...event,
        registration_opens_at: null,
        registration_closes_at: null,
      };
      expect(eventBadgeFor(undated, nothing, now)).toEqual({
        status: "registration_open",
      });
    });

    it("shows Full when no seats are left", () => {
      expect(eventBadgeFor(event, { ...nothing, seatsLeft: 0 }, now)).toEqual({
        status: "full",
      });
    });

    it("never shows Full when the seat count is unknown", () => {
      expect(eventBadgeFor(event, { ...nothing, seatsLeft: null }, now)).toEqual({
        status: "registration_open",
      });
    });

    it("shows closed registration after it closes, even when full", () => {
      const closed = { ...event, registration_closes_at: "2026-10-15T18:00:00Z" };
      expect(eventBadgeFor(closed, { ...nothing, seatsLeft: 0 }, now)).toEqual({
        status: "registration_closed",
      });
    });

    it("shows Past once the event has ended", () => {
      expect(eventBadgeFor(ended, nothing, now)).toEqual({ status: "past" });
    });
  });

  describe("when more than one applies", () => {
    it("shows Past for an ended event, whatever they did before", () => {
      const state = { ...nothing, ticket, application: application("waitlisted") };
      expect(eventBadgeFor(ended, state, now)).toEqual({ status: "past" });
    });

    it("keeps Checked in after the event ends", () => {
      expect(eventBadgeFor(ended, { ...nothing, ticket: scanned }, now)).toEqual({
        status: "checked_in",
      });
    });

    it("shows Going over Full", () => {
      expect(
        eventBadgeFor(event, { ...nothing, ticket, seatsLeft: 0 }, now)
      ).toEqual({ status: "going" });
    });

    it("shows Going over an accepted application once they register", () => {
      const state = {
        ...nothing,
        ticket,
        application: application("accepted", "2026-10-21T06:59:00Z"),
      };
      expect(eventBadgeFor(event, state, now)).toEqual({ status: "going" });
    });

    it("shows the application over closed registration", () => {
      const closed = { ...event, registration_closes_at: "2026-10-15T18:00:00Z" };
      const state = { ...nothing, application: application("submitted") };
      expect(eventBadgeFor(closed, state, now)).toEqual({ status: "under_review" });
    });

    it("counts an event without an end as ended once it starts", () => {
      const started = { ...event, starts_at: "2026-10-15T18:00:00Z", ends_at: null };
      expect(eventBadgeFor(started, nothing, now)).toEqual({ status: "past" });
    });
  });
});
