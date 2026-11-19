import { expect, it } from "vitest";
import { fetchCheckInPages } from "./check-in-pages";

it("keeps every attendee beyond the API response limit, including the final partial page", async () => {
  const population = Array.from({ length: 1021 }, (_, id) => ({ id }));
  const rows = await fetchCheckInPages(async (from, to) => ({ data: population.slice(from, to + 1), error: null }));
  expect(rows).toEqual(population);
});
it("fails the whole snapshot if a later page fails rather than returning a partial count", async () => {
  await expect(fetchCheckInPages(async from => ({ data: from === 0 ? Array(500).fill(0) : null, error: from === 0 ? null : new Error("offline") }))).rejects.toThrow("offline");
});
