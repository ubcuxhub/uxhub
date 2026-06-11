"use server";

import { requireAuth } from "@/lib/auth/guards";
import { executeCheckoutForUser } from "./fulfillment";
import { parseCheckoutRequest } from "./schemas";
import type { CheckoutActionResult } from "./types";

export async function submitCheckoutAction(
  input: unknown
): Promise<CheckoutActionResult> {
  try {
    const user = await requireAuth();
    const payload = parseCheckoutRequest(input);

    return await executeCheckoutForUser(user, payload);
  } catch (error) {
    console.error("submitCheckoutAction failed:", error);

    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Checkout could not be started.",
    };
  }
}
