import { describe, expect, it } from "vitest";

import {
  clearCheckoutAttemptKey,
  getCheckoutAttemptStorageKey,
  getOrCreateCheckoutAttemptKey,
  rotateCheckoutAttemptKey,
} from "./checkout-attempt";

function createStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe("checkout attempt storage", () => {
  const membershipScope = {
    kind: "membership" as const,
    slug: "student",
    userId: "user-1",
  };

  it("keeps one key across remounts for the same user and product", () => {
    const storage = createStorage();
    let generated = 0;
    const createKey = () => `key-${++generated}`;

    expect(
      getOrCreateCheckoutAttemptKey(storage, membershipScope, createKey),
    ).toBe("key-1");
    expect(
      getOrCreateCheckoutAttemptKey(storage, membershipScope, createKey),
    ).toBe("key-1");
    expect(generated).toBe(1);
  });

  it("scopes attempts by user, kind, and slug", () => {
    const storage = createStorage();
    let generated = 0;
    const createKey = () => `key-${++generated}`;

    const membershipKey = getOrCreateCheckoutAttemptKey(
      storage,
      membershipScope,
      createKey,
    );
    const eventKey = getOrCreateCheckoutAttemptKey(
      storage,
      { kind: "event_ticket", slug: "student", userId: "user-1" },
      createKey,
    );
    const otherUserKey = getOrCreateCheckoutAttemptKey(
      storage,
      { ...membershipScope, userId: "user-2" },
      createKey,
    );

    expect(new Set([membershipKey, eventKey, otherUserKey]).size).toBe(3);
  });

  it("rotates terminal attempts and clears completed attempts", () => {
    const storage = createStorage();
    getOrCreateCheckoutAttemptKey(storage, membershipScope, () => "first");

    expect(
      rotateCheckoutAttemptKey(storage, membershipScope, () => "second"),
    ).toBe("second");
    expect(
      storage.getItem(getCheckoutAttemptStorageKey(membershipScope)),
    ).toBe("second");

    clearCheckoutAttemptKey(storage, membershipScope);
    expect(
      storage.getItem(getCheckoutAttemptStorageKey(membershipScope)),
    ).toBeNull();
  });
});
