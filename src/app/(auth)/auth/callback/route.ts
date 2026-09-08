import { NextResponse, type NextRequest } from "next/server";

import {
  getAsyncErrorMessage,
  isAsyncTimeoutError,
  withDeadline,
} from "@/lib/async/deadline";
import { ensureUserInfo } from "@/lib/auth/ensure-user-info";
import { getSafeInternalPath } from "@/lib/auth/paths";
import { getRequestOrigin } from "@/lib/http/request-origin";
import { createClient } from "@/lib/supabase/server";

const CALLBACK_ERROR_MESSAGE =
  "We couldn't complete sign-in. The link may have expired or already been used. Try signing in again.";

function redirectToAuthError(
  origin: string,
  message: string,
  nextPath: string,
) {
  const url = new URL("/auth/error", origin);
  url.searchParams.set("error", message);
  url.searchParams.set("next", nextPath);
  return NextResponse.redirect(url);
}

function getCallbackErrorMessage(error: unknown) {
  return isAsyncTimeoutError(error)
    ? getAsyncErrorMessage(error, CALLBACK_ERROR_MESSAGE)
    : CALLBACK_ERROR_MESSAGE;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  // Redirects must stay on the origin the browser used, otherwise the session
  // cookies set below are not sent with the follow-up request.
  const origin = getRequestOrigin(request);
  const code = searchParams.get("code");
  const nextPath = getSafeInternalPath(searchParams.get("next"));
  const providerError =
    searchParams.get("error_description") || searchParams.get("error");

  if (providerError) {
    return redirectToAuthError(origin, CALLBACK_ERROR_MESSAGE, nextPath);
  }

  if (!code) {
    return redirectToAuthError(origin, CALLBACK_ERROR_MESSAGE, nextPath);
  }

  try {
    const supabase = await withDeadline(() => createClient(), {
      operation: "Authentication callback",
    });
    const { error: exchangeError } = await withDeadline(
      () => supabase.auth.exchangeCodeForSession(code),
      { operation: "Authentication code exchange" },
    );

    if (exchangeError) {
      return redirectToAuthError(origin, CALLBACK_ERROR_MESSAGE, nextPath);
    }

    const {
      data: { user: authUser },
      error: authUserError,
    } = await withDeadline(() => supabase.auth.getUser(), {
      operation: "Authenticated user lookup",
    });

    if (authUserError || !authUser?.id || !authUser.email) {
      return redirectToAuthError(origin, CALLBACK_ERROR_MESSAGE, nextPath);
    }

    const result = await withDeadline(() => ensureUserInfo(authUser), {
      operation: "Profile setup",
    });

    if (result.status === "conflict") {
      return redirectToAuthError(origin, result.message, nextPath);
    }

    return NextResponse.redirect(new URL(nextPath, origin));
  } catch (error) {
    return redirectToAuthError(
      origin,
      getCallbackErrorMessage(error),
      nextPath,
    );
  }
}
