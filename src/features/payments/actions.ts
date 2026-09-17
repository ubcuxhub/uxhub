"use server";

import { requireAuth } from "@/lib/auth/guards";
import { errorFields, log } from "@/lib/log";
import { executeCheckoutForUser } from "./fulfillment";
import { parseCheckoutRequest } from "./schemas";
import type { CheckoutActionResult } from "./types";

export async function submitCheckoutAction(
  input: unknown
): Promise<CheckoutActionResult> {
  const user = await requireAuth();

  try {
    const payload = parseCheckoutRequest(input);

    return await executeCheckoutForUser(user, payload);
  } catch (error) {
    log.error("checkout.submit_failed", errorFields(error));

    return {
      ok: false,
      error:
        "Checkout could not be confirmed. Check your purchases before trying again.",
      terminal: false,
    };
  }
}
