import { describe, expect, it } from "vitest";

import { membershipTypes } from "../data/membership-types.ts";
import { buildSeedEvents } from "../data/events.ts";
import { buildSeedUsers, SEED_PASSWORD } from "../data/users.ts";
import {
  classifySeedEvent,
  getUserFixtureTotals,
  validateUserFixtures,
} from "./user-fixtures.ts";

const fixedNow = new Date("2026-07-31T19:00:00.000Z");
const seedEvents = buildSeedEvents(fixedNow);
const seedUsers = buildSeedUsers(seedEvents, fixedNow);

describe("user seed fixtures", () => {
  it("reference valid memberships, events, questions, sessions, and purchases", () => {
    expect(() =>
      validateUserFixtures(seedUsers, seedEvents, membershipTypes, fixedNow)
    ).not.toThrow();
  });

  it("reports the representative dataset totals", () => {
    expect(getUserFixtureTotals(seedUsers)).toEqual({
      authUsers: 10,
      profiles: 10,
      purchases: 18,
      registrations: 15,
      responses: 22,
      checkIns: 6,
    });
  });

  it("covers every membership state crossed with both roles", () => {
    const grid = seedUsers
      .map((user) => `${user.membershipSlug ?? "none"}/${user.profile.role_access}`)
      .sort();

    expect(grid).toEqual(
      [
        "explorer/basic",
        "explorer/admin",
        "innovator/basic",
        "innovator/admin",
        "faculty/basic",
        "faculty/admin",
        "non-ubc/basic",
        "non-ubc/admin",
        "none/basic",
        "none/admin",
      ].sort()
    );
  });

  it("reaches every user type", () => {
    const types = new Set(seedUsers.map((user) => user.profile.user_type));

    expect(types).toEqual(new Set(["ubcStudent", "faculty", "nonUbc"]));
  });

  it("signs every account in with the same password", () => {
    for (const user of seedUsers) {
      expect(user.password).toBe(SEED_PASSWORD);
      // Supabase enforces minimum_password_length = 6 (supabase/config.toml).
      expect(user.password.length).toBeGreaterThanOrEqual(6);
    }
  });

  it("gives the deep fixtures purchased coverage across all timeline phases", () => {
    const eventBySlug = new Map(
      seedEvents.map((event) => [event.event.slug, event])
    );

    const deep = seedUsers.filter((user) => user.fullEventHistory);
    expect(deep).toHaveLength(3);

    for (const user of deep) {
      const purchaseByKey = new Map(
        user.purchases.map((purchase) => [purchase.idempotencyKey, purchase])
      );
      const phases = new Set(
        user.registrations.flatMap((registration) => {
          const purchase = registration.purchaseKey
            ? purchaseByKey.get(registration.purchaseKey)
            : null;
          const event = eventBySlug.get(registration.eventSlug);
          return registration.status === "accepted" &&
            purchase?.status === "completed" &&
            event
            ? [classifySeedEvent(event, fixedNow)]
            : [];
        })
      );

      expect(phases).toEqual(new Set(["past", "ongoing", "upcoming"]));
    }
  });

  it("rejects duplicate identity and purchase keys", () => {
    const duplicateEmail = structuredClone(seedUsers);
    duplicateEmail[1].email = duplicateEmail[0].email;
    expect(() =>
      validateUserFixtures(duplicateEmail, seedEvents, membershipTypes, fixedNow)
    ).toThrow("Duplicate user email");

    const duplicatePurchase = structuredClone(seedUsers);
    duplicatePurchase[1].purchases[0].idempotencyKey =
      duplicatePurchase[0].purchases[0].idempotencyKey;
    expect(() =>
      validateUserFixtures(
        duplicatePurchase,
        seedEvents,
        membershipTypes,
        fixedNow
      )
    ).toThrow("Duplicate purchase idempotency key");
  });

  it("rejects invalid membership and registration relationships", () => {
    const nonMemberPurchase = structuredClone(seedUsers);
    nonMemberPurchase[1].purchases.push({
      ...nonMemberPurchase[0].purchases[0],
      idempotencyKey: "seed:invalid:membership",
    });
    expect(() =>
      validateUserFixtures(
        nonMemberPurchase,
        seedEvents,
        membershipTypes,
        fixedNow
      )
    ).toThrow("cannot have a membership purchase");

    const wrongTicket = structuredClone(seedUsers);
    wrongTicket[1].registrations[0].purchaseKey =
      "seed:event:not-member:thinkbox-office-tour-2027:failed";
    expect(() =>
      validateUserFixtures(wrongTicket, seedEvents, membershipTypes, fixedNow)
    ).toThrow("invalid purchase link");
  });
});
