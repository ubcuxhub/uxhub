import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  adminFindUserInfoByEmail,
  adminUpdateUserInfoById,
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
  const existingByEmail = await adminFindUserInfoByEmail(normalizedEmail);

  if (existingByEmail) {
    if (!existingByEmail.auth_user_id) {
      await adminUpdateUserInfoById(existingByEmail.id, {
        auth_user_id: authUser.id,
        email: normalizedEmail,
      });

      return NextResponse.redirect(new URL(nextPath, request.url));
    }

    if (existingByEmail.auth_user_id !== authUser.id) {
      return redirectToAuthError(
        request,
        "An account with this email is already linked to another sign-in method."
      );
    }

    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  return NextResponse.redirect(new URL("/auth/complete-profile", request.url));
}
