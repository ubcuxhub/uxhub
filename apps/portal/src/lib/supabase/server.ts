// lib/supabaseServer.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function createClient() {
  const cookieStore = await cookies(); // Next 15: async

  return createServerClient(url, key, {
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
}
