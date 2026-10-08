/**
 * Harness for integration tests that run against the local Supabase.
 *
 * Isolation follows `supabase/tests/rls.sql`'s intent, by the second route the
 * plan allows: a test cannot wrap PostgREST calls in one transaction and roll
 * it back, because each request commits on its own, so instead every fixture is
 * tagged with a value unique to the test and deleted afterwards. That keeps a
 * run safe on the seeded local database — `pnpm supabase:local` seeds it — and
 * repeatable.
 *
 * These helpers use the service-role key and delete rows, so `resolveTarget`
 * refuses any host that is not local. A developer's `.env.local` points at the
 * hosted project, and nothing here may ever reach it.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import type { Database } from "@/lib/supabase/database.types";

export type IntegrationClient = SupabaseClient<Database>;

type TableName = keyof Database["public"]["Tables"];

/** Matches `isLocalHost` in `scripts/seed/lib/targets.ts`. */
function isLocalHost(url: string): boolean {
  const host = new URL(url).hostname;
  return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
}

const SETUP_HINT =
  "Start it with `pnpm supabase:local`, then run `pnpm test:integration`, " +
  "which reads the credentials from `supabase status`.";

export function resolveTarget(
  env: Record<string, string | undefined> = process.env
) {
  const url = (
    env.INTEGRATION_SUPABASE_URL ??
    env.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  ).trim();
  const secretKey = (
    env.INTEGRATION_SUPABASE_SECRET_KEY ??
    env.SUPABASE_SECRET_KEY ??
    ""
  ).trim();

  if (!url || !secretKey) {
    throw new Error(
      `Integration tests need a local Supabase URL and secret key. ${SETUP_HINT}`
    );
  }
  if (!isLocalHost(url)) {
    throw new Error(
      `Integration tests refuse to run against ${url}: they write and delete ` +
        `rows with the service-role key, so only a local database is allowed. ${SETUP_HINT}`
    );
  }

  return { url, secretKey };
}

export function createIntegrationClient(): IntegrationClient {
  const { url, secretKey } = resolveTarget();

  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Tracks what a test created so it can be removed again.
 *
 * Rows are deleted newest first, so a child inserted after its parent goes
 * first and foreign keys stay satisfied.
 */
export class Fixtures {
  readonly supabase: IntegrationClient;
  /** Unique per test. Put it in any name, slug, or email a test inserts. */
  readonly tag: string;

  private readonly rows: { table: TableName; id: string }[] = [];
  private readonly authUserIds: string[] = [];

  constructor(supabase: IntegrationClient, tag = `it-${randomUUID().slice(0, 8)}`) {
    this.supabase = supabase;
    this.tag = tag;
  }

  track(table: TableName, id: string) {
    this.rows.push({ table, id });
    return id;
  }

  async createEvent(
    overrides: Partial<Database["public"]["Tables"]["events"]["Insert"]> = {}
  ) {
    const { data, error } = await this.supabase
      .from("events")
      .insert({
        name: `Integration event ${this.tag}`,
        description: "Created by an integration test.",
        slug: `integration-event-${this.tag}`,
        regular_price: 10,
        member_price: 5,
        max_capacity: 10,
        ...overrides,
      })
      .select()
      .single();

    if (error) throw error;
    this.track("events", data.id);
    return data;
  }

  /**
   * Creates an auth user and the matching `user_info` row, the pairing the app
   * assumes everywhere.
   */
  async createUser(
    overrides: Partial<Database["public"]["Tables"]["user_info"]["Insert"]> = {}
  ) {
    const email = `${this.tag}-${this.rows.length}@example.test`;
    const { data: auth, error: authError } =
      await this.supabase.auth.admin.createUser({
        email,
        password: randomUUID(),
        email_confirm: true,
      });
    if (authError) throw authError;
    this.authUserIds.push(auth.user.id);

    const { data, error } = await this.supabase
      .from("user_info")
      .insert({
        auth_user_id: auth.user.id,
        email,
        first_name: "Integration",
        last_name: "Test",
        role_access: "basic",
        ...overrides,
      })
      .select()
      .single();

    if (error) throw error;
    this.track("user_info", data.id);
    return data;
  }

  async cleanup() {
    const failures: unknown[] = [];

    for (const { table, id } of [...this.rows].reverse()) {
      // `from` is typed per table, so a union of tables leaves the column names
      // as `never`. Every tracked table keys on `id`, which is what makes one
      // loop possible at all.
      const builder = this.supabase.from(table).delete() as unknown as {
        eq: (column: string, value: string) => PromiseLike<{ error: unknown }>;
      };
      const { error } = await builder.eq("id", id);
      if (error) failures.push(error);
    }
    for (const id of this.authUserIds) {
      const { error } = await this.supabase.auth.admin.deleteUser(id);
      if (error) failures.push(error);
    }

    this.rows.length = 0;
    this.authUserIds.length = 0;

    // Leftovers would leak into the next run, so a failed cleanup fails the
    // test rather than going unnoticed.
    if (failures.length > 0) {
      throw new Error(
        `Fixture cleanup failed: ${failures
          .map((failure) =>
            failure instanceof Error ? failure.message : String(failure)
          )
          .join("; ")}`
      );
    }
  }
}

/** Runs `fn` with a fresh fixture set and clears it up afterwards. */
export async function withFixtures<T>(
  fn: (fixtures: Fixtures) => Promise<T>
): Promise<T> {
  const fixtures = new Fixtures(createIntegrationClient());
  try {
    return await fn(fixtures);
  } finally {
    await fixtures.cleanup();
  }
}
