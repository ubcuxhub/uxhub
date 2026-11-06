/**
 * save_admin_event_atomically and the check-ins recorded against an event's
 * sessions: saves keep session ids, and so the check-ins to them, and refuse
 * to remove a session anyone has checked in to. Each test makes its own event,
 * tickets and check-ins, since CI's database is unseeded.
 */
import { describe, expect, it } from "vitest";

import { withFixtures, type Fixtures } from "@/test/integration";

interface SessionInput {
  id?: string | null;
  name: string;
  start_time: string;
  end_time: string;
}

interface SaveResult {
  id: string;
  check_in_session_ids: string[];
}

function eventPayload(fixtures: Fixtures, name = `Check-in ${fixtures.tag}`) {
  return {
    name,
    description: "Check-in session integration test.",
    status: "draft" as const,
    event_type: "regular" as const,
    mentors_enabled: false,
    sponsors_enabled: false,
    requires_application: false,
    regular_price: 0,
    member_price: 0,
    max_capacity: 10,
    created_at: new Date().toISOString(),
  };
}

let slugCount = 0;

async function attemptSave(
  fixtures: Fixtures,
  sessions: SessionInput[],
  eventId?: string,
  name?: string
) {
  return fixtures.supabase.rpc("save_admin_event_atomically", {
    p_event_id: eventId ?? null!,
    p_event: eventPayload(fixtures, name),
    p_slug: eventId ? null! : `check-in-${fixtures.tag}-${++slugCount}`,
    p_expected_image_url: null!,
    p_check_in_sessions: sessions as never,
    p_application_questions: [],
    p_mentors: [],
    p_sponsors: [],
  });
}

async function save(
  fixtures: Fixtures,
  sessions: SessionInput[],
  eventId?: string,
  name?: string
): Promise<SaveResult> {
  const { data, error } = await attemptSave(fixtures, sessions, eventId, name);
  if (error) throw error;
  const result = data as unknown as SaveResult;
  if (!eventId) fixtures.track("events", result.id);
  return result;
}

async function sessionsOf(fixtures: Fixtures, eventId: string) {
  const { data, error } = await fixtures.supabase
    .from("check_in_sessions")
    .select("id, name, start_time, end_time")
    .eq("event_id", eventId)
    .order("start_time");
  if (error) throw error;
  return data.map((session) => ({
    ...session,
    start_time: new Date(session.start_time!).toISOString(),
    end_time: new Date(session.end_time!).toISOString(),
  }));
}

/** A ticket holder checked in to `sessionId`; returns the check-in's id. */
async function checkIn(fixtures: Fixtures, eventId: string, sessionId: string) {
  const user = await fixtures.createUser();
  const { data: ticket, error } = await fixtures.supabase
    .from("event_tickets")
    .insert({ event_id: eventId, user_id: user.id })
    .select("id")
    .single();
  if (error) throw error;

  const { data, error: checkInError } = await fixtures.supabase
    .from("check_ins")
    .insert({ ticket_id: ticket.id, check_in_session_id: sessionId })
    .select("id")
    .single();
  if (checkInError) throw checkInError;
  return data.id;
}

async function checkInsOf(fixtures: Fixtures, eventId: string) {
  const { data, error } = await fixtures.supabase
    .from("check_ins")
    .select("id, check_in_session_id, event_tickets!inner(event_id)")
    .eq("event_tickets.event_id", eventId);
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.id, row.check_in_session_id]));
}

const at = (hour: number) => `2099-08-01T${String(hour).padStart(2, "0")}:00:00.000Z`;
const doors: SessionInput = { name: "Doors", start_time: at(17), end_time: at(18) };
const talks: SessionInput = { name: "Talks", start_time: at(18), end_time: at(20) };
const dinner: SessionInput = { name: "Dinner", start_time: at(20), end_time: at(21) };

