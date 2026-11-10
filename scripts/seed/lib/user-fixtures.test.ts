import { describe, expect, it } from "vitest";

import { membershipTypes } from "../data/membership-types.ts";
import { buildSeedEvents } from "../data/events.ts";
import { buildSeedUsers, SEED_PASSWORD } from "../data/users.ts";
import { buildSeedCrowd, isCrowdEmail } from "../data/crowd.ts";
import {
  classifySeedEvent,
  getUserFixtureTotals,
  isActiveSeedMember,
  validateUserFixtures,
} from "./user-fixtures.ts";

const fixedNow = new Date("2026-07-31T19:00:00.000Z");
const seedEvents = buildSeedEvents(fixedNow);
const seedUsers = buildSeedUsers(seedEvents, fixedNow);
const crowd = buildSeedCrowd(seedEvents, fixedNow);
const everyone = [...seedUsers, ...crowd];

describe("user seed fixtures", () => {
  it("reference valid memberships, events, questions, sessions, and purchases", () => {
    expect(() =>
      validateUserFixtures(seedUsers, seedEvents, membershipTypes, fixedNow)
    ).not.toThrow();
    expect(() =>
      validateUserFixtures(everyone, seedEvents, membershipTypes, fixedNow)
    ).not.toThrow();
  });

  it("reports the representative dataset totals", () => {
    expect(getUserFixtureTotals(seedUsers)).toEqual({
      authUsers: 11,
      profiles: 11,
      purchases: 18,
      tickets: 12,
      applications: 6,
      responses: 27,
      checkIns: 6,
    });
  });

  it("covers the basic/admin grid and a dedicated manager", () => {
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
        "none/manager",
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
      expect(user.password?.length).toBeGreaterThanOrEqual(6);
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
          return registration.ticket &&
            purchase?.status === "completed" &&
            event
            ? [classifySeedEvent(event, fixedNow)]
            : [];
        })
      );

      expect(phases).toEqual(new Set(["past", "ongoing", "upcoming"]));
    }
  });

  it("lets only a draft leave required questions unanswered", () => {
    const draft = seedUsers
      .flatMap((user) => user.registrations)
      .find((registration) => registration.application?.status === "draft");
    expect(draft?.eventSlug).toBe("uxathon-upcoming");

    const submitted = structuredClone(seedUsers);
    submitted
      .flatMap((user) => user.registrations)
      .find((registration) => registration.application?.status === "draft")!
      .application = { status: "submitted", submittedAt: fixedNow.toISOString() };
    expect(() =>
      validateUserFixtures(submitted, seedEvents, membershipTypes, fixedNow)
    ).toThrow("is missing required response");
  });

  it("checks each option of a checkbox answer, in either stored form", () => {
    const invalid = structuredClone(seedUsers);
    invalid[0].registrations.find(
      (registration) => registration.eventSlug === "design-sprint-past"
    )!.responses!["Any dietary restrictions we should know about for lunch?"] =
      '["Vegetarian","Pescatarian"]';
    expect(() =>
      validateUserFixtures(invalid, seedEvents, membershipTypes, fixedNow)
    ).toThrow('Response "Pescatarian" is invalid');
  });

  it("keeps applications to events that take them, with a deadline when accepted", () => {
    const withoutApplication = structuredClone(seedUsers);
    const sprint = withoutApplication[0].registrations.find(
      (registration) => registration.eventSlug === "design-sprint-past"
    )!;
    delete sprint.application;
    expect(() =>
      validateUserFixtures(withoutApplication, seedEvents, membershipTypes, fixedNow)
    ).toThrow("needs an application");

    const noDeadline = structuredClone(seedUsers);
    noDeadline[0].registrations.find(
      (registration) => registration.eventSlug === "design-sprint-past"
    )!.application = { status: "accepted" };
    expect(() =>
      validateUserFixtures(noDeadline, seedEvents, membershipTypes, fixedNow)
    ).toThrow("needs an offer deadline exactly when accepted");

    const unaccepted = structuredClone(seedUsers);
    unaccepted[0].registrations.find(
      (registration) => registration.eventSlug === "design-sprint-past"
    )!.application = { status: "waitlisted", submittedAt: fixedNow.toISOString() };
    expect(() =>
      validateUserFixtures(unaccepted, seedEvents, membershipTypes, fixedNow)
    ).toThrow("has a ticket without an accepted application");

    const checkedInWithoutTicket = structuredClone(seedUsers);
    const uxathon = checkedInWithoutTicket[0].registrations.find(
      (registration) => registration.eventSlug === "uxathon-past"
    )!;
    uxathon.checkIns = { "Evening Headcount": fixedNow.toISOString() };
    expect(() =>
      validateUserFixtures(checkedInWithoutTicket, seedEvents, membershipTypes, fixedNow)
    ).toThrow("has check-ins but no ticket");
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
    ).toThrow("cannot have a completed membership purchase");

    const wrongTicket = structuredClone(seedUsers);
    wrongTicket[1].registrations[0].purchaseKey =
      "seed:event:not-member:thinkbox-office-tour-2027:failed";
    expect(() =>
      validateUserFixtures(wrongTicket, seedEvents, membershipTypes, fixedNow)
    ).toThrow("invalid purchase link");
  });

  it("covers verified, unverified, and empty admin profile states", () => {
    const verified = seedUsers.filter((user) => user.studentVerification);
    expect(verified.map((user) => user.email)).toEqual(["student-explorer@example.com"]);
    expect(seedUsers.some((user) => !user.studentVerification)).toBe(true);
    expect(
      seedUsers.filter(
        (user) => user.profile.birth_date === null && user.profile.interests?.length === 0
      ).map((user) => user.email)
    ).toEqual(["admin-no-membership@example.com"]);
    // Written on every run so changes made through the admin dialog are undone.
    for (const user of seedUsers) {
      expect(user.profile).toMatchObject({
        profile_photo_path: null,
        student_verified_at: null,
        student_verified_by: null,
      });
    }
  });

  it("rejects a verification no manager could have made", () => {
    const index = seedUsers.findIndex((user) => user.studentVerification);

    const byAdmin = structuredClone(seedUsers);
    byAdmin[index].studentVerification!.verifiedByEmail = "admin-explorer@example.com";
    expect(() =>
      validateUserFixtures(byAdmin, seedEvents, membershipTypes, fixedNow)
    ).toThrow("must be verified by a manager fixture");

    const ofFaculty = structuredClone(seedUsers);
    const faculty = ofFaculty.find((user) => user.profile.user_type === "faculty")!;
    faculty.studentVerification = ofFaculty[index].studentVerification;
    expect(() =>
      validateUserFixtures(ofFaculty, seedEvents, membershipTypes, fixedNow)
    ).toThrow("Only a UBC student can be verified");

    const inFuture = structuredClone(seedUsers);
    inFuture[index].studentVerification!.verifiedAt = "2999-01-01T00:00:00.000Z";
    expect(() =>
      validateUserFixtures(inFuture, seedEvents, membershipTypes, fixedNow)
    ).toThrow("cannot be verified in the future");
  });
});

