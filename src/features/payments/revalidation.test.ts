import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const calls = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => calls);
vi.mock("@/lib/supabase-helpers/purchases", () => ({ fetchPurchaseById: async () => ({ kind: "event_ticket", event_id: "event-1" }) }));
vi.mock("@/lib/supabase-helpers/events", () => ({ fetchEventById: async () => ({ slug: "sprint" }) }));
vi.mock("@/lib/supabase-helpers/memberships", () => ({ fetchMembershipTypeById: vi.fn() }));
import { revalidatePurchasePaths } from "./revalidation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
it("refreshes the ticket's event detail page when checkout completes", async () => {
  await revalidatePurchasePaths({} as SupabaseClient<Database>, "purchase-1");
  expect(calls.revalidatePath).toHaveBeenCalledWith("/portal/events/sprint");
});