describe("save_admin_event_atomically: check-in sessions", () => {
  it("keeps session ids and every check-in when the sessions are unchanged", () =>
    withFixtures(async (fixtures) => {
      const created = await save(fixtures, [doors, talks]);
      const [doorsId, talksId] = created.check_in_session_ids;
      const first = await checkIn(fixtures, created.id, doorsId);
      const second = await checkIn(fixtures, created.id, talksId);

      const saved = await save(
        fixtures,
        [
          { ...doors, id: doorsId },
          { ...talks, id: talksId },
        ],
        created.id,
        `Renamed ${fixtures.tag}`
      );

      expect(saved.check_in_session_ids).toEqual([doorsId, talksId]);
      expect((await sessionsOf(fixtures, created.id)).map((row) => row.id)).toEqual([
        doorsId,
        talksId,
      ]);
      expect(await checkInsOf(fixtures, created.id)).toEqual({
        [first]: doorsId,
        [second]: talksId,
      });
    }));

  it("edits, adds and removes sessions by id, and a second save adds nothing", () =>
    withFixtures(async (fixtures) => {
      const created = await save(fixtures, [doors, talks, dinner]);
      const [doorsId, talksId, dinnerId] = created.check_in_session_ids;
      const checkedIn = await checkIn(fixtures, created.id, talksId);

      // The checked-in session is renamed and moved; the one without
      // check-ins is removed.
      const edited: SessionInput[] = [
        { ...doors, id: doorsId },
        { id: talksId, name: "Keynote", start_time: at(19), end_time: at(21) },
        { id: null, name: "Drinks", start_time: at(21), end_time: at(23) },
      ];
      const saved = await save(fixtures, edited, created.id);

      expect(saved.check_in_session_ids.slice(0, 2)).toEqual([doorsId, talksId]);
      const drinksId = saved.check_in_session_ids[2];
      expect(drinksId).not.toBe(dinnerId);
      expect(await sessionsOf(fixtures, created.id)).toEqual([
        { id: doorsId, ...doors },
        { id: talksId, name: "Keynote", start_time: at(19), end_time: at(21) },
        { id: drinksId, name: "Drinks", start_time: at(21), end_time: at(23) },
      ]);
      expect(await checkInsOf(fixtures, created.id)).toEqual({ [checkedIn]: talksId });

      // The builder sends back the ids it was given.
      const again = await save(
        fixtures,
        edited.map((session, index) => ({
          ...session,
          id: saved.check_in_session_ids[index],
        })),
        created.id
      );
      expect(again.check_in_session_ids).toEqual(saved.check_in_session_ids);
      expect(await sessionsOf(fixtures, created.id)).toHaveLength(3);
    }));

  it("refuses to remove a session with check-ins, and saves nothing", () =>
    withFixtures(async (fixtures) => {
      const created = await save(fixtures, [doors, talks]);
      const [doorsId, talksId] = created.check_in_session_ids;
      const checkedIn = await checkIn(fixtures, created.id, talksId);

      const { error } = await attemptSave(
        fixtures,
        [{ ...doors, id: doorsId, name: "Entrance" }],
        created.id,
        `Renamed ${fixtures.tag}`
      );

      expect(error?.hint).toBe("CHECK_IN_SESSIONS_CONFLICT");
      expect(error?.message).toBe(
        'Attendees have already checked in to "Talks", so it cannot be removed.'
      );
      expect(await sessionsOf(fixtures, created.id)).toEqual([
        { id: doorsId, ...doors },
        { id: talksId, ...talks },
      ]);
      const { data: event } = await fixtures.supabase
        .from("events")
        .select("name")
        .eq("id", created.id)
        .single();
      expect(event?.name).toBe(`Check-in ${fixtures.tag}`);
      expect(await checkInsOf(fixtures, created.id)).toEqual({ [checkedIn]: talksId });
    }));

  it("refuses a session id that is not this event's", () =>
    withFixtures(async (fixtures) => {
      const other = await save(fixtures, [doors]);
      const created = await save(fixtures, [talks], undefined, `Second ${fixtures.tag}`);

      const { error } = await attemptSave(
        fixtures,
        [{ ...doors, id: other.check_in_session_ids[0] }],
        created.id
      );

      expect(error?.hint).toBe("CHECK_IN_SESSIONS_CONFLICT");
      expect(error?.message).toMatch(/Reload the page/);
      expect((await sessionsOf(fixtures, other.id)).map((row) => row.id)).toEqual(
        other.check_in_session_ids
      );
    }));

  describe("the production builder's payload, which has no ids", () => {
    it("keeps unchanged sessions and their check-ins", () =>
      withFixtures(async (fixtures) => {
        const created = await save(fixtures, [doors, talks, dinner]);
        const [doorsId, talksId, dinnerId] = created.check_in_session_ids;
        const first = await checkIn(fixtures, created.id, doorsId);
        const second = await checkIn(fixtures, created.id, dinnerId);

        // Unchanged, then with the session without check-ins edited and
        // another appended.
        const unchanged = await save(fixtures, [doors, talks, dinner], created.id);
        expect(unchanged.check_in_session_ids).toEqual([doorsId, talksId, dinnerId]);

        const edited = await save(
          fixtures,
          [doors, { ...talks, name: "Keynote" }, dinner, { ...dinner, name: "Drinks" }],
          created.id
        );
        expect(edited.check_in_session_ids[0]).toBe(doorsId);
        expect(edited.check_in_session_ids[1]).not.toBe(talksId);
        expect(edited.check_in_session_ids[2]).toBe(dinnerId);
        expect(await sessionsOf(fixtures, created.id)).toHaveLength(4);
        expect(await checkInsOf(fixtures, created.id)).toEqual({
          [first]: doorsId,
          [second]: dinnerId,
        });
      }));

    it("refuses to drop a session with check-ins", () =>
      withFixtures(async (fixtures) => {
        const created = await save(fixtures, [doors, talks]);
        const [doorsId] = created.check_in_session_ids;
        const checkedIn = await checkIn(fixtures, created.id, doorsId);

        // Removing the first session moves the second into its place.
        const { error } = await attemptSave(fixtures, [talks], created.id);

        expect(error?.hint).toBe("CHECK_IN_SESSIONS_CONFLICT");
        expect(error?.message).toMatch(/"Doors"/);
        expect((await sessionsOf(fixtures, created.id)).map((row) => row.id)).toEqual(
          created.check_in_session_ids
        );
        expect(await checkInsOf(fixtures, created.id)).toEqual({ [checkedIn]: doorsId });
      }));
  });
});
