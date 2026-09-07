import { PAYMENT_SMOKE_TIER } from "./fixture.ts";

export interface PaymentSmokeTierRow {
  active: boolean;
  description: string;
  eligible_user_types: ("faculty" | "nonUbc" | "ubcStudent")[];
  id: string;
  name: string;
  price: number;
  slug: string;
}

export type PaymentSmokeTierInput = Omit<PaymentSmokeTierRow, "id">;

export interface PaymentSmokePurchaseRow {
  confirmation_email_attempted_at: string | null;
  confirmation_email_sent_at: string | null;
  created_at: string | null;
  fulfilled_at: string | null;
  id: string;
  square_payment_id: string | null;
  status: string;
}

export interface PaymentSmokeReferences {
  memberships: number;
  preorders: number;
  purchases: number;
}

export interface PaymentSmokeStore {
  deleteTier(id: string): Promise<boolean>;
  findTierByName(name: string): Promise<PaymentSmokeTierRow | null>;
  findTierBySlug(slug: string): Promise<PaymentSmokeTierRow | null>;
  insertTier(payload: PaymentSmokeTierInput): Promise<PaymentSmokeTierRow>;
  listPurchases(tierId: string): Promise<PaymentSmokePurchaseRow[]>;
  listWebhookPaymentIds(paymentIds: string[]): Promise<Set<string>>;
  referenceCounts(tierId: string): Promise<PaymentSmokeReferences>;
  updateTier(
    id: string,
    payload: Partial<PaymentSmokeTierInput>,
  ): Promise<PaymentSmokeTierRow>;
}

export interface PaymentSmokePurchaseStatus extends PaymentSmokePurchaseRow {
  webhook_recorded: boolean;
}

export interface PaymentSmokeStatus {
  purchases: PaymentSmokePurchaseStatus[];
  references: PaymentSmokeReferences;
  state: "absent" | "active" | "retired";
  tier: PaymentSmokeTierRow | null;
}

function arraysEqual(left: readonly string[] | null, right: readonly string[] | null) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isCanonicalTier(tier: PaymentSmokeTierRow) {
  return (
    tier.active === PAYMENT_SMOKE_TIER.active &&
    tier.description === PAYMENT_SMOKE_TIER.description &&
    arraysEqual(tier.eligible_user_types, PAYMENT_SMOKE_TIER.eligible_user_types) &&
    tier.name === PAYMENT_SMOKE_TIER.name &&
    Number(tier.price) === PAYMENT_SMOKE_TIER.price &&
    tier.slug === PAYMENT_SMOKE_TIER.slug
  );
}

async function findOwnedTier(store: PaymentSmokeStore) {
  const [bySlug, byName] = await Promise.all([
    store.findTierBySlug(PAYMENT_SMOKE_TIER.slug),
    store.findTierByName(PAYMENT_SMOKE_TIER.name),
  ]);

  if (bySlug && bySlug.name !== PAYMENT_SMOKE_TIER.name) {
    throw new Error(
      `Refusing to overwrite membership slug "${PAYMENT_SMOKE_TIER.slug}" because it belongs to "${bySlug.name}".`,
    );
  }
  if (byName && byName.slug !== PAYMENT_SMOKE_TIER.slug) {
    throw new Error(
      `Refusing to overwrite membership name "${PAYMENT_SMOKE_TIER.name}" because it uses slug "${byName.slug}".`,
    );
  }
  if (bySlug && byName && bySlug.id !== byName.id) {
    throw new Error("The payment smoke-test name and slug resolve to different rows.");
  }

  return bySlug ?? byName;
}

export async function seedPaymentSmokeTier(
  store: PaymentSmokeStore,
  options: { dryRun: boolean },
): Promise<"created" | "updated" | "unchanged"> {
  const existing = await findOwnedTier(store);

  if (!existing) {
    if (!options.dryRun) await store.insertTier(PAYMENT_SMOKE_TIER);
    return "created";
  }

  if (isCanonicalTier(existing)) return "unchanged";
  if (!options.dryRun) await store.updateTier(existing.id, PAYMENT_SMOKE_TIER);
  return "updated";
}

export async function getPaymentSmokeStatus(
  store: PaymentSmokeStore,
): Promise<PaymentSmokeStatus> {
  const tier = await findOwnedTier(store);
  if (!tier) {
    return {
      purchases: [],
      references: { memberships: 0, preorders: 0, purchases: 0 },
      state: "absent",
      tier: null,
    };
  }

  const [purchases, references] = await Promise.all([
    store.listPurchases(tier.id),
    store.referenceCounts(tier.id),
  ]);
  const paymentIds = purchases.flatMap((purchase) =>
    purchase.square_payment_id ? [purchase.square_payment_id] : [],
  );
  const webhookPaymentIds = await store.listWebhookPaymentIds(paymentIds);

  return {
    purchases: purchases.map((purchase) => ({
      ...purchase,
      webhook_recorded: Boolean(
        purchase.square_payment_id && webhookPaymentIds.has(purchase.square_payment_id),
      ),
    })),
    references,
    state: tier.active ? "active" : "retired",
    tier,
  };
}

export async function unseedPaymentSmokeTier(
  store: PaymentSmokeStore,
  options: { dryRun: boolean },
): Promise<"absent" | "deleted" | "retired"> {
  const tier = await findOwnedTier(store);
  if (!tier) return "absent";

  if (options.dryRun) {
    const references = await store.referenceCounts(tier.id);
    return references.memberships + references.preorders + references.purchases === 0
      ? "deleted"
      : "retired";
  }

  if (tier.active) {
    await store.updateTier(tier.id, { active: false });
  }

  const references = await store.referenceCounts(tier.id);
  if (references.memberships + references.preorders + references.purchases > 0) {
    return "retired";
  }

  return (await store.deleteTier(tier.id)) ? "deleted" : "retired";
}
