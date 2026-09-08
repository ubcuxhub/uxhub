import { type EmailOtpType } from "@supabase/supabase-js";
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

const CONFIRM_ERROR_MESSAGE =
  "We couldn't verify this email link. It may have expired or already been used. Request a new link and try again.";

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextPath = getSafeInternalPath(searchParams.get("next"), "/");
  const origin = getRequestOrigin(request);

  if (!token_hash || !type) {
    return redirectToAuthError(origin, CONFIRM_ERROR_MESSAGE, nextPath);
  }

  try {
    const supabase = await withDeadline(() => createClient(), {
      operation: "Email confirmation",
    });
    const { error } = await withDeadline(
      () =>
        supabase.auth.verifyOtp({
          type,
          token_hash,
        }),
      { operation: "Email verification" },
    );

    if (error) {
      return redirectToAuthError(origin, CONFIRM_ERROR_MESSAGE, nextPath);
    }

    const {
      data: { user },
      error: userError,
    } = await withDeadline(() => supabase.auth.getUser(), {
      operation: "Confirmed user lookup",
    });

    if (userError || !user?.id || !user.email) {
      return redirectToAuthError(origin, CONFIRM_ERROR_MESSAGE, nextPath);
    }

    const profile = await withDeadline(() => ensureUserInfo(user), {
      operation: "Profile setup",
    });

    if (profile.status === "conflict") {
      return redirectToAuthError(origin, profile.message, nextPath);
    }

    return NextResponse.redirect(new URL(nextPath, origin));
  } catch (error) {
    const message = isAsyncTimeoutError(error)
      ? getAsyncErrorMessage(error, CONFIRM_ERROR_MESSAGE)
      : CONFIRM_ERROR_MESSAGE;
    return redirectToAuthError(origin, message, nextPath);
  }
}
