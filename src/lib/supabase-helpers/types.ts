import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Shared Supabase client type for all data-access helpers.
 *
 * Both `createBrowserClient<Database>` (`@/lib/supabase/client`) and
 * `createServerClient<Database>` (`@/lib/supabase/server`) return a value
 * assignable to this type, so the same helper works in client components,
 * server components, route handlers, and tests. Pass the client in rather
 * than constructing one inside a helper, so the security context (anon vs
 * service role) stays explicit at the call site.
 */
export type DbClient = SupabaseClient<Database>;
