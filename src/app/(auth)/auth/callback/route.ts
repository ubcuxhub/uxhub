import { NextResponse, type NextRequest } from "next/server";

import { getRequestOrigin } from "@/lib/http/request-origin";
import { createClient } from "@/lib/supabase/server";
import {
  adminFindUserInfoByEmail,
  adminInsertUserInfo,
} from "@/lib/supabase-helpers/admin-server";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";

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

  const existingByAuthId = await fetchUserInfoByAuthId(
    supabase,
    authUser.id
  ).catch(() => null);

  if (existingByAuthId) {
    return NextResponse.redirect(new URL(nextPath, origin));
  }

  const normalizedEmail = authUser.email.trim().toLowerCase();

  const name =
    typeof authUser.user_metadata.full_name === "string" &&
    authUser.user_metadata.full_name.trim()
      ? authUser.user_metadata.full_name.trim()
      : normalizedEmail.split("@")[0];

  const payload = {
    auth_user_id: authUser.id,
    email: normalizedEmail,
    name,
  };

  const existingByEmail = await adminFindUserInfoByEmail(normalizedEmail);

  if (existingByEmail) {
    if (existingByEmail.auth_user_id === authUser.id) {
      return NextResponse.redirect(new URL(nextPath, origin));
    }

    const loginUrl = new URL("/auth/login", origin);
    loginUrl.searchParams.set("next", nextPath);
    loginUrl.searchParams.set(
      "error",
      "An account with this email already exists. Please log in instead."
    );

    return NextResponse.redirect(loginUrl);
  }

  await adminInsertUserInfo({
    ...payload,
    newsletter: false,
    role_access: "basic",
  });

  return NextResponse.redirect(new URL(nextPath, origin));
}
