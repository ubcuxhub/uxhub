import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/lib/supabase/database.types.ts";
import { resolveTarget } from "../seed/lib/targets.ts";
import { parseArgs } from "./args.ts";
import {
  getPaymentSmokeStatus,
  seedPaymentSmokeTier,
  unseedPaymentSmokeTier,
  type PaymentSmokeStatus,
} from "./service.ts";
import { SupabasePaymentSmokeStore } from "./supabase-store.ts";

function display(value: string | null) {
  return value ?? "—";
}

function printStatus(status: PaymentSmokeStatus) {
  console.log(`Tier: ${status.state}`);
  if (!status.tier) return;

  console.log(`Price: $${Number(status.tier.price).toFixed(2)} CAD`);
  console.log(
    `References: ${status.references.purchases} purchases, ${status.references.memberships} memberships, ${status.references.preorders} pre-orders`,
  );

  if (status.purchases.length === 0) {
    console.log("Purchases: none");
    return;
  }

  console.log("Purchases:");
  for (const purchase of status.purchases) {
    const emailStatus = purchase.confirmation_email_sent_at
      ? "sent"
      : purchase.confirmation_email_attempted_at
        ? "attempted"
        : "not attempted";
    console.log(`  ${purchase.id}`);
    console.log(
      `    app=${purchase.status} fulfilled=${display(purchase.fulfilled_at)} square=${display(purchase.square_payment_id)}`,
    );
    console.log(
      `    webhook=${purchase.webhook_recorded ? "recorded" : "not recorded"} email=${emailStatus}`,
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const resolved = resolveTarget(options.target, process.env);
  const supabase = createClient<Database>(resolved.url, resolved.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const store = new SupabasePaymentSmokeStore(supabase);

  console.log(`Target: ${options.target} (${new URL(resolved.url).hostname})`);
  if (options.dryRun) console.log("Dry run — no writes will be made.");

  if (options.command === "seed") {
    const action = await seedPaymentSmokeTier(store, options);
    console.log(`Payment smoke-test tier: ${options.dryRun ? `would be ${action}` : action}.`);
    return;
  }

  if (options.command === "unseed") {
    const action = await unseedPaymentSmokeTier(store, options);
    console.log(
      `Payment smoke-test tier: ${options.dryRun ? `would be ${action}` : action}.`,
    );
    if (action === "retired") {
      console.log("Referenced purchases and memberships were preserved.");
    }
    return;
  }

  printStatus(await getPaymentSmokeStatus(store));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
