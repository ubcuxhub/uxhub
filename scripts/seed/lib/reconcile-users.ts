import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { SeedRegistration, SeedUser } from "../data/users.ts";
import { emptyCounts, type Counts } from "./reconcile.ts";
import { planPrune, pruneKey } from "./prune.ts";
import { getUserFixtureTotals } from "./user-fixtures.ts";

const TABLE = {
  appSettings: "app_settings",
  checkInSessions: "check_in_sessions",
  checkIns: "check_ins",
  eventApplicationQuestions: "event_application_questions",
  eventApplicationResponses: "event_application_responses",
  eventApplications: "event_applications",
  // Legacy, until step 3 of docs/registration-rollout.md drops it. The seed
  // no longer writes it, and prunes what fixture accounts still hold there.
  eventRegistrations: "event_registrations",
  eventTickets: "event_tickets",
  events: "events",
  membershipTypes: "membership_types",
  purchases: "purchases",
  userInfo: "user_info",
} as const;

interface UserSeedOptions {
  allowPlannedDependencies: boolean;
  dryRun: boolean;
}

export interface UserSeedSummary {
  authUsers: Counts;
  profiles: Counts;
  purchases: Counts;
  tickets: Counts;
  applications: Counts;
  responses: Counts;
  checkIns: Counts;
  /** Fixture email -> `user_info.id`, for the prune pass in `index.ts`. */
  profileIds: Map<string, string>;
}

interface ProfileRow {
  auth_user_id: string | null;
  email: string;
  id: string;
}

interface DependencyReferences {
  complete: boolean;
  eventIds: Map<string, string>;
  membershipIds: Map<string, string>;
  questionIds: Map<string, string>;
  sessionIds: Map<string, string>;
}

interface IdentityState {
  authByEmail: Map<string, User>;
  profileByAuthId: Map<string, ProfileRow>;
  profileByEmail: Map<string, ProfileRow>;
}

function key(...parts: string[]): string {
  return parts.join("\u0000");
}

function countsFor(total: number, existing: number): Counts {
  return { created: total - existing, updated: existing, pruned: 0 };
}

function createdCounts(total: number): Counts {
  return { created: total, updated: 0, pruned: 0 };
}

function emptySummary(): UserSeedSummary {
  return {
    authUsers: emptyCounts(),
    profiles: emptyCounts(),
    purchases: emptyCounts(),
    tickets: emptyCounts(),
    applications: emptyCounts(),
    responses: emptyCounts(),
    checkIns: emptyCounts(),
    profileIds: new Map(),
  };
}

