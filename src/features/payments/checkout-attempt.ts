import type { PurchaseKind } from "./types";

const CHECKOUT_ATTEMPT_PREFIX = "uxhub-checkout-attempt";

export interface CheckoutAttemptScope {
  kind: PurchaseKind;
  slug: string;
  userId: string;
}

export function getCheckoutAttemptStorageKey({
  kind,
  slug,
  userId,
}: CheckoutAttemptScope) {
  return [CHECKOUT_ATTEMPT_PREFIX, userId, kind, slug]
    .map(encodeURIComponent)
    .join(":");
}

export function getOrCreateCheckoutAttemptKey(
  storage: Pick<Storage, "getItem" | "setItem">,
  scope: CheckoutAttemptScope,
  createKey: () => string = () => crypto.randomUUID(),
) {
  const storageKey = getCheckoutAttemptStorageKey(scope);
  const existingKey = storage.getItem(storageKey);

  if (existingKey) return existingKey;

  const key = createKey();
  storage.setItem(storageKey, key);
  return key;
}

export function rotateCheckoutAttemptKey(
  storage: Pick<Storage, "setItem">,
  scope: CheckoutAttemptScope,
  createKey: () => string = () => crypto.randomUUID(),
) {
  const key = createKey();
  storage.setItem(getCheckoutAttemptStorageKey(scope), key);
  return key;
}

export function clearCheckoutAttemptKey(
  storage: Pick<Storage, "removeItem">,
  scope: CheckoutAttemptScope,
) {
  storage.removeItem(getCheckoutAttemptStorageKey(scope));
}
