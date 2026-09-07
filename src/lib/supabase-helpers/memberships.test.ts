import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "./types";
import {
  fetchMembershipTypeById,
  fetchMembershipTypeOptions,
  fetchMembershipTypes,
} from "./memberships";

function fakeClient(data: unknown) {
  const builder = {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockResolvedValue({ data, error: null });
  builder.maybeSingle.mockResolvedValue({ data, error: null });

  const client = {
    from: vi.fn(() => builder),
  } as unknown as DbClient;

  return { builder, client };
}

describe("membership helpers", () => {
  it("lists only active tiers by default", async () => {
    const { builder, client } = fakeClient([]);
    await fetchMembershipTypes(client);

    expect(builder.eq).toHaveBeenCalledWith("active", true);
    expect(builder.order).toHaveBeenCalledWith("price", { ascending: true });
  });

  it("can include inactive tiers explicitly", async () => {
    const { builder, client } = fakeClient([]);
    await fetchMembershipTypes(client, { includeInactive: true });

    expect(builder.eq).not.toHaveBeenCalled();
  });

  it("excludes inactive tiers from admin assignment options", async () => {
    const { builder, client } = fakeClient([]);
    await fetchMembershipTypeOptions(client);

    expect(builder.eq).toHaveBeenCalledWith("active", true);
  });

  it("still resolves inactive tiers by ID for historical purchases", async () => {
    const inactiveTier = { active: false, id: "retired-tier" };
    const { builder, client } = fakeClient(inactiveTier);

    await expect(fetchMembershipTypeById(client, inactiveTier.id)).resolves.toBe(
      inactiveTier,
    );
    expect(builder.eq).toHaveBeenCalledTimes(1);
    expect(builder.eq).toHaveBeenCalledWith("id", inactiveTier.id);
  });
});
