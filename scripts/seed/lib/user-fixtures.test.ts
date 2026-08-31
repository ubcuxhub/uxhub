import { describe, expect, it } from "vitest";

import { membershipTypes } from "../data/membership-types.ts";
import { buildSeedEvents } from "../data/events.ts";
import { buildSeedUsers } from "../data/users.ts";
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
      authUsers: 3,
      profiles: 3,
      purchases: 12,
      registrations: 14,
      responses: 22,
      checkIns: 5,
    });
  });

  it("gives every user purchased coverage across all timeline phases", () => {
    const eventBySlug = new Map(
      seedEvents.map((event) => [event.event.slug, event])
    );

    for (const user of seedUsers) {
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
