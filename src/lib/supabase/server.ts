// lib/supabaseServer.ts
import { cache } from "react";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Request-scoped Supabase client.
 *
 * Cached so a layout, its pages, and the auth guards share one client and
 * one GoTrueClient instead of constructing a fresh pair each. This is safe:
 * React's `cache` calls the function uncached when there is no request scope
 * (route handlers, server actions), so a client can never leak across
 * requests. Do not unwrap this -- `loadCurrentUser` depends on the client
 * identity being stable.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies(); // Next 15: async

  return createServerClient<Database>(url, key, {
    cookies: {
      // NEW interface: provide ONLY these two
      getAll() {
        // maps to [{ name, value }]
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // writes succeed in Route Handlers / Server Actions; RSC will no-op
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set({ name, value, ...options })
          );
        } catch {
          /* ignore in pure RSC */
        }
      },
    },
  });
});
