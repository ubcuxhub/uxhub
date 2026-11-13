/**
 * Checking in at the door against the local database: a ticket's QR code
 * checks its holder in once per session, the first time is kept even when
 * scans race, and only a real ticket for this event gets in.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CheckInResult } from "@/features/admin/types";
import { createIntegrationClient, withFixtures, type Fixtures } from "@/test/integration";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const guards = vi.hoisted(() => ({ requireAdmin: vi.fn(), requireManager: vi.fn() }));
vi.mock("@/lib/auth/guards", () => guards);

import {
  checkInScannedTicketAction,
  checkInTicketAction,
  toggleCheckInAction,
} from "@/features/admin/actions";
import { checkInTicket } from "@/lib/supabase-helpers/check-ins";

const db = createIntegrationClient();

beforeEach(() => {
  guards.requireAdmin.mockResolvedValue({ id: "admin" });
});

/** An event with one check-in session and one ticket holder. */
async function ticketHolder(fixtures: Fixtures, slug = `check-in-${fixtures.tag}`) {
  const event = await fixtures.createEvent({ slug });
  const user = await fixtures.createUser({ first_name: "Ada", last_name: "Lovelace" });

  const session = await db
    .from("check_in_sessions")
    .insert({ event_id: event.id, name: "Doors" })
    .select("id")
    .single();
  if (session.error) throw session.error;

  const ticket = await db
    .from("event_tickets")
    .insert({ event_id: event.id, user_id: user.id })
    .select("id, qr_token")
    .single();
  if (ticket.error) throw ticket.error;

  return {
    sessionId: session.data.id,
    ticketId: ticket.data.id,
    qrToken: ticket.data.qr_token,
  };
}

async function checkInRows(ticketId: string) {
  const { data, error } = await db
    .from("check_ins")
    .select("checked_in_at")
    .eq("ticket_id", ticketId);
  if (error) throw error;
  return data;
}

function checkedInAt(result: CheckInResult): number {
  if (result.status === "rejected") throw new Error(`Rejected: ${result.reason}`);
  return new Date(result.checkedInAt).getTime();
}

describe("checking in at the door", () => {
  it("checks someone in once and reports the first time on a second scan", () =>
    withFixtures(async (fixtures) => {
      const { sessionId, ticketId, qrToken } = await ticketHolder(fixtures);

      const first = await checkInScannedTicketAction(sessionId, qrToken);
      const second = await checkInScannedTicketAction(sessionId, qrToken);

      expect(first).toMatchObject({ status: "checked_in", name: "Ada Lovelace" });
      expect(second).toMatchObject({ status: "already_checked_in", name: "Ada Lovelace" });
      expect(checkedInAt(second)).toBe(checkedInAt(first));
      expect(await checkInRows(ticketId)).toHaveLength(1);
    }));

  it("lets only one of several simultaneous scans check someone in", () =>
    withFixtures(async (fixtures) => {
      const { sessionId, ticketId } = await ticketHolder(fixtures);

      const results = await Promise.all(
        Array.from({ length: 5 }, () => checkInTicket(db, ticketId, sessionId)),
      );

      expect(results.filter((result) => !result.alreadyCheckedIn)).toHaveLength(1);
      expect(new Set(results.map((result) => new Date(result.checkedInAt).getTime())).size).toBe(1);
      expect(await checkInRows(ticketId)).toHaveLength(1);
    }));

  it("gives a manual check-in and a scan the same answer", () =>
    withFixtures(async (fixtures) => {
      const { sessionId, ticketId, qrToken } = await ticketHolder(fixtures);

      const picked = await checkInTicketAction(sessionId, ticketId);
      const scanned = await checkInScannedTicketAction(sessionId, qrToken);

      expect(picked).toMatchObject({ status: "checked_in", name: "Ada Lovelace" });
      expect(scanned).toMatchObject({ status: "already_checked_in" });
      expect(checkedInAt(scanned)).toBe(checkedInAt(picked));
    }));

  it("checks someone in again after an admin un-checks them", () =>
    withFixtures(async (fixtures) => {
      const { sessionId, ticketId, qrToken } = await ticketHolder(fixtures);

      await checkInScannedTicketAction(sessionId, qrToken);
      await toggleCheckInAction(ticketId, sessionId, false);

      expect(await checkInRows(ticketId)).toEqual([]);
      expect(await checkInScannedTicketAction(sessionId, qrToken)).toMatchObject({
        status: "checked_in",
      });
      expect(await checkInRows(ticketId)).toHaveLength(1);
    }));

  it("checks in a ticket whose row an older un-check left with no time", () =>
    withFixtures(async (fixtures) => {
      const { sessionId, ticketId, qrToken } = await ticketHolder(fixtures);
      const { error } = await db
        .from("check_ins")
        .insert({ ticket_id: ticketId, check_in_session_id: sessionId, checked_in_at: null });
      if (error) throw error;

      expect(await checkInScannedTicketAction(sessionId, qrToken)).toMatchObject({
        status: "checked_in",
      });
      const rows = await checkInRows(ticketId);
      expect(rows).toHaveLength(1);
      expect(rows[0].checked_in_at).not.toBeNull();
    }));

  it("rejects an edited code and another event's ticket", () =>
    withFixtures(async (fixtures) => {
      const { sessionId, ticketId, qrToken } = await ticketHolder(fixtures);
      const other = await ticketHolder(fixtures, `check-in-other-${fixtures.tag}`);
      const edited = qrToken.slice(0, -1) + (qrToken.endsWith("a") ? "b" : "a");

      expect(await checkInScannedTicketAction(sessionId, edited)).toEqual({
        status: "rejected",
        reason: "invalid_code",
      });
      expect(await checkInScannedTicketAction(other.sessionId, qrToken)).toEqual({
        status: "rejected",
        reason: "wrong_event",
      });
      expect(await checkInTicketAction(other.sessionId, ticketId)).toEqual({
        status: "rejected",
        reason: "wrong_event",
      });

      expect(await checkInRows(ticketId)).toEqual([]);
    }));
});
