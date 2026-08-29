import { NextResponse, type NextRequest } from "next/server";

import { ensureUserInfo } from "@/lib/auth/ensure-user-info";
import { getRequestOrigin } from "@/lib/http/request-origin";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT_PATH = "/portal";

function getSafeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return DEFAULT_NEXT_PATH;
  }

  return next;
}

function redirectToAuthError(origin: string, message: string) {
  const url = new URL("/auth/error", origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  // Redirects must stay on the origin the browser used, otherwise the session
  // cookies set below are not sent with the follow-up request.
  const origin = getRequestOrigin(request);
  const code = searchParams.get("code");
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const providerError =
    searchParams.get("error_description") || searchParams.get("error");

  if (providerError) {
    return redirectToAuthError(origin, providerError);
  }

  if (!code) {
    return redirectToAuthError(origin, "Missing OAuth code");
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code
  );

  if (exchangeError) {
    return redirectToAuthError(origin, exchangeError.message);
  }

  const {
    data: { user: authUser },
    error: authUserError,
  } = await supabase.auth.getUser();

  if (authUserError || !authUser?.id || !authUser.email) {
    return redirectToAuthError(
      origin,
      authUserError?.message || "Unable to load authenticated user"
    );
  }

  const result = await ensureUserInfo(authUser);

  if (result.status === "conflict") {
    return redirectToAuthError(origin, result.message);
  }

  return NextResponse.redirect(new URL(nextPath, origin));
}
