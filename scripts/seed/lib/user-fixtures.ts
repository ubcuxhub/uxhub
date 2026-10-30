import type { SeedUser } from "../data/users.ts";
import type { SeedEvent } from "../data/events.ts";
import type { TablesInsert } from "../../../src/lib/supabase/database.types.ts";

export interface UserFixtureTotals {
  authUsers: number;
  profiles: number;
  purchases: number;
  tickets: number;
  applications: number;
  responses: number;
  checkIns: number;
}

export type SeedEventPhase = "past" | "ongoing" | "upcoming";

export function classifySeedEvent(event: SeedEvent, now: Date): SeedEventPhase {
  const start = new Date(event.event.starts_at!).getTime();
  const end = new Date(event.event.ends_at!).getTime();
  const current = now.getTime();

  if (start <= current && current <= end) return "ongoing";
  return start > current ? "upcoming" : "past";
}

export function getUserFixtureTotals(users: SeedUser[]): UserFixtureTotals {
  return users.reduce<UserFixtureTotals>(
    (totals, user) => {
      totals.authUsers += 1;
      totals.profiles += 1;
      totals.purchases += user.purchases.length;
      totals.tickets += user.registrations.filter((r) => r.ticket).length;
      totals.applications += user.registrations.filter((r) => r.application).length;

      for (const registration of user.registrations) {
        totals.responses += Object.keys(registration.responses ?? {}).length;
        totals.checkIns += Object.keys(registration.checkIns ?? {}).length;
      }

      return totals;
    },
    {
      authUsers: 0,
      profiles: 0,
      purchases: 0,
      tickets: 0,
      applications: 0,
      responses: 0,
      checkIns: 0,
    }
  );
}

/**
 * Holds a fixture profile to the field set its `user_type` actually owns.
 *
 * `completeMembershipProfile` in src/features/memberships/actions.ts nulls the
 * other two sets whenever somebody picks a classification, so a real account
 * never carries, say, both a student number and a faculty email. A fixture that
 * does would be testing a state the app cannot produce.
 */
