import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { SeedRegistration, SeedUser } from "../data/users.ts";
import { CROWD_EMAIL_DOMAINS } from "../data/crowd.ts";
import { emptyCounts, type Counts } from "./reconcile.ts";
import { planPrune, pruneKey } from "./prune.ts";
import { minimalPdf } from "./pdf.ts";
import { releaseReviewNotesBy } from "./review-notes.ts";
import { answeredQuestions, getUserFixtureTotals } from "./user-fixtures.ts";

/** Mirrors BUCKETS.applicationFiles in src/lib/supabase-helpers/buckets.ts. */
const APPLICATION_FILES_BUCKET = "application-files";

/**
 * How many values one `.in()` filter carries. The filter travels in the URL,
 * and a hundred idempotency keys would crowd the gateway's request-line limit.
 */
const IN_CHUNK = 40;

function chunk<T>(values: readonly T[], size = IN_CHUNK): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < values.length; start += size) {
    chunks.push(values.slice(start, start + size));
  }
  return chunks;
}

/** `select ... where column in (values)`, a chunk at a time. */
async function selectIn<Row>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  column: string,
  values: readonly string[],
  label = table
): Promise<Row[]> {
  const rows: Row[] = [];
  for (const part of chunk([...new Set(values)])) {
    const { data, error } = await supabase.from(table).select(columns).in(column, part);
    if (error) throw new Error(`Reading ${label} failed: ${error.message}`);
    rows.push(...((data ?? []) as unknown as Row[]));
  }
  return rows;
}

function isLogin(fixture: SeedUser): boolean {
  return fixture.password !== null;
}

