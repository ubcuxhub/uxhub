import { NextResponse, type NextRequest } from "next/server";

import { isAsyncTimeoutError, withDeadline } from "@/lib/async/deadline";
import {
  getExpiredLinkPath,
  getExpiredLinkTypeForNext,
  isExpiredLinkCode,
  readErrorCode,
} from "@/features/auth/link-expired";
import { resolveSetupDestination } from "@/features/setup/lib/state";
import {
  PROFILE_CONFLICT_EVENTS,
  ensureUserInfo,
} from "@/lib/auth/ensure-user-info";
import { authErrorPath, type AuthErrorCode } from "@/lib/auth/auth-error";
import { completeProfilePath, getSafeInternalPath } from "@/lib/auth/paths";
import { getRequestOrigin } from "@/lib/http/request-origin";
import { errorFields, log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { fetchSetupStepByAuthId } from "@/lib/supabase-helpers/setup";

function redirectToAuthError(
  origin: string,
  code: AuthErrorCode,
  nextPath: string,
) {
  return NextResponse.redirect(new URL(authErrorPath(code, nextPath), origin));
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

  const errorCode = searchParams.get("error_code");

  // Every way out to /auth/error below logs a stable event at `warn`: these
  // are expected-ish (a cancelled consent screen, a reused link), so they
  // shouldn't page through Sentry. Fields are ids and codes only, never the
  // provider's description or the member-facing message.
  if (isExpiredLinkCode(errorCode)) {
    log.info("auth.callback_link_expired", { source: "provider" });
    return redirectToExpiredLink(origin, nextPath);
  }

  if (providerError) {
    log.warn("auth.callback_provider_error", { errorCode });
    return redirectToAuthError(origin, "callback", nextPath);
  }

  if (!code) {
    log.warn("auth.callback_missing_code");
    return redirectToAuthError(origin, "callback", nextPath);
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
      const exchangeCode = readErrorCode(exchangeError) ?? null;
      if (isExpiredLinkCode(exchangeCode)) {
        log.info("auth.callback_link_expired", { source: "exchange" });
        return redirectToExpiredLink(origin, nextPath);
      }
      log.warn("auth.callback_exchange_failed", {
        ...errorFields(exchangeError),
        code: exchangeCode,
      });
      return redirectToAuthError(origin, "callback", nextPath);
    }

    const {
      data: { user: authUser },
      error: authUserError,
    } = await withDeadline(() => supabase.auth.getUser(), {
      operation: "Authenticated user lookup",
    });

    if (authUserError || !authUser?.id || !authUser.email) {
      log.warn("auth.callback_user_lookup_failed", {
        ...(authUserError ? errorFields(authUserError) : {}),
        authUserId: authUser?.id ?? null,
        missingEmail: Boolean(authUser?.id && !authUser.email),
      });
      return redirectToAuthError(origin, "callback", nextPath);
    }

    const result = await withDeadline(() => ensureUserInfo(authUser), {
      operation: "Profile setup",
    });

    // The provider didn't send a first name, so ask for it. The form returns to `next`, and the portal home keeps its
    // own setup gate.
    if (result.status === "missing_name") {
      return NextResponse.redirect(
        new URL(completeProfilePath(nextPath), origin),
      );
    }

    if (result.status === "conflict") {
      log.warn(PROFILE_CONFLICT_EVENTS[result.reason], {
        authUserId: authUser.id,
        source: "callback",
      });
      return redirectToAuthError(origin, result.reason, nextPath);
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
    // A timeout is a slow network or auth service; anything else is a bug,
    // so it goes to Sentry.
    if (isAsyncTimeoutError(error)) {
      log.warn("auth.callback_timeout", errorFields(error));
    } else {
      log.error("auth.callback_failed", errorFields(error));
    }
    return redirectToAuthError(
      origin,
      isAsyncTimeoutError(error) ? "timeout" : "callback",
      nextPath,
    );
  }
}
