import { describe, expect, it } from "vitest";
import { PAYMENT_SMOKE_TIER } from "./fixture.ts";
import {
  getPaymentSmokeStatus,
  seedPaymentSmokeTier,
  unseedPaymentSmokeTier,
  type PaymentSmokePurchaseRow,
  type PaymentSmokeReferences,
  type PaymentSmokeStore,
  type PaymentSmokeTierInput,
  type PaymentSmokeTierRow,
} from "./service.ts";

function smokeTier(
  overrides: Partial<PaymentSmokeTierRow> = {},
): PaymentSmokeTierRow {
  return {
    ...PAYMENT_SMOKE_TIER,
    eligible_user_types: [...PAYMENT_SMOKE_TIER.eligible_user_types],
    id: "smoke-tier",
    ...overrides,
  };
}

class MemoryStore implements PaymentSmokeStore {
  tier: PaymentSmokeTierRow | null;
  purchases: PaymentSmokePurchaseRow[] = [];
  references: PaymentSmokeReferences = {
    memberships: 0,
    preorders: 0,
    purchases: 0,
  };
  webhookPaymentIds = new Set<string>();
  writes: string[] = [];

  constructor(tier: PaymentSmokeTierRow | null = null) {
    this.tier = tier;
  }

  async findTierByName(name: string) {
    return this.tier?.name === name ? this.tier : null;
  }

  async findTierBySlug(slug: string) {
    return this.tier?.slug === slug ? this.tier : null;
  }

  async insertTier(payload: PaymentSmokeTierInput) {
    this.writes.push("insert");
    this.tier = smokeTier(payload);
    return this.tier;
  }

  async updateTier(id: string, payload: Partial<PaymentSmokeTierInput>) {
    if (!this.tier || this.tier.id !== id) throw new Error("Tier not found");
    this.writes.push("update");
    this.tier = { ...this.tier, ...payload };
    return this.tier;
  }

  async deleteTier(id: string) {
    if (!this.tier || this.tier.id !== id) return false;
    this.writes.push("delete");
    this.tier = null;
    return true;
  }

  async referenceCounts() {
    return this.references;
  }

  async listPurchases() {
    return this.purchases;
  }

  async listWebhookPaymentIds() {
    return this.webhookPaymentIds;
  }
}

describe("payment smoke-test tier lifecycle", () => {
  it("creates the fixed tier and is idempotent", async () => {
    const store = new MemoryStore();

    await expect(seedPaymentSmokeTier(store, { dryRun: false })).resolves.toBe(
      "created",
    );
    expect(store.tier).toMatchObject(PAYMENT_SMOKE_TIER);
    await expect(seedPaymentSmokeTier(store, { dryRun: false })).resolves.toBe(
      "unchanged",
    );
    expect(store.writes).toEqual(["insert"]);
  });

  it("reactivates and restores a retired tier", async () => {
    const store = new MemoryStore(
      smokeTier({ active: false, description: "old description", price: 9 }),
    );

    await expect(seedPaymentSmokeTier(store, { dryRun: false })).resolves.toBe(
      "updated",
    );
    expect(store.tier).toMatchObject(PAYMENT_SMOKE_TIER);
    expect(store.writes).toEqual(["update"]);
  });

  it("makes no writes during a seed dry run", async () => {
    const store = new MemoryStore();

    await expect(seedPaymentSmokeTier(store, { dryRun: true })).resolves.toBe(
      "created",
    );
    expect(store.tier).toBeNull();
    expect(store.writes).toEqual([]);
  });

  it("refuses slug and name collisions", async () => {
    await expect(
      seedPaymentSmokeTier(
        new MemoryStore(smokeTier({ name: "A real membership" })),
        { dryRun: false },
      ),
    ).rejects.toThrow(/Refusing to overwrite membership slug/);

    await expect(
      seedPaymentSmokeTier(
        new MemoryStore(smokeTier({ slug: "a-real-membership" })),
        { dryRun: false },
      ),
    ).rejects.toThrow(/Refusing to overwrite membership name/);
  });

  it("treats an absent unseed as an idempotent no-op", async () => {
    const store = new MemoryStore();
    await expect(unseedPaymentSmokeTier(store, { dryRun: false })).resolves.toBe(
      "absent",
    );
    expect(store.writes).toEqual([]);
  });

  it("deactivates and deletes an unreferenced tier", async () => {
    const store = new MemoryStore(smokeTier());
    await expect(unseedPaymentSmokeTier(store, { dryRun: false })).resolves.toBe(
      "deleted",
    );
    expect(store.tier).toBeNull();
    expect(store.writes).toEqual(["update", "delete"]);
  });

  it.each([
    ["purchase", { purchases: 1, memberships: 0, preorders: 0 }],
    ["membership", { purchases: 0, memberships: 1, preorders: 0 }],
    ["pre-order", { purchases: 0, memberships: 0, preorders: 1 }],
  ])("retires a tier referenced by a %s", async (_label, references) => {
    const store = new MemoryStore(smokeTier());
    store.references = references;

    await expect(unseedPaymentSmokeTier(store, { dryRun: false })).resolves.toBe(
      "retired",
    );
    expect(store.tier?.active).toBe(false);
    expect(store.writes).toEqual(["update"]);
  });

  it("makes no writes during an unseed dry run", async () => {
    const store = new MemoryStore(smokeTier());
    await expect(unseedPaymentSmokeTier(store, { dryRun: true })).resolves.toBe(
      "deleted",
    );
    expect(store.tier?.active).toBe(true);
    expect(store.writes).toEqual([]);
  });

  it("reports purchase, fulfillment, email, and webhook state", async () => {
    const store = new MemoryStore(smokeTier());
    store.references = { memberships: 1, preorders: 0, purchases: 1 };
    store.purchases = [
      {
        confirmation_email_attempted_at: "2026-09-06T12:01:00Z",
        confirmation_email_sent_at: "2026-09-06T12:01:02Z",
        created_at: "2026-09-06T12:00:00Z",
        fulfilled_at: "2026-09-06T12:00:03Z",
        id: "purchase-1",
        square_payment_id: "square-1",
        status: "completed",
      },
    ];
    store.webhookPaymentIds.add("square-1");

    await expect(getPaymentSmokeStatus(store)).resolves.toMatchObject({
      purchases: [{ id: "purchase-1", webhook_recorded: true }],
      references: store.references,
      state: "active",
    });
  });
});
