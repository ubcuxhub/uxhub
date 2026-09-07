import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types.ts";
import type {
  PaymentSmokePurchaseRow,
  PaymentSmokeReferences,
  PaymentSmokeStore,
  PaymentSmokeTierInput,
  PaymentSmokeTierRow,
} from "./service.ts";

const TIER_COLUMNS =
  "id, active, description, eligible_user_types, name, price, slug";

export class SupabasePaymentSmokeStore implements PaymentSmokeStore {
  private readonly supabase: SupabaseClient<Database>;

  constructor(supabase: SupabaseClient<Database>) {
    this.supabase = supabase;
  }

  async findTierBySlug(slug: string) {
    const { data, error } = await this.supabase
      .from("membership_types")
      .select(TIER_COLUMNS)
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return data as PaymentSmokeTierRow | null;
  }

  async findTierByName(name: string) {
    const { data, error } = await this.supabase
      .from("membership_types")
      .select(TIER_COLUMNS)
      .eq("name", name)
      .maybeSingle();
    if (error) throw error;
    return data as PaymentSmokeTierRow | null;
  }

  async insertTier(payload: PaymentSmokeTierInput) {
    const { data, error } = await this.supabase
      .from("membership_types")
      .insert(payload)
      .select(TIER_COLUMNS)
      .single();
    if (error) throw error;
    return data as PaymentSmokeTierRow;
  }

  async updateTier(id: string, payload: Partial<PaymentSmokeTierInput>) {
    const { data, error } = await this.supabase
      .from("membership_types")
      .update(payload)
      .eq("id", id)
      .select(TIER_COLUMNS)
      .single();
    if (error) throw error;
    return data as PaymentSmokeTierRow;
  }

  async deleteTier(id: string) {
    const { error } = await this.supabase
      .from("membership_types")
      .delete()
      .eq("id", id);
    if (!error) return true;
    if (error.code === "23503") return false;
    throw error;
  }

  async referenceCounts(tierId: string): Promise<PaymentSmokeReferences> {
    const [purchases, memberships, preorders] = await Promise.all([
      this.supabase
        .from("purchases")
        .select("id", { count: "exact", head: true })
        .eq("membership_type_id", tierId),
      this.supabase
        .from("user_info")
        .select("id", { count: "exact", head: true })
        .eq("membership_type_id", tierId),
      this.supabase
        .from("user_info")
        .select("id", { count: "exact", head: true })
        .eq("membership_pre_ordered_type_id", tierId),
    ]);

    for (const result of [purchases, memberships, preorders]) {
      if (result.error) throw result.error;
    }

    return {
      memberships: memberships.count ?? 0,
      preorders: preorders.count ?? 0,
      purchases: purchases.count ?? 0,
    };
  }

  async listPurchases(tierId: string) {
    const { data, error } = await this.supabase
      .from("purchases")
      .select(
        "id, status, square_payment_id, fulfilled_at, confirmation_email_attempted_at, confirmation_email_sent_at, created_at",
      )
      .eq("membership_type_id", tierId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PaymentSmokePurchaseRow[];
  }

  async listWebhookPaymentIds(paymentIds: string[]) {
    const found = new Set<string>();

    await Promise.all(
      paymentIds.map(async (paymentId) => {
        const { data, error } = await this.supabase
          .from("square_webhook_events")
          .select("event_id")
          .eq("payload->data->object->payment->>id", paymentId)
          .limit(1);
        if (error) throw error;
        if ((data ?? []).length > 0) found.add(paymentId);
      }),
    );

    return found;
  }
}
