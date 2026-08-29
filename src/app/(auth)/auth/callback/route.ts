import { NextResponse, type NextRequest } from "next/server";

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

function redirectToAuthError(request: NextRequest, message: string) {
  const url = new URL("/auth/error", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const code = searchParams.get("code");
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const providerError =
    searchParams.get("error_description") || searchParams.get("error");

  if (providerError) {
    return redirectToAuthError(request, providerError);
  }

  if (!code) {
    return redirectToAuthError(request, "Missing OAuth code");
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code
  );

  if (exchangeError) {
    return redirectToAuthError(request, exchangeError.message);
  }

  const {
    data: { user: authUser },
    error: authUserError,
  } = await supabase.auth.getUser();

  if (authUserError || !authUser?.id || !authUser.email) {
    return redirectToAuthError(
      request,
      authUserError?.message || "Unable to load authenticated user"
    );
  }

  const existingByAuthId = await fetchUserInfoByAuthId(
    supabase,
    authUser.id
  ).catch(() => null);

  if (existingByAuthId) {
    return NextResponse.redirect(new URL(nextPath, request.url));
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
        return NextResponse.redirect(new URL(nextPath, request.url));
    }

    const loginUrl = new URL("/auth/login", request.url);
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

    return NextResponse.redirect(new URL(nextPath, request.url));
}
