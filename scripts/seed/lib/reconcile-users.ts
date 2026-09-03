import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { SeedUser } from "../data/users.ts";
import { emptyCounts, type Counts } from "./reconcile.ts";
import { getUserFixtureTotals } from "./user-fixtures.ts";

const TABLE = {
  checkInSessions: "check_in_sessions",
  checkIns: "check_ins",
  eventApplicationQuestions: "event_application_questions",
  eventApplicationResponses: "event_application_responses",
  eventApplications: "event_applications",
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
  applications: Counts;
  authUsers: Counts;
  checkIns: Counts;
  profiles: Counts;
  purchases: Counts;
  registrations: Counts;
  responses: Counts;
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
    applications: emptyCounts(),
    authUsers: emptyCounts(),
    checkIns: emptyCounts(),
    profiles: emptyCounts(),
    purchases: emptyCounts(),
    registrations: emptyCounts(),
    responses: emptyCounts(),
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
        ...fixture.applications.map((application) => application.eventSlug),
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
    for (const application of fixture.applications) {
      for (const question of Object.keys(application.responses)) {
        if (!questionIds.has(key(application.eventSlug, question))) {
          missingChildren.push(`question:${application.eventSlug}:${question}`);
        }
      }
    }
    for (const registration of fixture.registrations) {
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

async function reconcileApplications(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  profileIds: Map<string, string>,
  dependencies: DependencyReferences
): Promise<{ applicationIds: Map<string, string>; counts: Counts }> {
  const userIds = [...profileIds.values()];
  const eventIds = [...dependencies.eventIds.values()];
  const { data: existing, error: readError } = await supabase
    .from(TABLE.eventApplications)
    .select("id, event_id, user_id")
    .in("user_id", userIds)
    .in("event_id", eventIds);
  if (readError) {
    throw new Error(`Reading event applications failed: ${readError.message}`);
  }

  const existingKeys = new Set(
    ((existing ?? []) as { event_id: string; user_id: string }[]).map((row) =>
      key(row.user_id, row.event_id)
    )
  );
  const now = new Date().toISOString();
  const rows = fixtures.flatMap((fixture) => {
    const userId = profileIds.get(fixture.email);
    if (!userId) throw new Error(`No profile ID found for "${fixture.email}"`);

    return fixture.applications.map((application) => {
      const eventId = dependencies.eventIds.get(application.eventSlug);
      if (!eventId) {
        throw new Error(`No event ID found for "${application.eventSlug}"`);
      }

      const reviewerId = application.reviewerEmail
        ? profileIds.get(application.reviewerEmail)
        : null;
      if (application.reviewerEmail && !reviewerId) {
        throw new Error(
          `No reviewer profile found for "${application.reviewerEmail}"`
        );
      }

      const reviewed = application.status !== "pending";
      return {
        attendance_status: application.attendanceStatus ?? null,
        event_id: eventId,
        reviewed_at: reviewed ? now : null,
        reviewer_id: reviewerId,
        status: application.status,
        submitted_at: now,
        user_id: userId,
      };
    });
  });

  const { data, error } = await supabase
    .from(TABLE.eventApplications)
    .upsert(rows, { onConflict: "event_id,user_id" })
    .select("id, event_id, user_id");
  if (error) {
    throw new Error(`Upserting event applications failed: ${error.message}`);
  }

  const eventSlugById = new Map(
    [...dependencies.eventIds.entries()].map(([slug, id]) => [id, slug])
  );
  const emailByProfileId = new Map(
    [...profileIds.entries()].map(([email, id]) => [id, email])
  );
  const applicationIds = new Map<string, string>();
  for (const row of (data ?? []) as { event_id: string; id: string; user_id: string }[]) {
    const email = emailByProfileId.get(row.user_id);
    const eventSlug = eventSlugById.get(row.event_id);
    if (email && eventSlug) applicationIds.set(key(email, eventSlug), row.id);
  }

  return {
    applicationIds,
    counts: countsFor(rows.length, existingKeys.size),
  };
}

async function reconcileRegistrations(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  profileIds: Map<string, string>,
  purchaseIds: Map<string, string>,
  applicationIds: Map<string, string>,
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

      return {
        application_id:
          applicationIds.get(key(fixture.email, registration.eventSlug)) ?? null,
        event_id: eventId,
        purchase_id: purchaseId,
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
  applicationIds: Map<string, string>,
  dependencies: DependencyReferences
): Promise<Counts> {
  const rows = fixtures.flatMap((fixture) =>
    fixture.applications.flatMap((application) => {
      const applicationId = applicationIds.get(
        key(fixture.email, application.eventSlug)
      );
      if (!applicationId) {
        throw new Error(
          `No application ID found for "${fixture.email}" and "${application.eventSlug}"`
        );
      }

      return Object.entries(application.responses).map(([question, response]) => {
        const questionId = dependencies.questionIds.get(
          key(application.eventSlug, question)
        );
        if (!questionId) {
          throw new Error(
            `No question ID found for "${application.eventSlug}" and "${question}"`
          );
        }
        return {
          event_application_id: applicationId,
          event_application_question_id: questionId,
          response,
        };
      });
    })
  );

  if (rows.length === 0) return emptyCounts();
  const applicationIdValues = [...new Set(rows.map((row) => row.event_application_id))];
  const { data: existing, error: readError } = await supabase
    .from(TABLE.eventApplicationResponses)
    .select("event_application_question_id, event_application_id")
    .in("event_application_id", applicationIdValues);
  if (readError) {
    throw new Error(`Reading application responses failed: ${readError.message}`);
  }

  const existingKeys = new Set(
    ((existing ?? []) as {
      event_application_id: string;
      event_application_question_id: string;
    }[]).map((row) =>
      key(row.event_application_question_id, row.event_application_id)
    )
  );
  const existingDesiredCount = rows.filter((row) =>
    existingKeys.has(
      key(row.event_application_question_id, row.event_application_id)
    )
  ).length;

  const { error } = await supabase.from(TABLE.eventApplicationResponses).upsert(rows, {
    onConflict: "event_application_question_id,event_application_id",
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

  if (!dependencies.complete) {
    summary.purchases = createdCounts(totals.purchases);
    summary.applications = createdCounts(totals.applications);
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

  const existingApplicationByKey = new Map<string, string>();
  const existingRegistrationByKey = new Map<string, string>();
  if (profileIds.size > 0) {
    const [applicationResult, registrationResult] = await Promise.all([
      supabase
        .from(TABLE.eventApplications)
        .select("id, event_id, user_id")
        .in("user_id", [...profileIds.values()])
        .in("event_id", [...dependencies.eventIds.values()]),
      supabase
        .from(TABLE.eventRegistrations)
        .select("id, event_id, user_id")
        .in("user_id", [...profileIds.values()])
        .in("event_id", [...dependencies.eventIds.values()]),
    ]);
    if (applicationResult.error) {
      throw new Error(
        `Reading event applications failed: ${applicationResult.error.message}`
      );
    }
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
    for (const row of (applicationResult.data ?? []) as {
      event_id: string;
      id: string;
      user_id: string;
    }[]) {
      const email = emailByProfileId.get(row.user_id);
      const eventSlug = eventSlugById.get(row.event_id);
      if (email && eventSlug) {
        existingApplicationByKey.set(key(email, eventSlug), row.id);
      }
    }
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

  const desiredApplicationKeys = fixtures.flatMap((fixture) =>
    fixture.applications.map((application) =>
      key(fixture.email, application.eventSlug)
    )
  );
  const desiredRegistrationKeys = fixtures.flatMap((fixture) =>
    fixture.registrations.map((registration) =>
      key(fixture.email, registration.eventSlug)
    )
  );
  summary.applications = countsFor(
    totals.applications,
    desiredApplicationKeys.filter((value) => existingApplicationByKey.has(value))
      .length
  );
  summary.registrations = countsFor(
    totals.registrations,
    desiredRegistrationKeys.filter((value) =>
      existingRegistrationByKey.has(value)
    ).length
  );

  const existingApplicationIds = [...existingApplicationByKey.values()];
  const existingRegistrationIds = [...existingRegistrationByKey.values()];
  if (existingApplicationIds.length === 0 && existingRegistrationIds.length === 0) {
    summary.responses = createdCounts(totals.responses);
    summary.checkIns = createdCounts(totals.checkIns);
    return summary;
  }

  const [responseResult, checkInResult] = await Promise.all([
    existingApplicationIds.length > 0
      ? supabase
          .from(TABLE.eventApplicationResponses)
          .select("event_application_question_id, event_application_id")
          .in("event_application_id", existingApplicationIds)
      : Promise.resolve({ data: [], error: null }),
    existingRegistrationIds.length > 0
      ? supabase
          .from(TABLE.checkIns)
          .select("check_in_session_id, event_registration_id")
          .in("event_registration_id", existingRegistrationIds)
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
      event_application_id: string;
      event_application_question_id: string;
    }[]).map((row) =>
      key(row.event_application_question_id, row.event_application_id)
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
    for (const application of fixture.applications) {
      const applicationId = existingApplicationByKey.get(
        key(fixture.email, application.eventSlug)
      );
      if (!applicationId) continue;

      for (const question of Object.keys(application.responses)) {
        const questionId = dependencies.questionIds.get(
          key(application.eventSlug, question)
        );
        if (questionId && responseKeys.has(key(questionId, applicationId))) {
          existingResponses += 1;
        }
      }
    }
    for (const registration of fixture.registrations) {
      const registrationId = existingRegistrationByKey.get(
        key(fixture.email, registration.eventSlug)
      );
      if (!registrationId) continue;

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
  const applications = await reconcileApplications(
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
    applications.applicationIds,
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
    registrations.registrationIds,
    dependencies
  );

  return {
    applications: applications.counts,
    authUsers: identity.authUsers,
    checkIns,
    profiles: identity.profiles,
    purchases: purchases.counts,
    registrations: registrations.counts,
    responses,
  };
}
