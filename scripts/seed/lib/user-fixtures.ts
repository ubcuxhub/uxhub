import type { SeedApplication, SeedUser } from "../data/users.ts";
import type { SeedEvent } from "../data/events.ts";
import type { TablesInsert } from "../../../src/lib/supabase/database.types.ts";

export interface UserFixtureTotals {
  applications: number;
  authUsers: number;
  checkIns: number;
  profiles: number;
  purchases: number;
  registrations: number;
  responses: number;
}

export type SeedEventPhase = "past" | "ongoing" | "upcoming";

export function classifySeedEvent(event: SeedEvent, now: Date): SeedEventPhase {
  const start = new Date(`${event.event.start_date}T00:00:00.000Z`).getTime();
  const end = new Date(`${event.event.end_date}T23:59:59.999Z`).getTime();
  const current = now.getTime();

  if (start <= current && current <= end) return "ongoing";
  return start > current ? "upcoming" : "past";
}

function isApplicationEvent(event: SeedEvent): boolean {
  return event.applicationQuestions.length > 0;
}

export function getUserFixtureTotals(users: SeedUser[]): UserFixtureTotals {
  return users.reduce<UserFixtureTotals>(
    (totals, user) => {
      totals.authUsers += 1;
      totals.profiles += 1;
      totals.purchases += user.purchases.length;
      totals.applications += user.applications.length;
      totals.registrations += user.registrations.length;

      for (const application of user.applications) {
        totals.responses += Object.keys(application.responses).length;
      }
      for (const registration of user.registrations) {
        totals.checkIns += Object.keys(registration.checkIns ?? {}).length;
      }

      return totals;
    },
    {
      applications: 0,
      authUsers: 0,
      checkIns: 0,
      profiles: 0,
      purchases: 0,
      registrations: 0,
      responses: 0,
    }
  );
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

function validateApplicationResponses(
  application: SeedApplication,
  event: SeedEvent,
  email: string
): void {
  const questionByText = new Map(
    event.applicationQuestions.map((question) => [question.question, question])
  );

  for (const question of event.applicationQuestions) {
    if (question.is_required && !application.responses[question.question]?.trim()) {
      throw new Error(
        `Application for "${application.eventSlug}" by "${email}" is missing required response "${question.question}"`
      );
    }
  }

  for (const [questionText, response] of Object.entries(application.responses)) {
    const question = questionByText.get(questionText);
    if (!question) {
      throw new Error(
        `Application for "${application.eventSlug}" by "${email}" references unknown question "${questionText}"`
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

  for (const user of users) {
    if (user.email !== user.email.trim().toLowerCase()) {
      throw new Error(`Seed user email must be normalized: "${user.email}"`);
    }
    if (user.password.length < 6) {
      throw new Error(`Seed password for "${user.email}" must be at least 6 characters`);
    }
    if (user.membershipSlug && !membershipSlugs.has(user.membershipSlug)) {
      throw new Error(
        `Unknown membership slug "${user.membershipSlug}" for "${user.email}"`
      );
    }

    const purchaseByKey = new Map(
      user.purchases.map((purchase) => [purchase.idempotencyKey, purchase])
    );
    const applicationSlugs = user.applications.map(
      (application) => application.eventSlug
    );
    const registrationSlugs = user.registrations.map(
      (registration) => registration.eventSlug
    );
    assertUnique(applicationSlugs, `application event for ${user.email}`);
    assertUnique(registrationSlugs, `registration event for ${user.email}`);
    const applicationsBySlug = new Map(
      user.applications.map((application) => [application.eventSlug, application])
    );

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

    for (const application of user.applications) {
      const event = eventBySlug.get(application.eventSlug);
      if (!event) {
        throw new Error(
          `Application for "${user.email}" references unknown event "${application.eventSlug}"`
        );
      }
      if (!isApplicationEvent(event)) {
        throw new Error(
          `Application for "${application.eventSlug}" belongs to a direct-purchase event`
        );
      }

      if (application.status === "pending") {
        if (application.reviewerEmail || application.attendanceStatus) {
          throw new Error(
            `Pending application for "${application.eventSlug}" cannot have a reviewer or attendance status`
          );
        }
      } else if (!application.reviewerEmail) {
        throw new Error(
          `Reviewed application for "${application.eventSlug}" needs a reviewer`
        );
      }

      if (application.status === "accepted" && !application.attendanceStatus) {
        throw new Error(
          `Accepted application for "${application.eventSlug}" needs an attendance status`
        );
      }
      if (application.status !== "accepted" && application.attendanceStatus) {
        throw new Error(
          `Non-accepted application for "${application.eventSlug}" cannot have an attendance status`
        );
      }

      if (
        application.reviewerEmail &&
        !users.some((candidate) => candidate.email === application.reviewerEmail)
      ) {
        throw new Error(
          `Application reviewer "${application.reviewerEmail}" is not a seed user`
        );
      }

      validateApplicationResponses(application, event, user.email);
    }

    for (const registration of user.registrations) {
      const event = eventBySlug.get(registration.eventSlug);
      if (!event) {
        throw new Error(
          `Registration for "${user.email}" references unknown event "${registration.eventSlug}"`
        );
      }

      const application = applicationsBySlug.get(registration.eventSlug);
      if (isApplicationEvent(event)) {
        if (application?.status !== "accepted" || application.attendanceStatus !== "confirmed") {
          throw new Error(
            `Registration for "${registration.eventSlug}" needs a confirmed application`
          );
        }
      } else if (application) {
        throw new Error(
          `Direct-purchase event "${registration.eventSlug}" cannot have an application`
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
      } else if (!isApplicationEvent(event)) {
        throw new Error(
          `Direct registration for "${registration.eventSlug}" needs a completed purchase`
        );
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

    for (const application of user.applications) {
      if (application.attendanceStatus !== "confirmed") continue;
      if (!registrationSlugs.includes(application.eventSlug)) {
        throw new Error(
          `Confirmed application for "${application.eventSlug}" needs a registration`
        );
      }
    }

    const purchasedPhases = new Set<SeedEventPhase>();
    for (const registration of user.registrations) {
      if (!registration.purchaseKey) continue;
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