describe("the crowd", () => {
  it("is 30 to 50 profile-only accounts on the crowd domains", () => {
    expect(crowd.length).toBeGreaterThanOrEqual(30);
    expect(crowd.length).toBeLessThanOrEqual(50);
    for (const user of crowd) {
      expect(user.password).toBeNull();
      expect(isCrowdEmail(user.email)).toBe(true);
      expect(user.profile.role_access).toBe("basic");
      expect(user.fullEventHistory).toBe(false);
    }
    for (const user of seedUsers) expect(isCrowdEmail(user.email)).toBe(false);
    expect(getUserFixtureTotals(crowd).authUsers).toBe(0);
  });

  it("builds the same people with the same answers every time", () => {
    expect(buildSeedCrowd(seedEvents, fixedNow)).toEqual(crowd);
  });

  it("spreads across every user type and membership tier", () => {
    expect(new Set(crowd.map((user) => user.profile.user_type))).toEqual(
      new Set(["ubcStudent", "faculty", "nonUbc"])
    );
    expect(new Set(crowd.map((user) => user.membershipSlug))).toEqual(
      new Set([null, "explorer", "innovator", "faculty", "non-ubc"])
    );
  });

  it("fills the upcoming UXathon's review queue with every state admins see", () => {
    const states = new Set(
      crowd.flatMap((user) =>
        user.registrations
          .filter((registration) => registration.eventSlug === "uxathon-upcoming")
          .map(({ application, ticket }) => {
            if (application?.status !== "accepted") return application?.status;
            if (ticket) return "registered";
            return new Date(application.offerExpiresAt!) > fixedNow
              ? "accepted"
              : "offer_expired";
          })
      )
    );
    expect(states).toEqual(
      new Set([
        "submitted",
        "waitlisted",
        "accepted",
        "registered",
        "offer_expired",
        "rejected",
      ])
    );
  });

  it("attaches portfolio PDFs to some UXathon applications", () => {
    const files = crowd.flatMap((user) =>
      user.registrations.flatMap((registration) => Object.values(registration.files ?? {}))
    );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(file).toMatch(/^[A-Za-z0-9._ ()-]+\.pdf$/);
  });

  it("covers lapsed, pre-ordered, pending and canceled memberships", () => {
    const lapsed = crowd.filter(
      (user) => user.membershipSlug && !isActiveSeedMember(user, fixedNow)
    );
    expect(lapsed.length).toBeGreaterThanOrEqual(2);
    expect(crowd.filter((user) => user.membershipPreOrderedSlug)).toHaveLength(1);

    const statuses = new Set(
      crowd.flatMap((user) => user.purchases.map((purchase) => purchase.status))
    );
    for (const status of ["completed", "pending", "canceled", "failed"]) {
      expect(statuses).toContain(status);
    }
  });

  it("rejects a crowd account that could sign in, or a login fixture on a crowd domain", () => {
    const withPassword = structuredClone(everyone);
    withPassword[seedUsers.length].password = SEED_PASSWORD;
    expect(() =>
      validateUserFixtures(withPassword, seedEvents, membershipTypes, fixedNow)
    ).toThrow("cannot use a crowd domain");

    const loginOnCrowd = structuredClone(everyone);
    loginOnCrowd[0].password = null;
    expect(() =>
      validateUserFixtures(loginOnCrowd, seedEvents, membershipTypes, fixedNow)
    ).toThrow("is not on a crowd domain");
  });

  it("rejects a pre-order without a pending purchase, or over an active membership", () => {
    const index = everyone.findIndex((user) => user.membershipPreOrderedSlug);

    const unpaid = structuredClone(everyone);
    unpaid[index].purchases = unpaid[index].purchases.filter(
      (purchase) => purchase.status !== "pending"
    );
    expect(() =>
      validateUserFixtures(unpaid, seedEvents, membershipTypes, fixedNow)
    ).toThrow("without a pending purchase");

    const active = structuredClone(everyone);
    delete active[index].membershipExpiresAt;
    expect(() =>
      validateUserFixtures(active, seedEvents, membershipTypes, fixedNow)
    ).toThrow("while one is still active");
  });

  it("rejects more seats than an event holds", () => {
    const overbooked = structuredClone(everyone);
    const spare = overbooked.find(
      (user) =>
        user.password === null &&
        !user.registrations.some((registration) => registration.eventSlug === "figma-basics-workshop") &&
        !user.purchases.some((purchase) => purchase.eventSlug === "figma-basics-workshop")
    )!;
    spare.registrations.push({ eventSlug: "figma-basics-workshop", ticket: true });
    expect(() =>
      validateUserFixtures(overbooked, seedEvents, membershipTypes, fixedNow)
    ).toThrow('"figma-basics-workshop" has 21 seats taken but holds only 20');
  });

  it("needs a submitted time on every application past draft", () => {
    const missing = structuredClone(everyone);
    const application = missing[seedUsers.length].registrations.find(
      (registration) => registration.application
    )!.application!;
    delete application.submittedAt;
    expect(() =>
      validateUserFixtures(missing, seedEvents, membershipTypes, fixedNow)
    ).toThrow("needs a submitted time exactly when it is not a draft");
  });
});
