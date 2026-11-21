import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "./types";
import { fetchEventSeatCounts } from "./event-tickets";

/** A client whose `event_seat_counts` and `events` reads return these rows. */
function fakeClient(
  counts: { event_id: string; tickets: number; held_offers: number; seats_left: number }[],
  events: { id: string; max_capacity: number | null }[],
) {
  const eventsResult = Promise.resolve({ data: events, error: null });
  const query = { select: vi.fn(), in: vi.fn(), then: eventsResult.then.bind(eventsResult) };
  query.select.mockReturnValue(query);
  query.in.mockReturnValue(query);
  const client = {
    rpc: vi.fn(async () => ({ data: counts, error: null })),
    from: vi.fn(() => query),
  } as unknown as DbClient;
  return { client, query };
}

describe("fetchEventSeatCounts", () => {
  it("reads no seat count for an event without a capacity, so it never reads as full", async () => {
    // `event_seat_counts` says 0 seats left for both: `greatest` skips the null capacity.
    const { client, query } = fakeClient(
      [
        { event_id: "uncapped", tickets: 3, held_offers: 0, seats_left: 0 },
        { event_id: "full", tickets: 20, held_offers: 1, seats_left: 0 },
      ],
      [
        { id: "uncapped", max_capacity: null },
        { id: "full", max_capacity: 21 },
      ],
    );
    const seats = await fetchEventSeatCounts(client, ["uncapped", "full"]);
    expect(query.in).toHaveBeenCalledWith("id", ["uncapped", "full"]);
    expect(seats.get("uncapped")).toEqual({ tickets: 3, heldOffers: 0, seatsLeft: null });
    expect(seats.get("full")).toEqual({ tickets: 20, heldOffers: 1, seatsLeft: 0 });
  });

  it("reads nothing for no events", async () => {
    const { client } = fakeClient([], []);
    expect((await fetchEventSeatCounts(client, [])).size).toBe(0);
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
