import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "./types";
import { fetchPurchasesForUser } from "./purchases";

function fakeClient() {
  const result = Promise.resolve({ data: [], error: null });
  const query = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(),
    then: result.then.bind(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  const client = { from: vi.fn(() => query) } as unknown as DbClient;
  return { client, query };
}

describe("fetchPurchasesForUser", () => {
  it("keeps existing callers unlimited and sorted newest first", async () => {
    const { client, query } = fakeClient();
    await fetchPurchasesForUser(client, "user-1");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(query.limit).not.toHaveBeenCalled();
  });

  it("limits recent history at the database query", async () => {
    const { client, query } = fakeClient();
    await fetchPurchasesForUser(client, "user-1", 5);
    expect(query.limit).toHaveBeenCalledWith(5);
  });
});