async function listAllAuthUsers(supabase: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  const perPage = 100;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Reading Auth users failed: ${error.message}`);

    users.push(...data.users);
    if (data.users.length < perPage) return users;
  }
}

async function inspectIdentityState(
  supabase: SupabaseClient,
  fixtures: SeedUser[]
): Promise<IdentityState> {
  const authUsers = await listAllAuthUsers(supabase);
  const fixtureEmails = fixtures.map((fixture) => fixture.email);
  const authByEmail = new Map<string, User>();

  for (const authUser of authUsers) {
    const email = authUser.email?.trim().toLowerCase();
    if (email && fixtureEmails.includes(email)) authByEmail.set(email, authUser);
  }

  const authIds = [...authByEmail.values()].map((user) => user.id);
  const byEmailResult = await supabase
    .from(TABLE.userInfo)
    .select("id, email, auth_user_id")
    .in("email", fixtureEmails);
  if (byEmailResult.error) {
    throw new Error(`Reading user profiles failed: ${byEmailResult.error.message}`);
  }

  let byAuthRows: ProfileRow[] = [];
  if (authIds.length > 0) {
    const byAuthResult = await supabase
      .from(TABLE.userInfo)
      .select("id, email, auth_user_id")
      .in("auth_user_id", authIds);
    if (byAuthResult.error) {
      throw new Error(`Reading linked user profiles failed: ${byAuthResult.error.message}`);
    }
    byAuthRows = (byAuthResult.data ?? []) as ProfileRow[];
  }

  const profileByEmail = new Map<string, ProfileRow>();
  const profileByAuthId = new Map<string, ProfileRow>();
  for (const profile of [
    ...((byEmailResult.data ?? []) as ProfileRow[]),
    ...byAuthRows,
  ]) {
    profileByEmail.set(profile.email.trim().toLowerCase(), profile);
    if (profile.auth_user_id) profileByAuthId.set(profile.auth_user_id, profile);
  }

  for (const fixture of fixtures) {
    const authUser = authByEmail.get(fixture.email);
    const emailProfile = profileByEmail.get(fixture.email);
    const authProfile = authUser ? profileByAuthId.get(authUser.id) : undefined;

    if (emailProfile?.auth_user_id && emailProfile.auth_user_id !== authUser?.id) {
      throw new Error(
        `Profile "${fixture.email}" is linked to a different Auth user; refusing to overwrite it`
      );
    }
    if (authProfile && authProfile.email.trim().toLowerCase() !== fixture.email) {
      throw new Error(
        `Auth user "${fixture.email}" is linked to profile "${authProfile.email}"; refusing to overwrite it`
      );
    }
    if (emailProfile && authProfile && emailProfile.id !== authProfile.id) {
      throw new Error(
        `Auth and profile records for "${fixture.email}" resolve to different users`
      );
    }
  }

  return { authByEmail, profileByAuthId, profileByEmail };
}

async function loadDependencies(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  allowPlannedDependencies: boolean
): Promise<DependencyReferences> {
  const membershipSlugs = [
    ...new Set(
      fixtures.flatMap((fixture) => [
        ...(fixture.membershipSlug ? [fixture.membershipSlug] : []),
        ...fixture.purchases.flatMap((purchase) =>
          purchase.membershipSlug ? [purchase.membershipSlug] : []
        ),
      ])
    ),
  ];
  const eventSlugs = [
    ...new Set(
      fixtures.flatMap((fixture) => [
        ...fixture.registrations.map((registration) => registration.eventSlug),
        ...fixture.purchases.flatMap((purchase) =>
          purchase.eventSlug ? [purchase.eventSlug] : []
        ),
      ])
    ),
  ];

  const [membershipResult, eventResult] = await Promise.all([
    supabase
      .from(TABLE.membershipTypes)
      .select("id, slug")
      .in("slug", membershipSlugs),
    supabase.from(TABLE.events).select("id, slug").in("slug", eventSlugs),
  ]);
  if (membershipResult.error) {
    throw new Error(`Reading membership dependencies failed: ${membershipResult.error.message}`);
  }
  if (eventResult.error) {
    throw new Error(`Reading event dependencies failed: ${eventResult.error.message}`);
  }

  const membershipIds = new Map<string, string>();
  for (const row of (membershipResult.data ?? []) as { id: string; slug: string }[]) {
    membershipIds.set(row.slug, row.id);
  }

  const eventIds = new Map<string, string>();
  for (const row of (eventResult.data ?? []) as { id: string; slug: string | null }[]) {
    if (row.slug) eventIds.set(row.slug, row.id);
  }

  const missingMemberships = membershipSlugs.filter(
    (slug) => !membershipIds.has(slug)
  );
  const missingEvents = eventSlugs.filter((slug) => !eventIds.has(slug));
  const missingParents = [
    ...missingMemberships.map((slug) => `membership:${slug}`),
    ...missingEvents.map((slug) => `event:${slug}`),
  ];

  if (missingParents.length > 0) {
    if (allowPlannedDependencies) {
      return {
        complete: false,
        eventIds,
        membershipIds,
        questionIds: new Map(),
        sessionIds: new Map(),
      };
    }
    throw new Error(
      `User seed dependencies are missing: ${missingParents.join(", ")}. ` +
        "Run memberships/events first or include them in this seed run."
    );
  }

  const eventIdValues = [...eventIds.values()];
  const [questionResult, sessionResult] = await Promise.all([
    supabase
      .from(TABLE.eventApplicationQuestions)
      .select("id, event_id, question")
      .in("event_id", eventIdValues),
    supabase
      .from(TABLE.checkInSessions)
      .select("id, event_id, name")
      .in("event_id", eventIdValues),
  ]);
  if (questionResult.error) {
    throw new Error(`Reading application dependencies failed: ${questionResult.error.message}`);
  }
  if (sessionResult.error) {
    throw new Error(`Reading check-in dependencies failed: ${sessionResult.error.message}`);
  }

  const eventSlugById = new Map(
    [...eventIds.entries()].map(([slug, id]) => [id, slug])
  );
  const questionIds = new Map<string, string>();
  for (const row of (questionResult.data ?? []) as {
    event_id: string;
    id: string;
    question: string;
  }[]) {
    const eventSlug = eventSlugById.get(row.event_id);
    if (eventSlug) questionIds.set(key(eventSlug, row.question), row.id);
  }

  const sessionIds = new Map<string, string>();
  for (const row of (sessionResult.data ?? []) as {
    event_id: string;
    id: string;
    name: string;
  }[]) {
    const eventSlug = eventSlugById.get(row.event_id);
    if (eventSlug) sessionIds.set(key(eventSlug, row.name), row.id);
  }

  const missingChildren: string[] = [];
  for (const fixture of fixtures) {
    for (const registration of fixture.registrations) {
      for (const question of Object.keys(registration.responses ?? {})) {
        if (!questionIds.has(key(registration.eventSlug, question))) {
          missingChildren.push(`question:${registration.eventSlug}:${question}`);
        }
      }
      for (const session of Object.keys(registration.checkIns ?? {})) {
        if (!sessionIds.has(key(registration.eventSlug, session))) {
          missingChildren.push(`session:${registration.eventSlug}:${session}`);
        }
      }
    }
  }

  if (missingChildren.length > 0) {
    if (allowPlannedDependencies) {
      return { complete: false, eventIds, membershipIds, questionIds, sessionIds };
    }
    throw new Error(
      `User seed dependencies are missing: ${missingChildren.join(", ")}. ` +
        "Run events first or include them in this seed run."
    );
  }

  return { complete: true, eventIds, membershipIds, questionIds, sessionIds };
}

function getMembershipExpiry(): string {
  const expiry = new Date();
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
  return expiry.toISOString();
}

async function reconcileIdentities(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  dependencies: DependencyReferences,
  state: IdentityState
): Promise<{ authUsers: Counts; profiles: Counts; profileIds: Map<string, string> }> {
  const authUsers = countsFor(fixtures.length, state.authByEmail.size);
  const profiles = countsFor(fixtures.length, state.profileByEmail.size);
  const profileIds = new Map<string, string>();

  for (const fixture of fixtures) {
    let authUser = state.authByEmail.get(fixture.email);
    const authAttributes = {
      email: fixture.email,
      password: fixture.password,
      email_confirm: true,
      user_metadata: {
        first_name: fixture.profile.first_name,
        last_name: fixture.profile.last_name,
        seed_managed: true,
      },
    };

    if (authUser) {
      const { data, error } = await supabase.auth.admin.updateUserById(
        authUser.id,
        authAttributes
      );
      if (error) {
        throw new Error(`Updating Auth user "${fixture.email}" failed: ${error.message}`);
      }
      authUser = data.user;
    } else {
      const { data, error } = await supabase.auth.admin.createUser(authAttributes);
      if (error) {
        throw new Error(`Creating Auth user "${fixture.email}" failed: ${error.message}`);
      }
      authUser = data.user;
    }

    const membershipTypeId = fixture.membershipSlug
      ? dependencies.membershipIds.get(fixture.membershipSlug)
      : null;
    if (fixture.membershipSlug && !membershipTypeId) {
      throw new Error(`No ID found for membership "${fixture.membershipSlug}"`);
    }

    const existingProfile = state.profileByEmail.get(fixture.email);
    const payload = {
      ...fixture.profile,
      auth_user_id: authUser.id,
      email: fixture.email,
      membership_expires_at: membershipTypeId ? getMembershipExpiry() : null,
      membership_pre_ordered_type_id: null,
      membership_type_id: membershipTypeId,
    };

    if (existingProfile) {
      const { data, error } = await supabase
        .from(TABLE.userInfo)
        .update(payload)
        .eq("id", existingProfile.id)
        .select("id")
        .single();
      if (error) {
        throw new Error(`Updating profile "${fixture.email}" failed: ${error.message}`);
      }
      profileIds.set(fixture.email, (data as { id: string }).id);
    } else {
      const { data, error } = await supabase
        .from(TABLE.userInfo)
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        throw new Error(`Creating profile "${fixture.email}" failed: ${error.message}`);
      }
      profileIds.set(fixture.email, (data as { id: string }).id);
    }
  }

  return { authUsers, profiles, profileIds };
}

/**
 * Applies `studentVerification` once every profile exists. The identity pass
 * has already cleared verification on every fixture, so this leaves exactly the
 * verified accounts `users.ts` describes.
 */
async function reconcileStudentVerification(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  profileIds: Map<string, string>
): Promise<void> {
  for (const fixture of fixtures) {
    if (!fixture.studentVerification) continue;
    const { verifiedByEmail, verifiedAt } = fixture.studentVerification;
    const verifierId = profileIds.get(verifiedByEmail);
    if (!verifierId) {
      throw new Error(`No verifier profile found for "${verifiedByEmail}"`);
    }

    const { error } = await supabase
      .from(TABLE.userInfo)
      .update({ student_verified_at: verifiedAt, student_verified_by: verifierId })
      .eq("id", profileIds.get(fixture.email));
    if (error) {
      throw new Error(`Verifying "${fixture.email}" failed: ${error.message}`);
    }
  }
}

async function reconcilePurchases(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  profileIds: Map<string, string>,
  dependencies: DependencyReferences
): Promise<{ counts: Counts; purchaseIds: Map<string, string> }> {
  const purchases = fixtures.flatMap((fixture) =>
    fixture.purchases.map((purchase) => ({ fixture, purchase }))
  );
  const keys = purchases.map(({ purchase }) => purchase.idempotencyKey);
  const { data: existing, error: readError } = await supabase
    .from(TABLE.purchases)
    .select("id, idempotency_key, user_id")
    .in("idempotency_key", keys);
  if (readError) throw new Error(`Reading purchases failed: ${readError.message}`);

  const existingByKey = new Map(
    ((existing ?? []) as { id: string; idempotency_key: string; user_id: string }[]).map(
      (row) => [row.idempotency_key, row]
    )
  );

  const rows = purchases.map(({ fixture, purchase }) => {
    const userId = profileIds.get(fixture.email);
    if (!userId) throw new Error(`No profile ID found for "${fixture.email}"`);

    const existingPurchase = existingByKey.get(purchase.idempotencyKey);
    if (existingPurchase && existingPurchase.user_id !== userId) {
      throw new Error(
        `Purchase key "${purchase.idempotencyKey}" belongs to another user`
      );
    }

    return {
      amount_cents: purchase.amountCents,
      created_at: purchase.createdAt,
      currency: "CAD",
      event_id: purchase.eventSlug
        ? dependencies.eventIds.get(purchase.eventSlug)
        : null,
      failure_reason: purchase.failureReason ?? null,
      fulfilled_at: purchase.fulfilledAt ?? null,
      idempotency_key: purchase.idempotencyKey,
      kind: purchase.kind,
      membership_type_id: purchase.membershipSlug
        ? dependencies.membershipIds.get(purchase.membershipSlug)
        : null,
      square_customer_id: fixture.profile.square_customer_id ?? null,
      square_payment_id: purchase.squarePaymentId ?? null,
      status: purchase.status,
      user_id: userId,
    };
  });

  const { data, error } = await supabase
    .from(TABLE.purchases)
    .upsert(rows, { onConflict: "idempotency_key" })
    .select("id, idempotency_key");
  if (error) throw new Error(`Upserting purchases failed: ${error.message}`);

  const purchaseIds = new Map<string, string>();
  for (const row of (data ?? []) as { id: string; idempotency_key: string }[]) {
    purchaseIds.set(row.idempotency_key, row.id);
  }

  return { counts: countsFor(rows.length, existingByKey.size), purchaseIds };
}

interface EventUserRow {
  event_id: string;
  id: string;
  user_id: string;
}

/** Maps rows keyed by event and user to `key(email, eventSlug)` -> id. */
function idsByFixtureKey(
  rows: EventUserRow[],
  profileIds: Map<string, string>,
  eventIds: Map<string, string>
): Map<string, string> {
  const eventSlugById = new Map([...eventIds.entries()].map(([slug, id]) => [id, slug]));
  const emailByProfileId = new Map(
    [...profileIds.entries()].map(([email, id]) => [id, email])
  );
  const ids = new Map<string, string>();
  for (const row of rows) {
    const email = emailByProfileId.get(row.user_id);
    const eventSlug = eventSlugById.get(row.event_id);
    if (email && eventSlug) ids.set(key(email, eventSlug), row.id);
  }
  return ids;
}

async function readFixtureRows(
  supabase: SupabaseClient,
  table: typeof TABLE.eventTickets | typeof TABLE.eventApplications,
  userIds: string[],
  eventIds: string[],
  columns = "id, event_id, user_id"
) {
  if (userIds.length === 0 || eventIds.length === 0) return [];
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .in("user_id", userIds)
    .in("event_id", eventIds);
  if (error) throw new Error(`Reading ${table} failed: ${error.message}`);
  return (data ?? []) as unknown as (EventUserRow & Record<string, unknown>)[];
}

function fixtureRows<T>(
  fixtures: SeedUser[],
  profileIds: Map<string, string>,
  dependencies: DependencyReferences,
  build: (
    registration: SeedRegistration,
    ids: { eventId: string; userId: string }
  ) => T | null
): T[] {
  return fixtures.flatMap((fixture) => {
    const userId = profileIds.get(fixture.email);
    if (!userId) throw new Error(`No profile ID found for "${fixture.email}"`);

    return fixture.registrations.flatMap((registration) => {
      const eventId = dependencies.eventIds.get(registration.eventSlug);
      if (!eventId) throw new Error(`No event ID found for "${registration.eventSlug}"`);
      const row = build(registration, { eventId, userId });
      return row ? [row] : [];
    });
  });
}

async function reconcileTickets(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  profileIds: Map<string, string>,
  purchaseIds: Map<string, string>,
  dependencies: DependencyReferences
): Promise<{ counts: Counts; ticketIds: Map<string, string> }> {
  const existing = await readFixtureRows(
    supabase,
    TABLE.eventTickets,
    [...profileIds.values()],
    [...dependencies.eventIds.values()]
  );
  const existingKeys = new Set(existing.map((row) => key(row.user_id, row.event_id)));

  const rows = fixtureRows(fixtures, profileIds, dependencies, (registration, ids) => {
    if (!registration.ticket) return null;

    const purchaseId = registration.purchaseKey
      ? purchaseIds.get(registration.purchaseKey)
      : null;
    if (registration.purchaseKey && !purchaseId) {
      throw new Error(`No purchase ID found for "${registration.purchaseKey}"`);
    }

    return { event_id: ids.eventId, purchase_id: purchaseId, user_id: ids.userId };
  });

  if (rows.length === 0) return { counts: emptyCounts(), ticketIds: new Map() };

  const { data, error } = await supabase
    .from(TABLE.eventTickets)
    .upsert(rows, { onConflict: "event_id,user_id" })
    .select("id, event_id, user_id");
  if (error) throw new Error(`Upserting event tickets failed: ${error.message}`);

  return {
    counts: countsFor(
      rows.length,
      rows.filter((row) => existingKeys.has(key(row.user_id, row.event_id))).length
    ),
    ticketIds: idsByFixtureKey(
      (data ?? []) as EventUserRow[],
      profileIds,
      dependencies.eventIds
    ),
  };
}

async function reconcileApplications(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  profileIds: Map<string, string>,
  dependencies: DependencyReferences
): Promise<{ counts: Counts; applicationIds: Map<string, string> }> {
  const rows = fixtureRows(fixtures, profileIds, dependencies, (registration, ids) =>
    registration.application
      ? {
          event_id: ids.eventId,
          offer_expires_at: registration.application.offerExpiresAt ?? null,
          status: registration.application.status,
          user_id: ids.userId,
        }
      : null
  );

  if (rows.length === 0) return { counts: emptyCounts(), applicationIds: new Map() };

  const existing = await readFixtureRows(
    supabase,
    TABLE.eventApplications,
    [...profileIds.values()],
    [...dependencies.eventIds.values()],
    "id, event_id, user_id, status"
  );
  const statusByKey = new Map(
    existing.map((row) => [key(row.user_id, row.event_id), row.status as string])
  );

  // The database allows an application only the moves of a review
  // (docs/event-states.md), so one a run has to move backwards, such as an
  // acceptance made through the UI, is recreated. Its responses cascade and
  // are written again below.
  const moved = existing.filter((row) => {
    const desired = rows.find(
      (candidate) =>
        candidate.user_id === row.user_id && candidate.event_id === row.event_id
    );
    return desired && desired.status !== row.status;
  });
  if (moved.length > 0) {
    const { error } = await supabase
      .from(TABLE.eventApplications)
      .delete()
      .in(
        "id",
        moved.map((row) => row.id)
      );
    if (error) throw new Error(`Resetting event applications failed: ${error.message}`);
  }

  const { data, error } = await supabase
    .from(TABLE.eventApplications)
    .upsert(rows, { onConflict: "event_id,user_id" })
    .select("id, event_id, user_id");
  if (error) throw new Error(`Upserting event applications failed: ${error.message}`);

  return {
    counts: countsFor(
      rows.length,
      rows.filter((row) => statusByKey.has(key(row.user_id, row.event_id))).length
    ),
    applicationIds: idsByFixtureKey(
      (data ?? []) as EventUserRow[],
      profileIds,
      dependencies.eventIds
    ),
  };
}

async function reconcileResponses(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  applicationIds: Map<string, string>,
  dependencies: DependencyReferences
): Promise<Counts> {
  const rows = fixtures.flatMap((fixture) =>
    fixture.registrations.flatMap((registration) => {
      const responses = Object.entries(registration.responses ?? {});
      if (responses.length === 0) return [];

      const applicationId = applicationIds.get(
        key(fixture.email, registration.eventSlug)
      );
      if (!applicationId) {
        throw new Error(
          `No application ID found for "${fixture.email}" and "${registration.eventSlug}"`
        );
      }

      return responses.map(([question, response]) => {
        const questionId = dependencies.questionIds.get(
          key(registration.eventSlug, question)
        );
        if (!questionId) {
          throw new Error(
            `No question ID found for "${registration.eventSlug}" and "${question}"`
          );
        }
        return {
          application_id: applicationId,
          event_application_question_id: questionId,
          response,
        };
      });
    })
  );

  if (rows.length === 0) return emptyCounts();
  const applicationIdValues = [...new Set(rows.map((row) => row.application_id))];
  const { data: existing, error: readError } = await supabase
    .from(TABLE.eventApplicationResponses)
    .select("event_application_question_id, application_id")
    .in("application_id", applicationIdValues);
  if (readError) {
    throw new Error(`Reading application responses failed: ${readError.message}`);
  }

  const existingKeys = new Set(
    ((existing ?? []) as {
      event_application_question_id: string;
      application_id: string;
    }[]).map((row) => key(row.event_application_question_id, row.application_id))
  );
  const existingDesiredCount = rows.filter((row) =>
    existingKeys.has(key(row.event_application_question_id, row.application_id))
  ).length;

  const { error } = await supabase.from(TABLE.eventApplicationResponses).upsert(rows, {
    onConflict: "event_application_question_id,application_id",
  });
  if (error) throw new Error(`Upserting application responses failed: ${error.message}`);

  return countsFor(rows.length, existingDesiredCount);
}

async function reconcileCheckIns(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  ticketIds: Map<string, string>,
  dependencies: DependencyReferences
): Promise<Counts> {
  const rows = fixtures.flatMap((fixture) =>
    fixture.registrations.flatMap((registration) => {
      const checkIns = Object.entries(registration.checkIns ?? {});
      if (checkIns.length === 0) return [];

      const ticketId = ticketIds.get(key(fixture.email, registration.eventSlug));
      if (!ticketId) {
        throw new Error(
          `No ticket ID found for "${fixture.email}" and "${registration.eventSlug}"`
        );
      }

      return checkIns.map(([sessionName, checkedInAt]) => {
        const sessionId = dependencies.sessionIds.get(
          key(registration.eventSlug, sessionName)
        );
        if (!sessionId) {
          throw new Error(
            `No session ID found for "${registration.eventSlug}" and "${sessionName}"`
          );
        }
        return {
          check_in_session_id: sessionId,
          checked_in_at: checkedInAt,
          ticket_id: ticketId,
        };
      });
    })
  );

  if (rows.length === 0) return emptyCounts();
  const ticketIdValues = [...new Set(rows.map((row) => row.ticket_id))];
  const { data: existing, error: readError } = await supabase
    .from(TABLE.checkIns)
    .select("check_in_session_id, ticket_id")
    .in("ticket_id", ticketIdValues);
  if (readError) throw new Error(`Reading check-ins failed: ${readError.message}`);

  const existingKeys = new Set(
    ((existing ?? []) as {
      check_in_session_id: string;
      ticket_id: string;
    }[]).map((row) => key(row.check_in_session_id, row.ticket_id))
  );
  const existingDesiredCount = rows.filter((row) =>
    existingKeys.has(key(row.check_in_session_id, row.ticket_id))
  ).length;

  const { error } = await supabase.from(TABLE.checkIns).upsert(rows, {
    onConflict: "ticket_id,check_in_session_id",
  });
  if (error) throw new Error(`Upserting check-ins failed: ${error.message}`);

  return countsFor(rows.length, existingDesiredCount);
}

async function planDryRun(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  dependencies: DependencyReferences,
  state: IdentityState
): Promise<UserSeedSummary> {
  const totals = getUserFixtureTotals(fixtures);
  const summary = emptySummary();
  summary.authUsers = countsFor(totals.authUsers, state.authByEmail.size);
  summary.profiles = countsFor(totals.profiles, state.profileByEmail.size);

  // Only profiles that already exist have an id to prune against. A first run
  // has nothing to prune anyway.
  for (const fixture of fixtures) {
    const profile = state.profileByEmail.get(fixture.email);
    if (profile) summary.profileIds.set(fixture.email, profile.id);
  }

  if (!dependencies.complete) {
    summary.purchases = createdCounts(totals.purchases);
    summary.tickets = createdCounts(totals.tickets);
    summary.applications = createdCounts(totals.applications);
    summary.responses = createdCounts(totals.responses);
    summary.checkIns = createdCounts(totals.checkIns);
    return summary;
  }

  const profileIds = summary.profileIds;

  const purchaseKeys = fixtures.flatMap((fixture) =>
    fixture.purchases.map((purchase) => purchase.idempotencyKey)
  );
  const purchaseResult = await supabase
    .from(TABLE.purchases)
    .select("idempotency_key")
    .in("idempotency_key", purchaseKeys);
  if (purchaseResult.error) {
    throw new Error(`Reading purchases failed: ${purchaseResult.error.message}`);
  }
  summary.purchases = countsFor(
    totals.purchases,
    (purchaseResult.data ?? []).length
  );

  const userIds = [...profileIds.values()];
  const eventIds = [...dependencies.eventIds.values()];
  const [ticketRows, applicationRows] = await Promise.all([
    readFixtureRows(supabase, TABLE.eventTickets, userIds, eventIds),
    readFixtureRows(supabase, TABLE.eventApplications, userIds, eventIds),
  ]);
  const ticketIds = idsByFixtureKey(ticketRows, profileIds, dependencies.eventIds);
  const applicationIds = idsByFixtureKey(
    applicationRows,
    profileIds,
    dependencies.eventIds
  );

  const desired = (has: (registration: SeedRegistration) => boolean) =>
    fixtures.flatMap((fixture) =>
      fixture.registrations
        .filter(has)
        .map((registration) => key(fixture.email, registration.eventSlug))
    );
  summary.tickets = countsFor(
    totals.tickets,
    desired((registration) => registration.ticket).filter((value) => ticketIds.has(value))
      .length
  );
  summary.applications = countsFor(
    totals.applications,
    desired((registration) => Boolean(registration.application)).filter((value) =>
      applicationIds.has(value)
    ).length
  );

  const [responseResult, checkInResult] = await Promise.all([
    applicationIds.size > 0
      ? supabase
          .from(TABLE.eventApplicationResponses)
          .select("event_application_question_id, application_id")
          .in("application_id", [...applicationIds.values()])
      : Promise.resolve({ data: [], error: null }),
    ticketIds.size > 0
      ? supabase
          .from(TABLE.checkIns)
          .select("check_in_session_id, ticket_id")
          .in("ticket_id", [...ticketIds.values()])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (responseResult.error) {
    throw new Error(`Reading application responses failed: ${responseResult.error.message}`);
  }
  if (checkInResult.error) {
    throw new Error(`Reading check-ins failed: ${checkInResult.error.message}`);
  }

  const responseKeys = new Set(
    ((responseResult.data ?? []) as {
      event_application_question_id: string;
      application_id: string;
    }[]).map((row) => key(row.event_application_question_id, row.application_id))
  );
  const checkInKeys = new Set(
    ((checkInResult.data ?? []) as {
      check_in_session_id: string;
      ticket_id: string;
    }[]).map((row) => key(row.check_in_session_id, row.ticket_id))
  );

  let existingResponses = 0;
  let existingCheckIns = 0;
  for (const fixture of fixtures) {
    for (const registration of fixture.registrations) {
      const fixtureKey = key(fixture.email, registration.eventSlug);
      const applicationId = applicationIds.get(fixtureKey);
      const ticketId = ticketIds.get(fixtureKey);

      for (const question of Object.keys(registration.responses ?? {})) {
        const questionId = dependencies.questionIds.get(
          key(registration.eventSlug, question)
        );
        if (questionId && applicationId && responseKeys.has(key(questionId, applicationId))) {
          existingResponses += 1;
        }
      }
      for (const session of Object.keys(registration.checkIns ?? {})) {
        const sessionId = dependencies.sessionIds.get(
          key(registration.eventSlug, session)
        );
        if (sessionId && ticketId && checkInKeys.has(key(sessionId, ticketId))) {
          existingCheckIns += 1;
        }
      }
    }
  }

  summary.responses = countsFor(totals.responses, existingResponses);
  summary.checkIns = countsFor(totals.checkIns, existingCheckIns);
  return summary;
}

export async function reconcileUserFixtures(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  options: UserSeedOptions
): Promise<UserSeedSummary> {
  const [dependencies, identityState] = await Promise.all([
    loadDependencies(supabase, fixtures, options.allowPlannedDependencies),
    inspectIdentityState(supabase, fixtures),
  ]);

  if (options.dryRun) {
    return planDryRun(supabase, fixtures, dependencies, identityState);
  }
  if (!dependencies.complete) {
    throw new Error("User seed dependencies were planned but not written");
  }

  const identity = await reconcileIdentities(
    supabase,
    fixtures,
    dependencies,
    identityState
  );
  await reconcileStudentVerification(supabase, fixtures, identity.profileIds);
  const purchases = await reconcilePurchases(
    supabase,
    fixtures,
    identity.profileIds,
    dependencies
  );
  const tickets = await reconcileTickets(
    supabase,
    fixtures,
    identity.profileIds,
    purchases.purchaseIds,
    dependencies
  );
  const applications = await reconcileApplications(
    supabase,
    fixtures,
    identity.profileIds,
    dependencies
  );
  const responses = await reconcileResponses(
    supabase,
    fixtures,
    applications.applicationIds,
    dependencies
  );
  const checkIns = await reconcileCheckIns(
    supabase,
    fixtures,
    tickets.ticketIds,
    dependencies
  );

  return {
    authUsers: identity.authUsers,
    profiles: identity.profiles,
    purchases: purchases.counts,
    tickets: tickets.counts,
    applications: applications.counts,
    responses,
    checkIns,
    profileIds: identity.profileIds,
  };
}

export interface UserPruneSummary {
  purchases: number;
  tickets: number;
  applications: number;
  legacyRegistrations: number;
  responses: number;
  checkIns: number;
}

function emptyPruneSummary(): UserPruneSummary {
  return {
    purchases: 0,
    tickets: 0,
    applications: 0,
    legacyRegistrations: 0,
    responses: 0,
    checkIns: 0,
  };
}

async function deleteByIds(
  supabase: SupabaseClient,
  table: string,
  ids: string[],
  label: string
) {
  if (ids.length === 0) return;
  const { error } = await supabase.from(table).delete().in("id", ids);
  if (error) throw new Error(`Deleting stale ${label} failed: ${error.message}`);
}

/**
 * Deletes fixture-owned rows the seed data no longer describes.
 *
 * This is what makes a purchase reversible. Buy a ticket as one of the seed
 * accounts and the rows it writes are owned by a fixture profile but absent
 * from `users.ts`, so the next `pnpm seed` removes them and the event is
 * buyable again.
 *
 * Everything here is filtered by `user_id in (fixture profiles)`. A row written
 * by an account somebody created by hand is never a candidate, even when it
 * points at a seed event.
 *
 * Order matters. Tickets and applications go first so their check-ins and
 * responses cascade; purchases follow, because `event_tickets.purchase_id` is
 * `on delete set null` and a surviving ticket would otherwise silently lose its
 * link. Fixture accounts' legacy `event_registrations` all go: the seed no
 * longer writes them.
 */
export async function pruneUserFixtures(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  profileIds: Map<string, string>,
  options: { dryRun: boolean }
): Promise<UserPruneSummary> {
  const summary = emptyPruneSummary();
  const userIds = [...profileIds.values()];
  if (userIds.length === 0) return summary;

  const eventIdBySlug = new Map<string, string>();
  const slugs = [
    ...new Set(
      fixtures.flatMap((fixture) =>
        fixture.registrations.map((registration) => registration.eventSlug)
      )
    ),
  ];
  if (slugs.length > 0) {
    const { data, error } = await supabase
      .from(TABLE.events)
      .select("id, slug")
      .in("slug", slugs);
    if (error) throw new Error(`Reading events failed: ${error.message}`);
    for (const row of (data ?? []) as { id: string; slug: string | null }[]) {
      if (row.slug) eventIdBySlug.set(row.slug, row.id);
    }
  }

  const desiredKeys = (has: (registration: SeedRegistration) => boolean) =>
    new Set(
      fixtures.flatMap((fixture) => {
        const userId = profileIds.get(fixture.email);
        if (!userId) return [];
        return fixture.registrations.filter(has).flatMap((registration) => {
          const eventId = eventIdBySlug.get(registration.eventSlug);
          return eventId ? [pruneKey(userId, eventId)] : [];
        });
      })
    );

  const readOwned = async (table: string) => {
    const { data, error } = await supabase
      .from(table)
      .select("id, event_id, user_id")
      .in("user_id", userIds);
    if (error) throw new Error(`Reading ${table} failed: ${error.message}`);
    return (data ?? []) as EventUserRow[];
  };

  /* ── Tickets, applications, and legacy registrations ── */
  const [ticketRows, applicationRows, legacyRows] = await Promise.all([
    readOwned(TABLE.eventTickets),
    readOwned(TABLE.eventApplications),
    readOwned(TABLE.eventRegistrations),
  ]);
  const ticketPlan = planPrune(
    ticketRows,
    (row) => pruneKey(row.user_id, row.event_id),
    desiredKeys((registration) => registration.ticket)
  );
  const applicationPlan = planPrune(
    applicationRows,
    (row) => pruneKey(row.user_id, row.event_id),
    desiredKeys((registration) => Boolean(registration.application))
  );

  summary.tickets = ticketPlan.remove.length;
  summary.applications = applicationPlan.remove.length;
  summary.legacyRegistrations = legacyRows.length;

  if (!options.dryRun) {
    await deleteByIds(
      supabase,
      TABLE.eventTickets,
      ticketPlan.remove.map((entry) => entry.row.id),
      "event tickets"
    );
    await deleteByIds(
      supabase,
      TABLE.eventApplications,
      applicationPlan.remove.map((entry) => entry.row.id),
      "event applications"
    );
    await deleteByIds(
      supabase,
      TABLE.eventRegistrations,
      legacyRows.map((row) => row.id),
      "event registrations"
    );
  }

  /* ── Purchases ── */
  const desiredPurchaseKeys = new Set(
    fixtures.flatMap((fixture) =>
      fixture.purchases.map((purchase) => purchase.idempotencyKey)
    )
  );

  const { data: purchaseRows, error: purchaseError } = await supabase
    .from(TABLE.purchases)
    .select("id, idempotency_key, user_id")
    .in("user_id", userIds);
  if (purchaseError) {
    throw new Error(`Reading purchases failed: ${purchaseError.message}`);
  }

  const purchasePlan = planPrune(
    (purchaseRows ?? []) as { id: string; idempotency_key: string }[],
    (row) => row.idempotency_key,
    desiredPurchaseKeys
  );

  summary.purchases = purchasePlan.remove.length;

  if (!options.dryRun) {
    await deleteByIds(
      supabase,
      TABLE.purchases,
      purchasePlan.remove.map((entry) => entry.row.id),
      "purchases"
    );
  }

  /* ── Responses and check-ins on the applications and tickets we kept ── */
  const emailByUserId = new Map(
    [...profileIds.entries()].map(([email, id]) => [id, email])
  );
  const slugByEventId = new Map(
    [...eventIdBySlug.entries()].map(([slug, id]) => [id, slug])
  );
  const fixtureKeyOf = (row: EventUserRow) => {
    const email = emailByUserId.get(row.user_id);
    const slug = slugByEventId.get(row.event_id);
    return email && slug ? key(email, slug) : null;
  };

  const desiredResponses = new Set<string>();
  const desiredCheckIns = new Set<string>();
  const keptApplicationIds = new Map(
    applicationPlan.keep.flatMap((row) => {
      const fixtureKey = fixtureKeyOf(row);
      return fixtureKey ? [[fixtureKey, row.id] as const] : [];
    })
  );
  const keptTicketIds = new Map(
    ticketPlan.keep.flatMap((row) => {
      const fixtureKey = fixtureKeyOf(row);
      return fixtureKey ? [[fixtureKey, row.id] as const] : [];
    })
  );
  for (const fixture of fixtures) {
    for (const registration of fixture.registrations) {
      const fixtureKey = key(fixture.email, registration.eventSlug);
      const applicationId = keptApplicationIds.get(fixtureKey);
      const ticketId = keptTicketIds.get(fixtureKey);

      for (const question of Object.keys(registration.responses ?? {})) {
        if (applicationId) desiredResponses.add(pruneKey(applicationId, question));
      }
      for (const session of Object.keys(registration.checkIns ?? {})) {
        if (ticketId) desiredCheckIns.add(pruneKey(ticketId, session));
      }
    }
  }

  const applicationIds = applicationPlan.keep.map((row) => row.id);
  const ticketIds = ticketPlan.keep.map((row) => row.id);
  const [responseResult, checkInResult] = await Promise.all([
    applicationIds.length > 0
      ? supabase
          .from(TABLE.eventApplicationResponses)
          .select("id, application_id, event_application_questions(question)")
          .in("application_id", applicationIds)
      : Promise.resolve({ data: [], error: null }),
    ticketIds.length > 0
      ? supabase
          .from(TABLE.checkIns)
          .select("id, ticket_id, check_in_sessions(name)")
          .in("ticket_id", ticketIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (responseResult.error) {
    throw new Error(`Reading application responses failed: ${responseResult.error.message}`);
  }
  if (checkInResult.error) {
    throw new Error(`Reading check-ins failed: ${checkInResult.error.message}`);
  }

  // Embedded selects come back typed as unknown to PostgREST's parser; the
  // shapes are asserted here rather than inferred.
  const responseRows = (responseResult.data ?? []) as unknown as {
    id: string;
    application_id: string;
    event_application_questions: { question: string } | null;
  }[];
  const checkInRows = (checkInResult.data ?? []) as unknown as {
    id: string;
    ticket_id: string;
    check_in_sessions: { name: string } | null;
  }[];

  const responsePlan = planPrune(
    responseRows,
    (row) =>
      row.event_application_questions
        ? pruneKey(row.application_id, row.event_application_questions.question)
        : null,
    desiredResponses
  );
  const checkInPlan = planPrune(
    checkInRows,
    (row) =>
      row.check_in_sessions
        ? pruneKey(row.ticket_id, row.check_in_sessions.name)
        : null,
    desiredCheckIns
  );

  summary.responses = responsePlan.remove.length;
  summary.checkIns = checkInPlan.remove.length;

  if (options.dryRun) return summary;

  await deleteByIds(
    supabase,
    TABLE.eventApplicationResponses,
    responsePlan.remove.map((entry) => entry.row.id),
    "application responses"
  );
  await deleteByIds(
    supabase,
    TABLE.checkIns,
    checkInPlan.remove.map((entry) => entry.row.id),
    "check-ins"
  );

  return summary;
}

/**
 * Hard-deletes fixture accounts the seed used to create under another address.
 *
 * Runs before the reconcile, not with the rest of the prune, because a renamed
 * fixture's old account still owns purchases under the same idempotency keys
 * the new one is about to write — and `reconcilePurchases` refuses to move a
 * key between users. Leaving them would fail the run, not just leave clutter.
 *
 * Deletion order follows the foreign keys, all of which are `no action` rather
 * than cascade: tickets, applications and legacy registrations (as attendee and
 * as reviewer) must go before the profile, and the profile before the auth
 * user, whose `auth_user_id` reference would otherwise hold it. Purchases
 * cascade off the profile on their own.
 *
 * This is not `delete_account`: that anonymizes and keeps the row so real
 * receipts keep a referent. These are fixtures, and they should leave nothing.
 */
export async function removeRetiredFixtures(
  supabase: SupabaseClient,
  emails: readonly string[],
  options: { dryRun: boolean }
): Promise<number> {
  if (emails.length === 0) return 0;

  const addresses = emails.map((email) => email.trim().toLowerCase());
  const { data, error } = await supabase
    .from(TABLE.userInfo)
    .select("id, email, auth_user_id")
    .in("email", addresses);
  if (error) {
    throw new Error(`Reading retired fixture profiles failed: ${error.message}`);
  }

  const profiles = (data ?? []) as ProfileRow[];

  // The auth user can outlive its profile if a previous run was interrupted, so
  // look those up independently rather than only through the profiles.
  const authUsers = await listAllAuthUsers(supabase);
  const retiredAuth = authUsers.filter((user) => {
    const email = user.email?.trim().toLowerCase();
    return email ? addresses.includes(email) : false;
  });

  if (profiles.length === 0 && retiredAuth.length === 0) return 0;
  if (options.dryRun) {
    return new Set([
      ...profiles.map((profile) => profile.email.trim().toLowerCase()),
      ...retiredAuth.map((user) => user.email?.trim().toLowerCase() ?? ""),
    ]).size;
  }

  const profileIds = profiles.map((profile) => profile.id);

  if (profileIds.length > 0) {
    for (const [table, column] of [
      [TABLE.eventTickets, "user_id"],
      [TABLE.eventApplications, "user_id"],
      [TABLE.eventRegistrations, "user_id"],
      [TABLE.eventRegistrations, "reviewer_id"],
    ] as const) {
      const { error: registrationError } = await supabase
        .from(table)
        .delete()
        .in(column, profileIds);
      if (registrationError) {
        throw new Error(
          `Deleting retired fixture ${table} failed: ${registrationError.message}`
        );
      }
    }

    // `app_settings.updated_by` records who last moved the membership term
    // date. It is attribution, not data anyone depends on, and the reference is
    // `no action`, so it has to be released before the profile can go.
    const { error: settingsError } = await supabase
      .from(TABLE.appSettings)
      .update({ updated_by: null })
      .in("updated_by", profileIds);
    if (settingsError) {
      throw new Error(
        `Clearing retired fixture settings attribution failed: ${settingsError.message}`
      );
    }

    const { error: profileError } = await supabase
      .from(TABLE.userInfo)
      .delete()
      .in("id", profileIds);
    if (profileError) {
      // A new table referencing `user_info` without a cascade lands here. The
      // fix is to release the reference above, the way app_settings does.
      throw new Error(
        `Deleting retired fixture profiles failed: ${profileError.message}\n` +
          "  A table still references them. Release it in removeRetiredFixtures."
      );
    }
  }

  for (const user of retiredAuth) {
    const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
    if (authError) {
      throw new Error(
        `Deleting retired fixture Auth user "${user.email}" failed: ${authError.message}`
      );
    }
  }

  return new Set([
    ...profiles.map((profile) => profile.email.trim().toLowerCase()),
    ...retiredAuth.map((user) => user.email?.trim().toLowerCase() ?? ""),
  ]).size;
}
