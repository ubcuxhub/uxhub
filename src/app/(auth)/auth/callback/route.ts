import { NextResponse, type NextRequest } from "next/server";

import {
  getAsyncErrorMessage,
  isAsyncTimeoutError,
  withDeadline,
} from "@/lib/async/deadline";
import {
  getExpiredLinkPath,
  getExpiredLinkTypeForNext,
  isExpiredLinkCode,
  readErrorCode,
} from "@/features/auth/link-expired";
import { resolveSetupDestination } from "@/features/setup/lib/state";
import { ensureUserInfo } from "@/lib/auth/ensure-user-info";
import { getSafeInternalPath } from "@/lib/auth/paths";
import { getRequestOrigin } from "@/lib/http/request-origin";
import { createClient } from "@/lib/supabase/server";
import { fetchSetupStepByAuthId } from "@/lib/supabase-helpers/setup";

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

/**
 * An expired or already-used link gets its own screen with a way to ask for a
 * new one. The `next` the link carried says whether it was a recovery link.
 */
function redirectToExpiredLink(origin: string, nextPath: string) {
  const type = getExpiredLinkTypeForNext(nextPath);
  return NextResponse.redirect(
    new URL(getExpiredLinkPath(type, nextPath), origin),
  );
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

  if (isExpiredLinkCode(searchParams.get("error_code"))) {
    return redirectToExpiredLink(origin, nextPath);
  }

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
      if (isExpiredLinkCode(readErrorCode(exchangeError))) {
        return redirectToExpiredLink(origin, nextPath);
      }
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

    // A new member heading for the portal home goes straight to setup, so the
    // portal never renders first. The lookup is best effort: the portal page
    // keeps its own gate.
    let destination = nextPath;
    try {
      destination = resolveSetupDestination(
        nextPath,
        await withDeadline(() => fetchSetupStepByAuthId(supabase, authUser.id), {
          operation: "Setup state lookup",
        }),
      );
    } catch {
      destination = nextPath;
    }

    return NextResponse.redirect(new URL(destination, origin));
  } catch (error) {
    return redirectToAuthError(
      origin,
      getCallbackErrorMessage(error),
      nextPath,
    );
  }
}
