import { NextResponse } from "next/server";

import {
  getAsyncErrorMessage,
  isAsyncTimeoutError,
  withDeadline,
} from "@/lib/async/deadline";
import { ensureUserInfo } from "@/lib/auth/ensure-user-info";
import { createClient } from "@/lib/supabase/server";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";

interface CompleteProfileBody {
  firstName?: string;
  lastName?: string;
}

export async function POST(req: Request) {
  try {
    const supabase = await withDeadline(() => createClient(), {
      operation: "Profile completion",
    });
    const {
      data: { user: authUser },
      error: authError,
    } = await withDeadline(() => supabase.auth.getUser(), {
      operation: "Authenticated user lookup",
    });

    if (authError || !authUser?.id || !authUser.email) {
      return NextResponse.json(
        { error: "You must be signed in to complete your profile." },
        { status: 401 },
      );
    }

    const existingByAuthId = await withDeadline(
      () => fetchUserInfoByAuthId(supabase, authUser.id),
      { operation: "Existing profile lookup" },
    );

    if (existingByAuthId) {
      return NextResponse.json({ success: true });
    }

    const body = (await req.json()) as CompleteProfileBody;
    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim();

    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First and last name are required." },
        { status: 400 },
      );
    }

    const result = await withDeadline(
      () => ensureUserInfo(authUser, { firstName, lastName }),
      { operation: "Profile creation" },
    );

    if (result.status === "conflict") {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = isAsyncTimeoutError(error)
      ? getAsyncErrorMessage(error)
      : "Unable to complete your profile. Please try again.";

    return NextResponse.json(
      { error: message },
      { status: isAsyncTimeoutError(error) ? 504 : 500 },
    );
  }
}
