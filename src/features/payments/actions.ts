"use server";

import { requireAuth } from "@/lib/auth/guards";
import { errorFields, log } from "@/lib/log";
import { executeCheckoutForUser } from "./fulfillment";
import { CheckoutRequestError, parseCheckoutRequest } from "./schemas";
import type { CheckoutActionResult, CheckoutRequestInput } from "./types";

export async function submitCheckoutAction(
  input: unknown
): Promise<CheckoutActionResult> {
  const user = await requireAuth();

  // A malformed request is refused before anything is charged, so it is
  // final, and not a server fault worth an alert.
  let payload: CheckoutRequestInput;
  try {
    payload = parseCheckoutRequest(input);
  } catch (error) {
    log.warn("checkout.request_invalid", errorFields(error));
    return {
      ok: false,
      error:
        error instanceof CheckoutRequestError
          ? error.message
          : "Checkout could not start. Refresh the page and try again.",
      terminal: true,
    };
  }

  try {
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
