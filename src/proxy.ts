import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(
    "x-uxhub-path",
    `${req.nextUrl.pathname}${req.nextUrl.search}`,
  );
  const res = NextResponse.next({ request: { headers: requestHeaders } });

  // The callback exchanges a code for a new session and sets those cookies
  // itself. Refreshing the old session here too would race it with a second
  // set of the same cookies.
  if (req.nextUrl.pathname.startsWith("/auth/callback")) return res;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () =>
          req.cookies.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cookies) =>
          cookies.forEach(({ name, value, options }) =>
            res.cookies.set({ name, value, ...options })
          ),
      },
    }
  );

  // Refresh only. Authorization happens in src/lib/auth/guards.ts and in RLS,
  // so this must not spend a round trip verifying a token it never reads.
  // getUser() always issues GET /auth/v1/user; getSession() reads the cookie
  // locally and only reaches the network when the token is near expiry. That
  // on-demand refresh is not gated by autoRefreshToken, which @supabase/ssr
  // sets to false -- that flag only disables the background ticker.
  //
  // Discard the result. Reading .user off it trips auth-js's insecure-user
  // warning proxy on every request.
  await supabase.auth.getSession();

  return res;
}

// Every route that reads the session with the cookie client, so a refresh
// there can persist its rotated token. A Server Component can't set cookies,
// so on an unmatched page (the public event page, the auth pages through
// redirectIfAuthenticated) a refresh would rotate the refresh token without
// saving it, and the browser's next request would replay a used one, which
// Supabase answers by revoking the session.
export const config = {
  matcher: [
    "/admin/:path*",
    "/portal/:path*",
    "/join/:path*",
    "/api/:path*",
    "/auth/:path*",
    "/events/:path*",
  ],
};
