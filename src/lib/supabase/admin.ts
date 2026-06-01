import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses Row Level Security, so it must only
 * ever be imported from server-only code (route handlers, server actions).
 * The `server-only` import above makes a client-side import a build error.
 *
 * Intentionally untyped (no `<Database>` generic): the privileged routes that
 * use it write a few columns that are not represented in the generated types,
 * so this preserves the existing runtime behavior. Prefer the typed helpers in
 * `@/lib/supabase-helpers/*` for anon-key access.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);
