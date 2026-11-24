import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Service-role Supabase client. Bypasses Row Level Security, so it must only
 * ever be imported from server-only code (route handlers, server actions).
 * The `server-only` import above makes a client-side import a build error.
 *
 * Typed with the generated `Database`, like the anon-key clients, so its table
 * reads and direct RPC calls are checked against the schema.
 */
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);
