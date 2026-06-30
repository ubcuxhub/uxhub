import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import {
  adminFindUserInfoByEmail,
  adminInsertUserInfo,
  adminUpdateUserInfoById,
} from "@/lib/supabase-helpers/admin-server";
import { fetchUserInfoByAuthId } from "@/lib/supabase-helpers/users";

interface CompleteProfileBody {
  faculty?: string;
  major?: string;
  name?: string;
  phone?: string;
  studentNumber?: string;
  year?: string;
}

function normalizeText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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

  const normalizedEmail = authUser.email.trim().toLowerCase();
  const payload = {
    auth_user_id: authUser.id,
    email: normalizedEmail,
    name,
    phone: normalizeText(body.phone),
    student_number: body.studentNumber?.trim()
      ? parseInt(body.studentNumber, 10)
      : null,
    faculty: normalizeText(body.faculty),
    major: normalizeText(body.major),
    year: normalizeText(body.year),
  };

  try {
    const existingByEmail = await adminFindUserInfoByEmail(normalizedEmail);

    if (existingByEmail) {
      if (
        existingByEmail.auth_user_id &&
        existingByEmail.auth_user_id !== authUser.id
      ) {
        return NextResponse.json(
          {
            error:
              "An account with this email is already linked to another sign-in method.",
          },
          { status: 409 }
        );
      }

      await adminUpdateUserInfoById(existingByEmail.id, payload);
      return NextResponse.json({ success: true });
    }

    await adminInsertUserInfo({
      ...payload,
      newsletter: false,
      role_access: "basic",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to complete profile";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