const TABLE = {
  appSettings: "app_settings",
  checkInSessions: "check_in_sessions",
  checkIns: "check_ins",
  eventApplicationQuestions: "event_application_questions",
  eventApplicationResponses: "event_application_responses",
  eventApplications: "event_applications",
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
  /** PDFs in `application-files` behind file answers. */
  files: Counts;
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
    files: emptyCounts(),
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
  const loginEmails = fixtures.filter(isLogin).map((fixture) => fixture.email);
  const authByEmail = new Map<string, User>();

  for (const authUser of authUsers) {
    const email = authUser.email?.trim().toLowerCase();
    if (email && loginEmails.includes(email)) authByEmail.set(email, authUser);
  }

  const authIds = [...authByEmail.values()].map((user) => user.id);
  const byEmailRows = await selectIn<ProfileRow>(
    supabase,
    TABLE.userInfo,
    "id, email, auth_user_id",
    "email",
    fixtureEmails,
    "user profiles"
  );

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
  for (const profile of [...byEmailRows, ...byAuthRows]) {
    profileByEmail.set(profile.email.trim().toLowerCase(), profile);
    if (profile.auth_user_id) profileByAuthId.set(profile.auth_user_id, profile);
  }

  for (const fixture of fixtures) {
    if (!isLogin(fixture)) {
      // Somebody signed up with a crowd address and `ensureUserInfo` adopted
      // the row: it is a person's account now, not the seed's.
      if (profileByEmail.get(fixture.email)?.auth_user_id) {
        throw new Error(
          `Crowd profile "${fixture.email}" is linked to an Auth user; refusing to overwrite it. ` +
            "Crowd domains are reserved for the seed (data/crowd.ts)."
        );
      }
      continue;
    }

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
        ...(fixture.membershipPreOrderedSlug ? [fixture.membershipPreOrderedSlug] : []),
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
      for (const question of answeredQuestions(registration)) {
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

/** The membership columns of a fixture's profile. */
function membershipColumns(fixture: SeedUser, dependencies: DependencyReferences) {
  const idOf = (slug: string) => {
    const id = dependencies.membershipIds.get(slug);
    if (!id) throw new Error(`No ID found for membership "${slug}"`);
    return id;
  };
  const membershipTypeId = fixture.membershipSlug ? idOf(fixture.membershipSlug) : null;
  return {
    membership_expires_at: membershipTypeId
      ? (fixture.membershipExpiresAt ?? getMembershipExpiry())
      : null,
    membership_pre_ordered_type_id: fixture.membershipPreOrderedSlug
      ? idOf(fixture.membershipPreOrderedSlug)
      : null,
    membership_type_id: membershipTypeId,
  };
}

/**
 * The crowd's profiles, in one upsert on email. No Auth user: `auth_user_id`
 * is left out, so a new row gets null and an existing one keeps its own.
 */
async function reconcileCrowdProfiles(
  supabase: SupabaseClient,
  crowd: SeedUser[],
  dependencies: DependencyReferences,
  profileIds: Map<string, string>
): Promise<void> {
  if (crowd.length === 0) return;
  const { data, error } = await supabase
    .from(TABLE.userInfo)
    .upsert(
      crowd.map((fixture) => ({
        ...fixture.profile,
        email: fixture.email,
        ...membershipColumns(fixture, dependencies),
      })),
      { onConflict: "email" }
    )
    .select("id, email");
  if (error) throw new Error(`Upserting crowd profiles failed: ${error.message}`);
  for (const row of (data ?? []) as { id: string; email: string }[]) {
    profileIds.set(row.email, row.id);
  }
}

async function reconcileIdentities(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  dependencies: DependencyReferences,
  state: IdentityState
): Promise<{ authUsers: Counts; profiles: Counts; profileIds: Map<string, string> }> {
  const authUsers = countsFor(fixtures.filter(isLogin).length, state.authByEmail.size);
  const profiles = countsFor(fixtures.length, state.profileByEmail.size);
  const profileIds = new Map<string, string>();

  for (const fixture of fixtures) {
    if (fixture.password === null) continue;
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

    const existingProfile = state.profileByEmail.get(fixture.email);
    const payload = {
      ...fixture.profile,
      auth_user_id: authUser.id,
      email: fixture.email,
      ...membershipColumns(fixture, dependencies),
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

  await reconcileCrowdProfiles(
    supabase,
    fixtures.filter((fixture) => !isLogin(fixture)),
    dependencies,
    profileIds
  );

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
      .update({
        student_verified_at: verifiedAt,
        student_verified_by: verifierId,
        ubc_verified_at: verifiedAt,
        ubc_verified_via: "manual",
        ubc_verified_by: verifierId,
      })
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
  const existing = await selectIn<{ id: string; idempotency_key: string; user_id: string }>(
    supabase,
    TABLE.purchases,
    "id, idempotency_key, user_id",
    "idempotency_key",
    keys
  );

  const existingByKey = new Map(existing.map((row) => [row.idempotency_key, row]));

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
  const rows: (EventUserRow & Record<string, unknown>)[] = [];
  for (const part of chunk(userIds)) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .in("user_id", part)
      .in("event_id", eventIds);
    if (error) throw new Error(`Reading ${table} failed: ${error.message}`);
    rows.push(...((data ?? []) as unknown as (EventUserRow & Record<string, unknown>)[]));
  }
  return rows;
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
          // Written every run: left null, the database stamps the run time on
          // anything past draft, and the review list's order would drift.
          submitted_at: registration.application.submittedAt ?? null,
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
  await deleteByIds(
    supabase,
    TABLE.eventApplications,
    moved.map((row) => row.id),
    "event applications (reset)"
  );

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

/**
 * The object key the app would give a file answer:
 * `<user_info_id>/<application_id>/<question_id>/<file name>`, as
 * `applicationFilePath` in src/lib/supabase-helpers/application-files.ts
 * builds it. Storage policies read the first two segments, so the shape
 * matters to who can open it.
 */
function applicationFilePath(
  userId: string,
  applicationId: string,
  questionId: string,
  fileName: string
): string {
  return [userId, applicationId, questionId, fileName].join("/");
}

/**
 * Uploads each file once. An object already at its path is left alone: the
 * path names the application, so the same path means the same answer.
 */
async function uploadApplicationFiles(
  supabase: SupabaseClient,
  files: { path: string; title: string }[]
): Promise<Counts> {
  const counts = emptyCounts();
  for (const file of files) {
    const { error } = await supabase.storage
      .from(APPLICATION_FILES_BUCKET)
      .upload(file.path, minimalPdf([file.title, "Seed fixture: a stand-in portfolio."]), {
        contentType: "application/pdf",
        upsert: false,
      });
    if (!error) {
      counts.created += 1;
    } else if (/exists|duplicate/i.test(error.message)) {
      counts.updated += 1;
    } else {
      throw new Error(`Uploading application file "${file.path}" failed: ${error.message}`);
    }
  }
  return counts;
}

async function reconcileResponses(
  supabase: SupabaseClient,
  fixtures: SeedUser[],
  profileIds: Map<string, string>,
  applicationIds: Map<string, string>,
  dependencies: DependencyReferences
): Promise<{ counts: Counts; files: Counts }> {
  const uploads: { path: string; title: string }[] = [];
  const rows = fixtures.flatMap((fixture) =>
    fixture.registrations.flatMap((registration) => {
      const responses = Object.entries(registration.responses ?? {});
      const files = Object.entries(registration.files ?? {});
      if (responses.length === 0 && files.length === 0) return [];

      const applicationId = applicationIds.get(
        key(fixture.email, registration.eventSlug)
      );
      if (!applicationId) {
        throw new Error(
          `No application ID found for "${fixture.email}" and "${registration.eventSlug}"`
        );
      }
      const questionIdOf = (question: string) => {
        const questionId = dependencies.questionIds.get(
          key(registration.eventSlug, question)
        );
        if (!questionId) {
          throw new Error(
            `No question ID found for "${registration.eventSlug}" and "${question}"`
          );
        }
        return questionId;
      };

      const fileAnswers = files.map(([question, fileName]) => {
        const path = applicationFilePath(
          profileIds.get(fixture.email)!,
          applicationId,
          questionIdOf(question),
          fileName
        );
        uploads.push({
          path,
          title: `${fixture.profile.first_name} ${fixture.profile.last_name} - Portfolio`,
        });
        return [question, path] as const;
      });

      return [...responses, ...fileAnswers].map(([question, response]) => ({
        application_id: applicationId,
        event_application_question_id: questionIdOf(question),
        response,
      }));
    })
  );

  if (rows.length === 0) return { counts: emptyCounts(), files: emptyCounts() };
  const existing = await selectIn<{
    event_application_question_id: string;
    application_id: string;
  }>(
    supabase,
    TABLE.eventApplicationResponses,
    "event_application_question_id, application_id",
    "application_id",
    rows.map((row) => row.application_id),
    "application responses"
  );

  const existingKeys = new Set(
    existing.map((row) => key(row.event_application_question_id, row.application_id))
  );
  const existingDesiredCount = rows.filter((row) =>
    existingKeys.has(key(row.event_application_question_id, row.application_id))
  ).length;

  // Files first, so no answer ever names an object that isn't there.
  const files = await uploadApplicationFiles(supabase, uploads);

  const { error } = await supabase.from(TABLE.eventApplicationResponses).upsert(rows, {
    onConflict: "event_application_question_id,application_id",
  });
  if (error) throw new Error(`Upserting application responses failed: ${error.message}`);

  return { counts: countsFor(rows.length, existingDesiredCount), files };
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
  const existing = await selectIn<{ check_in_session_id: string; ticket_id: string }>(
    supabase,
    TABLE.checkIns,
    "check_in_session_id, ticket_id",
    "ticket_id",
    rows.map((row) => row.ticket_id),
    "check-ins"
  );

  const existingKeys = new Set(
    existing.map((row) => key(row.check_in_session_id, row.ticket_id))
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
    summary.files = createdCounts(
      fixtures.reduce(
        (count, fixture) =>
          count +
          fixture.registrations.reduce(
            (sum, registration) => sum + Object.keys(registration.files ?? {}).length,
            0
          ),
        0
      )
    );
    summary.checkIns = createdCounts(totals.checkIns);
    return summary;
  }

  const profileIds = summary.profileIds;

  const purchaseKeys = fixtures.flatMap((fixture) =>
    fixture.purchases.map((purchase) => purchase.idempotencyKey)
  );
  const purchaseRows = await selectIn<{ idempotency_key: string }>(
    supabase,
    TABLE.purchases,
    "idempotency_key",
    "idempotency_key",
    purchaseKeys
  );
  summary.purchases = countsFor(totals.purchases, purchaseRows.length);

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

  const [responseRows, checkInRows] = await Promise.all([
    selectIn<{ event_application_question_id: string; application_id: string }>(
      supabase,
      TABLE.eventApplicationResponses,
      "event_application_question_id, application_id",
      "application_id",
      [...applicationIds.values()],
      "application responses"
    ),
    selectIn<{ check_in_session_id: string; ticket_id: string }>(
      supabase,
      TABLE.checkIns,
      "check_in_session_id, ticket_id",
      "ticket_id",
      [...ticketIds.values()],
      "check-ins"
    ),
  ]);

  const responseKeys = new Set(
    responseRows.map((row) => key(row.event_application_question_id, row.application_id))
  );
  const checkInKeys = new Set(
    checkInRows.map((row) => key(row.check_in_session_id, row.ticket_id))
  );

  let existingResponses = 0;
  let existingFiles = 0;
  let totalFiles = 0;
  let existingCheckIns = 0;
  for (const fixture of fixtures) {
    for (const registration of fixture.registrations) {
      const fixtureKey = key(fixture.email, registration.eventSlug);
      const applicationId = applicationIds.get(fixtureKey);
      const ticketId = ticketIds.get(fixtureKey);

      for (const question of answeredQuestions(registration)) {
        const questionId = dependencies.questionIds.get(
          key(registration.eventSlug, question)
        );
        const isFile = Boolean(registration.files?.[question]);
        if (isFile) totalFiles += 1;
        if (questionId && applicationId && responseKeys.has(key(questionId, applicationId))) {
          existingResponses += 1;
          if (isFile) existingFiles += 1;
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
  // A file whose answer is already written was uploaded with it.
  summary.files = countsFor(totalFiles, existingFiles);
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
    identity.profileIds,
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
    responses: responses.counts,
    files: responses.files,
    checkIns,
    profileIds: identity.profileIds,
  };
}

export interface UserPruneSummary {
  purchases: number;
  tickets: number;
  applications: number;
  responses: number;
  files: number;
  checkIns: number;
}

function emptyPruneSummary(): UserPruneSummary {
  return {
    purchases: 0,
    tickets: 0,
    applications: 0,
    responses: 0,
    files: 0,
    checkIns: 0,
  };
}

async function deleteByIds(
  supabase: SupabaseClient,
  table: string,
  ids: string[],
  label: string
) {
  for (const part of chunk(ids)) {
    const { error } = await supabase.from(table).delete().in("id", part);
    if (error) throw new Error(`Deleting stale ${label} failed: ${error.message}`);
  }
}

/**
 * Every object in `application-files` under these accounts' folders. Keys are
 * `<user>/<application>/<question>/<file>`, and Storage lists one level at a
 * time, so this walks down three levels.
 */
async function listApplicationFiles(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<string[]> {
  const bucket = supabase.storage.from(APPLICATION_FILES_BUCKET);
  const list = async (prefix: string) => {
    const { data, error } = await bucket.list(prefix, { limit: 1000 });
    if (error) throw new Error(`Listing application files failed: ${error.message}`);
    // Folders come back with a null id.
    return (data ?? []).map((entry) => ({
      path: `${prefix}/${entry.name}`,
      isFolder: entry.id === null,
    }));
  };

  let level = userIds;
  for (let depth = 0; depth < 3; depth += 1) {
    const entries = (await Promise.all(level.map(list))).flat();
    level = entries.filter((entry) => entry.isFolder).map((entry) => entry.path);
    if (depth === 2) {
      return entries.filter((entry) => !entry.isFolder).map((entry) => entry.path);
    }
  }
  return [];
}

async function removeApplicationFiles(supabase: SupabaseClient, paths: string[]) {
  for (const part of chunk(paths, 100)) {
    const { error } = await supabase.storage.from(APPLICATION_FILES_BUCKET).remove(part);
    if (error) throw new Error(`Deleting application files failed: ${error.message}`);
  }
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
 * link.
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

  const readOwned = (table: string) =>
    selectIn<EventUserRow>(supabase, table, "id, event_id, user_id", "user_id", userIds);

  /* ── Tickets and applications ── */
  const [ticketRows, applicationRows] = await Promise.all([
    readOwned(TABLE.eventTickets),
    readOwned(TABLE.eventApplications),
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
  }

  /* ── Purchases ── */
  const desiredPurchaseKeys = new Set(
    fixtures.flatMap((fixture) =>
      fixture.purchases.map((purchase) => purchase.idempotencyKey)
    )
  );

  const purchaseRows = await selectIn<{ id: string; idempotency_key: string }>(
    supabase,
    TABLE.purchases,
    "id, idempotency_key, user_id",
    "user_id",
    userIds
  );

  const purchasePlan = planPrune(
    purchaseRows,
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

      for (const question of answeredQuestions(registration)) {
        if (applicationId) desiredResponses.add(pruneKey(applicationId, question));
      }
      for (const session of Object.keys(registration.checkIns ?? {})) {
        if (ticketId) desiredCheckIns.add(pruneKey(ticketId, session));
      }
    }
  }

  const applicationIds = applicationPlan.keep.map((row) => row.id);
  const ticketIds = ticketPlan.keep.map((row) => row.id);
  // Embedded selects come back typed as unknown to PostgREST's parser; the
  // shapes are asserted here rather than inferred.
  const [responseRows, checkInRows] = await Promise.all([
    selectIn<{
      id: string;
      application_id: string;
      response: string | null;
      event_application_questions: { question: string; response_type: string } | null;
    }>(
      supabase,
      TABLE.eventApplicationResponses,
      "id, application_id, response, event_application_questions(question, response_type)",
      "application_id",
      applicationIds,
      "application responses"
    ),
    selectIn<{
      id: string;
      ticket_id: string;
      check_in_sessions: { name: string } | null;
    }>(
      supabase,
      TABLE.checkIns,
      "id, ticket_id, check_in_sessions(name)",
      "ticket_id",
      ticketIds,
      "check-ins"
    ),
  ]);

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

  /* ── Application files no kept answer names ──
   * A file answer is the object's key, so anything under a fixture's folder
   * that no surviving answer points at is left over: an application the run
   * recreated or pruned, or a file uploaded through the app. */
  const referencedFiles = new Set(
    responsePlan.keep.flatMap((row) =>
      row.event_application_questions?.response_type === "file_upload" && row.response
        ? [row.response]
        : []
    )
  );
  const filePlan = planPrune(
    await listApplicationFiles(supabase, userIds),
    (path) => path,
    referencedFiles
  );

  summary.responses = responsePlan.remove.length;
  summary.files = filePlan.remove.length;
  summary.checkIns = checkInPlan.remove.length;

  if (options.dryRun) return summary;

  await deleteByIds(
    supabase,
    TABLE.eventApplicationResponses,
    responsePlan.remove.map((entry) => entry.row.id),
    "application responses"
  );
  await removeApplicationFiles(
    supabase,
    filePlan.remove.map((entry) => entry.row)
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
 * Deletes crowd accounts `data/crowd.ts` no longer lists, with everything they
 * hold. Only rows on a crowd domain with no Auth user are candidates: one
 * somebody signed up with has stopped being the seed's (the reconcile refuses
 * to write it, too).
 *
 * Tickets and applications are `no action` on `user_info`, so they go first;
 * their check-ins and answers cascade, as do purchases off the profile.
 */
export async function pruneCrowdProfiles(
  supabase: SupabaseClient,
  crowdEmails: readonly string[],
  options: { dryRun: boolean }
): Promise<number> {
  const { data, error } = await supabase
    .from(TABLE.userInfo)
    .select("id, email, auth_user_id")
    .or(CROWD_EMAIL_DOMAINS.map((domain) => `email.like.*@${domain}`).join(","));
  if (error) throw new Error(`Reading crowd profiles failed: ${error.message}`);

  const plan = planPrune(
    ((data ?? []) as ProfileRow[]).filter((row) => row.auth_user_id === null),
    (row) => row.email.trim().toLowerCase(),
    crowdEmails
  );
  const ids = plan.remove.map((entry) => entry.row.id);
  if (ids.length === 0 || options.dryRun) return ids.length;

  await removeApplicationFiles(supabase, await listApplicationFiles(supabase, ids));
  await releaseReviewNotesBy(supabase, ids);
  for (const table of [TABLE.eventTickets, TABLE.eventApplications]) {
    for (const part of chunk(ids)) {
      const { error: deleteError } = await supabase.from(table).delete().in("user_id", part);
      if (deleteError) {
        throw new Error(`Deleting crowd ${table} failed: ${deleteError.message}`);
      }
    }
  }
  await deleteByIds(supabase, TABLE.userInfo, ids, "crowd profiles");
  return ids.length;
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
 * than cascade: tickets and applications must go before the profile, and the
 * profile before the auth
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

    // Reviewer notes are `no action` on their author: a real account is
    // anonymised, never deleted, so its notes stay. A fixture leaves nothing.
    await releaseReviewNotesBy(supabase, profileIds);

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
