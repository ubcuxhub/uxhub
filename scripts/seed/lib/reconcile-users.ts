import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { SeedUser } from "../data/users.ts";
import { emptyCounts, type Counts } from "./reconcile.ts";
import { planPrune, pruneKey } from "./prune.ts";
import { getUserFixtureTotals } from "./user-fixtures.ts";

const TABLE = {
  checkInSessions: "check_in_sessions",
  checkIns: "check_ins",
  eventApplicationQuestions: "event_application_questions",
  eventApplicationResponses: "event_application_responses",
  eventRegistrations: "event_registrations",
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
  registrations: Counts;
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
    registrations: emptyCounts(),
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
      user_metadata: { full_name: fixture.profile.name, seed_managed: true },
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

async function reconcileRegistrations(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  profileIds: Map<string, string>,
  purchaseIds: Map<string, string>,
  dependencies: DependencyReferences
): Promise<{ counts: Counts; registrationIds: Map<string, string> }> {
  const userIds = [...profileIds.values()];
  const eventIds = [...dependencies.eventIds.values()];
  const { data: existing, error: readError } = await supabase
    .from(TABLE.eventRegistrations)
    .select("id, event_id, user_id")
    .in("user_id", userIds)
    .in("event_id", eventIds);
  if (readError) {
    throw new Error(`Reading event registrations failed: ${readError.message}`);
  }

  const existingKeys = new Set(
    ((existing ?? []) as { event_id: string; user_id: string }[]).map((row) =>
      key(row.user_id, row.event_id)
    )
  );
  const rows = fixtures.flatMap((fixture) => {
    const userId = profileIds.get(fixture.email);
    if (!userId) throw new Error(`No profile ID found for "${fixture.email}"`);

    return fixture.registrations.map((registration) => {
      const eventId = dependencies.eventIds.get(registration.eventSlug);
      if (!eventId) throw new Error(`No event ID found for "${registration.eventSlug}"`);

      const purchaseId = registration.purchaseKey
        ? purchaseIds.get(registration.purchaseKey)
        : null;
      if (registration.purchaseKey && !purchaseId) {
        throw new Error(`No purchase ID found for "${registration.purchaseKey}"`);
      }

      const reviewerId = registration.reviewerEmail
        ? profileIds.get(registration.reviewerEmail)
        : null;
      if (registration.reviewerEmail && !reviewerId) {
        throw new Error(`No reviewer profile found for "${registration.reviewerEmail}"`);
      }

      return {
        attending: registration.attending,
        event_id: eventId,
        purchase_id: purchaseId,
        reviewer_id: reviewerId,
        status: registration.status,
        user_id: userId,
      };
    });
  });

  const { data, error } = await supabase
    .from(TABLE.eventRegistrations)
    .upsert(rows, { onConflict: "event_id,user_id" })
    .select("id, event_id, user_id");
  if (error) throw new Error(`Upserting event registrations failed: ${error.message}`);

  const eventSlugById = new Map(
    [...dependencies.eventIds.entries()].map(([slug, id]) => [id, slug])
  );
  const emailByProfileId = new Map(
    [...profileIds.entries()].map(([email, id]) => [id, email])
  );
  const registrationIds = new Map<string, string>();
  for (const row of (data ?? []) as { event_id: string; id: string; user_id: string }[]) {
    const email = emailByProfileId.get(row.user_id);
    const eventSlug = eventSlugById.get(row.event_id);
    if (email && eventSlug) registrationIds.set(key(email, eventSlug), row.id);
  }

  return {
    counts: countsFor(rows.length, existingKeys.size),
    registrationIds,
  };
}

async function reconcileResponses(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  registrationIds: Map<string, string>,
  dependencies: DependencyReferences
): Promise<Counts> {
  const rows = fixtures.flatMap((fixture) =>
    fixture.registrations.flatMap((registration) => {
      const registrationId = registrationIds.get(
        key(fixture.email, registration.eventSlug)
      );
      if (!registrationId) {
        throw new Error(
          `No registration ID found for "${fixture.email}" and "${registration.eventSlug}"`
        );
      }

      return Object.entries(registration.responses ?? {}).map(
        ([question, response]) => {
          const questionId = dependencies.questionIds.get(
            key(registration.eventSlug, question)
          );
          if (!questionId) {
            throw new Error(
              `No question ID found for "${registration.eventSlug}" and "${question}"`
            );
          }
          return {
            event_application_question_id: questionId,
            event_registration_id: registrationId,
            response,
          };
        }
      );
    })
  );

  if (rows.length === 0) return emptyCounts();
  const registrationIdValues = [...new Set(rows.map((row) => row.event_registration_id))];
  const { data: existing, error: readError } = await supabase
    .from(TABLE.eventApplicationResponses)
    .select("event_application_question_id, event_registration_id")
    .in("event_registration_id", registrationIdValues);
  if (readError) {
    throw new Error(`Reading application responses failed: ${readError.message}`);
  }

  const existingKeys = new Set(
    ((existing ?? []) as {
      event_application_question_id: string;
      event_registration_id: string;
    }[]).map((row) =>
      key(row.event_application_question_id, row.event_registration_id)
    )
  );
  const existingDesiredCount = rows.filter((row) =>
    existingKeys.has(
      key(row.event_application_question_id, row.event_registration_id)
    )
  ).length;

  const { error } = await supabase.from(TABLE.eventApplicationResponses).upsert(rows, {
    onConflict: "event_application_question_id,event_registration_id",
  });
  if (error) throw new Error(`Upserting application responses failed: ${error.message}`);

  return countsFor(rows.length, existingDesiredCount);
}

async function reconcileCheckIns(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  registrationIds: Map<string, string>,
  dependencies: DependencyReferences
): Promise<Counts> {
  const rows = fixtures.flatMap((fixture) =>
    fixture.registrations.flatMap((registration) => {
      const registrationId = registrationIds.get(
        key(fixture.email, registration.eventSlug)
      );
      if (!registrationId) {
        throw new Error(
          `No registration ID found for "${fixture.email}" and "${registration.eventSlug}"`
        );
      }

      return Object.entries(registration.checkIns ?? {}).map(
        ([sessionName, checkedInAt]) => {
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
            event_registration_id: registrationId,
          };
        }
      );
    })
  );

  if (rows.length === 0) return emptyCounts();
  const registrationIdValues = [...new Set(rows.map((row) => row.event_registration_id))];
  const { data: existing, error: readError } = await supabase
    .from(TABLE.checkIns)
    .select("check_in_session_id, event_registration_id")
    .in("event_registration_id", registrationIdValues);
  if (readError) throw new Error(`Reading check-ins failed: ${readError.message}`);

  const existingKeys = new Set(
    ((existing ?? []) as {
      check_in_session_id: string;
      event_registration_id: string;
    }[]).map((row) => key(row.check_in_session_id, row.event_registration_id))
  );
  const existingDesiredCount = rows.filter((row) =>
    existingKeys.has(key(row.check_in_session_id, row.event_registration_id))
  ).length;

  const { error } = await supabase.from(TABLE.checkIns).upsert(rows, {
    onConflict: "event_registration_id,check_in_session_id",
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
    summary.registrations = createdCounts(totals.registrations);
    summary.responses = createdCounts(totals.responses);
    summary.checkIns = createdCounts(totals.checkIns);
    return summary;
  }

  const profileIds = new Map<string, string>();
  for (const fixture of fixtures) {
    const profile = state.profileByEmail.get(fixture.email);
    if (profile) profileIds.set(fixture.email, profile.id);
  }

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

  const existingRegistrationByKey = new Map<string, string>();
  if (profileIds.size > 0) {
    const registrationResult = await supabase
      .from(TABLE.eventRegistrations)
      .select("id, event_id, user_id")
      .in("user_id", [...profileIds.values()])
      .in("event_id", [...dependencies.eventIds.values()]);
    if (registrationResult.error) {
      throw new Error(
        `Reading event registrations failed: ${registrationResult.error.message}`
      );
    }
    const emailByProfileId = new Map(
      [...profileIds.entries()].map(([email, id]) => [id, email])
    );
    const eventSlugById = new Map(
      [...dependencies.eventIds.entries()].map(([slug, id]) => [id, slug])
    );
    for (const row of (registrationResult.data ?? []) as {
      event_id: string;
      id: string;
      user_id: string;
    }[]) {
      const email = emailByProfileId.get(row.user_id);
      const eventSlug = eventSlugById.get(row.event_id);
      if (email && eventSlug) {
        existingRegistrationByKey.set(key(email, eventSlug), row.id);
      }
    }
  }

  const desiredRegistrationKeys = fixtures.flatMap((fixture) =>
    fixture.registrations.map((registration) =>
      key(fixture.email, registration.eventSlug)
    )
  );
  const existingRegistrationCount = desiredRegistrationKeys.filter((value) =>
    existingRegistrationByKey.has(value)
  ).length;
  summary.registrations = countsFor(
    totals.registrations,
    existingRegistrationCount
  );

  const existingRegistrationIds = [...existingRegistrationByKey.values()];
  if (existingRegistrationIds.length === 0) {
    summary.responses = createdCounts(totals.responses);
    summary.checkIns = createdCounts(totals.checkIns);
    return summary;
  }

  const [responseResult, checkInResult] = await Promise.all([
    supabase
      .from(TABLE.eventApplicationResponses)
      .select("event_application_question_id, event_registration_id")
      .in("event_registration_id", existingRegistrationIds),
    supabase
      .from(TABLE.checkIns)
      .select("check_in_session_id, event_registration_id")
      .in("event_registration_id", existingRegistrationIds),
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
      event_registration_id: string;
    }[]).map((row) =>
      key(row.event_application_question_id, row.event_registration_id)
    )
  );
  const checkInKeys = new Set(
    ((checkInResult.data ?? []) as {
      check_in_session_id: string;
      event_registration_id: string;
    }[]).map((row) => key(row.check_in_session_id, row.event_registration_id))
  );

  let existingResponses = 0;
  let existingCheckIns = 0;
  for (const fixture of fixtures) {
    for (const registration of fixture.registrations) {
      const registrationId = existingRegistrationByKey.get(
        key(fixture.email, registration.eventSlug)
      );
      if (!registrationId) continue;

      for (const question of Object.keys(registration.responses ?? {})) {
        const questionId = dependencies.questionIds.get(
          key(registration.eventSlug, question)
        );
        if (questionId && responseKeys.has(key(questionId, registrationId))) {
          existingResponses += 1;
        }
      }
      for (const session of Object.keys(registration.checkIns ?? {})) {
        const sessionId = dependencies.sessionIds.get(
          key(registration.eventSlug, session)
        );
        if (sessionId && checkInKeys.has(key(sessionId, registrationId))) {
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
  const purchases = await reconcilePurchases(
    supabase,
    fixtures,
    identity.profileIds,
    dependencies
  );
  const registrations = await reconcileRegistrations(
    supabase,
    fixtures,
    identity.profileIds,
    purchases.purchaseIds,
    dependencies
  );
  const responses = await reconcileResponses(
    supabase,
    fixtures,
    registrations.registrationIds,
    dependencies
  );
  const checkIns = await reconcileCheckIns(
    supabase,
    fixtures,
    registrations.registrationIds,
    dependencies
  );

  return {
    authUsers: identity.authUsers,
    profiles: identity.profiles,
    purchases: purchases.counts,
    registrations: registrations.counts,
    responses,
    checkIns,
    profileIds: identity.profileIds,
  };
}

export interface UserPruneSummary {
  purchases: number;
  registrations: number;
  responses: number;
  checkIns: number;
}

function emptyPruneSummary(): UserPruneSummary {
  return { purchases: 0, registrations: 0, responses: 0, checkIns: 0 };
}

/**
 * Deletes fixture-owned rows the seed data no longer describes.
 *
 * This is what makes a purchase reversible. Buy a ticket as one of the seed
 * accounts and the row it writes is owned by a fixture profile but absent from
 * `users.ts`, so the next `pnpm seed` removes it and the event is buyable
 * again.
 *
 * Everything here is filtered by `user_id in (fixture profiles)`. A row written
 * by an account somebody created by hand is never a candidate, even when it
 * points at a seed event.
 *
 * Order matters. Registrations go first so their responses and check-ins
 * cascade; purchases follow, because `event_registrations.purchase_id` is
 * `on delete set null` and a surviving registration would otherwise silently
 * lose its link.
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
  const eventSlugById = new Map<string, string>();
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
      if (!row.slug) continue;
      eventIdBySlug.set(row.slug, row.id);
      eventSlugById.set(row.id, row.slug);
    }
  }

  /* ── Registrations ── */
  const desiredRegistrations = new Set(
    fixtures.flatMap((fixture) => {
      const userId = profileIds.get(fixture.email);
      if (!userId) return [];
      return fixture.registrations.flatMap((registration) => {
        const eventId = eventIdBySlug.get(registration.eventSlug);
        return eventId ? [pruneKey(userId, eventId)] : [];
      });
    })
  );

  const { data: registrationRows, error: registrationError } = await supabase
    .from(TABLE.eventRegistrations)
    .select("id, event_id, user_id")
    .in("user_id", userIds);
  if (registrationError) {
    throw new Error(`Reading event registrations failed: ${registrationError.message}`);
  }

  const registrations = (registrationRows ?? []) as {
    event_id: string;
    id: string;
    user_id: string;
  }[];
  const registrationPlan = planPrune(
    registrations,
    (row) => pruneKey(row.user_id, row.event_id),
    desiredRegistrations
  );

  summary.registrations = registrationPlan.remove.length;

  if (!options.dryRun && registrationPlan.remove.length > 0) {
    const { error } = await supabase
      .from(TABLE.eventRegistrations)
      .delete()
      .in(
        "id",
        registrationPlan.remove.map((entry) => entry.row.id)
      );
    if (error) {
      throw new Error(`Deleting stale event registrations failed: ${error.message}`);
    }
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

  if (!options.dryRun && purchasePlan.remove.length > 0) {
    const { error } = await supabase
      .from(TABLE.purchases)
      .delete()
      .in(
        "id",
        purchasePlan.remove.map((entry) => entry.row.id)
      );
    if (error) {
      throw new Error(`Deleting stale purchases failed: ${error.message}`);
    }
  }

  /* ── Responses and check-ins on registrations we kept ── */
  const keptRegistrationIdByKey = new Map<string, string>();
  for (const row of registrationPlan.keep) {
    const slug = eventSlugById.get(row.event_id);
    if (slug) keptRegistrationIdByKey.set(pruneKey(row.user_id, slug), row.id);
  }
  const keptIds = [...keptRegistrationIdByKey.values()];
  if (keptIds.length === 0) return summary;

  const desiredResponses = new Set<string>();
  const desiredCheckIns = new Set<string>();
  for (const fixture of fixtures) {
    const userId = profileIds.get(fixture.email);
    if (!userId) continue;

    for (const registration of fixture.registrations) {
      const registrationId = keptRegistrationIdByKey.get(
        pruneKey(userId, registration.eventSlug)
      );
      if (!registrationId) continue;

      for (const question of Object.keys(registration.responses ?? {})) {
        desiredResponses.add(pruneKey(registrationId, question));
      }
      for (const session of Object.keys(registration.checkIns ?? {})) {
        desiredCheckIns.add(pruneKey(registrationId, session));
      }
    }
  }

  const [responseResult, checkInResult] = await Promise.all([
    supabase
      .from(TABLE.eventApplicationResponses)
      .select(
        "id, event_registration_id, event_application_questions(question)"
      )
      .in("event_registration_id", keptIds),
    supabase
      .from(TABLE.checkIns)
      .select("id, event_registration_id, check_in_sessions(name)")
      .in("event_registration_id", keptIds),
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
    event_registration_id: string;
    event_application_questions: { question: string } | null;
  }[];
  const checkInRows = (checkInResult.data ?? []) as unknown as {
    id: string;
    event_registration_id: string;
    check_in_sessions: { name: string } | null;
  }[];

  const responsePlan = planPrune(
    responseRows,
    (row) =>
      row.event_application_questions
        ? pruneKey(row.event_registration_id, row.event_application_questions.question)
        : null,
    desiredResponses
  );
  const checkInPlan = planPrune(
    checkInRows,
    (row) =>
      row.check_in_sessions
        ? pruneKey(row.event_registration_id, row.check_in_sessions.name)
        : null,
    desiredCheckIns
  );

  summary.responses = responsePlan.remove.length;
  summary.checkIns = checkInPlan.remove.length;

  if (options.dryRun) return summary;

  if (responsePlan.remove.length > 0) {
    const { error } = await supabase
      .from(TABLE.eventApplicationResponses)
      .delete()
      .in(
        "id",
        responsePlan.remove.map((entry) => entry.row.id)
      );
    if (error) {
      throw new Error(`Deleting stale application responses failed: ${error.message}`);
    }
  }

  if (checkInPlan.remove.length > 0) {
    const { error } = await supabase
      .from(TABLE.checkIns)
      .delete()
      .in(
        "id",
        checkInPlan.remove.map((entry) => entry.row.id)
      );
    if (error) {
      throw new Error(`Deleting stale check-ins failed: ${error.message}`);
    }
  }

  return summary;
}