function assertProfileMatchesUserType(user: SeedUser): void {
  const { profile, email } = user;
  const userType = profile.user_type ?? "ubcStudent";

  const forbidden: Record<string, unknown> =
    userType === "ubcStudent"
      ? {
          faculty_email: profile.faculty_email,
          school_institution: profile.school_institution,
          student_status: profile.student_status,
        }
      : userType === "faculty"
        ? {
            student_number: profile.student_number,
            major: profile.major,
            year: profile.year,
            school_institution: profile.school_institution,
            student_status: profile.student_status,
          }
        : {
            faculty_email: profile.faculty_email,
            student_number: profile.student_number,
            faculty: profile.faculty,
            major: profile.major,
          };

  const set = Object.entries(forbidden)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([field]) => field);

  if (set.length > 0) {
    throw new Error(
      `"${email}" is ${userType} but sets ${set.join(", ")}, which that type does not own`
    );
  }

  if (userType === "ubcStudent" && profile.student_number == null) {
    throw new Error(`UBC student "${email}" needs a student number`);
  }

  if (userType === "faculty") {
    // Both rules come from the real signup path: the address must be UBC's, and
    // it must be the one the account signs in with.
    if (!/^[^\s@]+@([a-z0-9-]+\.)*ubc\.ca$/i.test(profile.faculty_email ?? "")) {
      throw new Error(`Faculty "${email}" needs a ubc.ca faculty_email`);
    }
    if (profile.faculty_email !== email) {
      throw new Error(
        `Faculty "${email}" has faculty_email "${profile.faculty_email}"; they must match`
      );
    }
  }
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label} "${value}" in user seed data`);
    }
    seen.add(value);
  }
}

export function validateUserFixtures(
  users: SeedUser[],
  events: SeedEvent[],
  memberships: TablesInsert<"membership_types">[],
  now = new Date()
): void {
  const eventBySlug = new Map(events.map((event) => [event.event.slug, event]));
  const membershipBySlug = new Map(
    memberships.map((membership) => [membership.slug, membership])
  );
  const membershipSlugs = new Set(membershipBySlug.keys());
  const normalizedEmails = users.map((user) => user.email.trim().toLowerCase());

  assertUnique(normalizedEmails, "user email");
  assertUnique(
    users.flatMap((user) => user.purchases.map((purchase) => purchase.idempotencyKey)),
    "purchase idempotency key"
  );

  const userByEmail = new Map(users.map((user) => [user.email, user]));

  for (const user of users) {
    if (user.email !== user.email.trim().toLowerCase()) {
      throw new Error(`Seed user email must be normalized: "${user.email}"`);
    }
    if (!user.profile.first_name.trim() || !user.profile.last_name.trim()) {
      throw new Error(`"${user.email}" needs both a first and last name`);
    }
    if (user.password.length < 6) {
      throw new Error(`Seed password for "${user.email}" must be at least 6 characters`);
    }
    if (user.membershipSlug && !membershipSlugs.has(user.membershipSlug)) {
      throw new Error(
        `Unknown membership slug "${user.membershipSlug}" for "${user.email}"`
      );
    }

    assertProfileMatchesUserType(user);

    // Mirrors `setStudentVerificationAction`: only a manager verifies, and
    // only a UBC student has a student number to verify.
    if (user.studentVerification) {
      const { verifiedByEmail, verifiedAt } = user.studentVerification;
      const verifier = userByEmail.get(verifiedByEmail);
      if (verifier?.profile.role_access !== "manager") {
        throw new Error(
          `"${user.email}" must be verified by a manager fixture, not "${verifiedByEmail}"`
        );
      }
      if ((user.profile.user_type ?? "ubcStudent") !== "ubcStudent") {
        throw new Error(`Only a UBC student can be verified, not "${user.email}"`);
      }
      if (new Date(verifiedAt) > now) {
        throw new Error(`"${user.email}" cannot be verified in the future`);
      }
    }

    // `isEligibleForMembership` in src/features/memberships/lib/policy.ts gates
    // on `eligible_user_types.includes(user_type)`, so a tier the fixture's own
    // type could never buy describes an account the app would not have created.
    if (user.membershipSlug) {
      const tier = membershipBySlug.get(user.membershipSlug);
      const eligible = tier?.eligible_user_types ?? [];
      const userType = user.profile.user_type ?? "ubcStudent";

      if (!eligible.includes(userType)) {
        throw new Error(
          `"${user.email}" is ${userType} but holds the "${user.membershipSlug}" tier, ` +
            `which only ${eligible.join(", ") || "nobody"} can buy`
        );
      }
    }

    const purchaseByKey = new Map(
      user.purchases.map((purchase) => [purchase.idempotencyKey, purchase])
    );
    const registrationSlugs = user.registrations.map(
      (registration) => registration.eventSlug
    );
    assertUnique(registrationSlugs, `registration event for ${user.email}`);

    const membershipPurchases = user.purchases.filter(
      (purchase) => purchase.kind === "membership"
    );
    if (!user.membershipSlug && membershipPurchases.length > 0) {
      throw new Error(`Non-member "${user.email}" cannot have a membership purchase`);
    }
    if (
      user.membershipSlug &&
      !membershipPurchases.some(
        (purchase) =>
          purchase.membershipSlug === user.membershipSlug &&
          purchase.status === "completed"
      )
    ) {
      throw new Error(
        `Member "${user.email}" needs a completed ${user.membershipSlug} purchase`
      );
    }

    for (const purchase of user.purchases) {
      const hasEvent = Boolean(purchase.eventSlug);
      const hasMembership = Boolean(purchase.membershipSlug);

      if (
        (purchase.kind === "event_ticket" && (!hasEvent || hasMembership)) ||
        (purchase.kind === "membership" && (!hasMembership || hasEvent))
      ) {
        throw new Error(
          `Purchase "${purchase.idempotencyKey}" has invalid kind references`
        );
      }
      if (purchase.eventSlug && !eventBySlug.has(purchase.eventSlug)) {
        throw new Error(
          `Purchase "${purchase.idempotencyKey}" references unknown event "${purchase.eventSlug}"`
        );
      }
      if (purchase.membershipSlug && !membershipSlugs.has(purchase.membershipSlug)) {
        throw new Error(
          `Purchase "${purchase.idempotencyKey}" references unknown membership "${purchase.membershipSlug}"`
        );
      }

      const expectedAmount = purchase.eventSlug
        ? Number(
            user.membershipSlug
              ? eventBySlug.get(purchase.eventSlug)?.event.member_price
              : eventBySlug.get(purchase.eventSlug)?.event.regular_price
          ) * 100
        : Number(
            membershipBySlug.get(purchase.membershipSlug ?? "")?.price
          ) * 100;
      if (purchase.amountCents !== expectedAmount) {
        throw new Error(
          `Purchase "${purchase.idempotencyKey}" amount ${purchase.amountCents} does not match expected ${expectedAmount}`
        );
      }
    }

    for (const registration of user.registrations) {
      const event = eventBySlug.get(registration.eventSlug);
      if (!event) {
        throw new Error(
          `Registration for "${user.email}" references unknown event "${registration.eventSlug}"`
        );
      }

      if (registration.purchaseKey && !registration.ticket) {
        throw new Error(
          `Registration for "${registration.eventSlug}" links a purchase but has no ticket`
        );
      }
      if (registration.checkIns && !registration.ticket) {
        throw new Error(
          `Registration for "${registration.eventSlug}" has check-ins but no ticket`
        );
      }

      // Applications exist only for events that take them, which the seed
      // marks by giving the event questions (see seedEvents in index.ts).
      const takesApplications = event.applicationQuestions.length > 0;
      if (takesApplications !== Boolean(registration.application)) {
        throw new Error(
          takesApplications
            ? `Registration for "${registration.eventSlug}" needs an application`
            : `Registration for "${registration.eventSlug}" has an application on an event that takes none`
        );
      }
      if (
        registration.application &&
        (registration.application.status === "accepted") !==
          Boolean(registration.application.offerExpiresAt)
      ) {
        throw new Error(
          `Application for "${registration.eventSlug}" needs an offer deadline exactly when accepted`
        );
      }
      if (
        registration.ticket &&
        registration.application &&
        registration.application.status !== "accepted"
      ) {
        throw new Error(
          `Registration for "${registration.eventSlug}" has a ticket without an accepted application`
        );
      }

      if (registration.purchaseKey) {
        const purchase = purchaseByKey.get(registration.purchaseKey);
        if (
          !purchase ||
          purchase.kind !== "event_ticket" ||
          purchase.eventSlug !== registration.eventSlug ||
          purchase.status !== "completed"
        ) {
          throw new Error(
            `Registration for "${registration.eventSlug}" has an invalid purchase link`
          );
        }
      }

      const questionByText = new Map(
        event.applicationQuestions.map((question) => [question.question, question])
      );
      const responses = registration.responses ?? {};

      for (const question of event.applicationQuestions) {
        if (question.is_required && !responses[question.question]?.trim()) {
          throw new Error(
            `Registration for "${registration.eventSlug}" is missing required response "${question.question}"`
          );
        }
      }

      for (const [questionText, response] of Object.entries(responses)) {
        const question = questionByText.get(questionText);
        if (!question) {
          throw new Error(
            `Registration for "${registration.eventSlug}" references unknown question "${questionText}"`
          );
        }

        if (question.response_options && response) {
          const selected =
            question.response_type === "checkbox"
              ? response.split(",").map((value) => value.trim())
              : [response];
          const invalid = selected.find(
            (value) => !question.response_options?.includes(value)
          );
          if (invalid) {
            throw new Error(
              `Response "${invalid}" is invalid for question "${questionText}"`
            );
          }
        }
      }

      const sessionNames = new Set(
        event.checkInSessions.map((session) => session.name)
      );
      for (const sessionName of Object.keys(registration.checkIns ?? {})) {
        if (!sessionNames.has(sessionName)) {
          throw new Error(
            `Registration for "${registration.eventSlug}" references unknown check-in session "${sessionName}"`
          );
        }
      }
    }

    // Only the deep fixtures carry a full timeline. The grid accounts exist to
    // cover the membership x role combinations and hold a membership purchase
    // at most; see SeedUser.fullEventHistory.
    if (!user.fullEventHistory) continue;

    const purchasedPhases = new Set<SeedEventPhase>();
    for (const registration of user.registrations) {
      if (!registration.ticket || !registration.purchaseKey) continue;
      const purchase = purchaseByKey.get(registration.purchaseKey);
      const event = eventBySlug.get(registration.eventSlug);
      if (purchase?.status === "completed" && event) {
        purchasedPhases.add(classifySeedEvent(event, now));
      }
    }

    for (const phase of ["past", "ongoing", "upcoming"] as const) {
      if (!purchasedPhases.has(phase)) {
        throw new Error(
          `User "${user.email}" needs a completed purchased ${phase} registration`
        );
      }
    }
  }
}
