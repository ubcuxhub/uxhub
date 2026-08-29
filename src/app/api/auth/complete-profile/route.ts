import { NextResponse } from "next/server";

import { ensureUserInfo } from "@/lib/auth/ensure-user-info";
import { createClient } from "@/lib/supabase/server";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";

interface CompleteProfileBody {
  name?: string;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser?.id || !authUser.email) {
    return NextResponse.json(
      { error: "You must be signed in to complete your profile." },
      { status: 401 }
    );
  }

  const existingByAuthId = await fetchUserInfoByAuthId(
    supabase,
    authUser.id
  ).catch(() => null);

  if (existingByAuthId) {
    return NextResponse.json(
      { error: "Your profile has already been completed." },
      { status: 409 }
    );
  }

  const body = (await req.json()) as CompleteProfileBody;
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json(
      { error: "Name is required." },
      { status: 400 }
    );
  }

  try {
    const result = await ensureUserInfo(authUser, { name });

    if (result.status === "conflict") {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to complete profile";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
