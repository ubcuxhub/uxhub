import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  adminFindUserInfoIdByEmail,
  adminInsertUserInfo,
  adminUpdateUserInfoByEmail,
} from "@/lib/supabase-helpers/admin-server";

export async function POST(req: Request) {
  const body = await req.json();
  const {
    email,
    authUserId,
    name,
    phone,
    studentNumber,
    faculty,
    major,
    year,
    newsletter,
  } = body;

  if (!email || !authUserId || !name) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  try {
    // 1. Verify the user actually exists in Supabase Auth
    // This handles cases where Supabase returns a fake user object for enumeration protection
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.getUserById(authUserId);

    if (authError || !authUser.user) {
      console.error(
        "Auth user not found (possible duplicate email / enumeration protection):",
        authUserId
      );
      return NextResponse.json(
        {
          error:
            "Account already exists or could not be verified. Please try logging in.",
        },
        { status: 400 }
      );
    }

    // 2. Check if user_info already exists for this email
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await adminFindUserInfoIdByEmail(normalizedEmail);

    if (existingUser) {
      // Update existing record instead of inserting
      const data = await adminUpdateUserInfoByEmail(normalizedEmail, {
        auth_user_id: authUserId,
        name: name,
        phone: phone || null,
        student_number: studentNumber ? parseInt(studentNumber) : null,
        faculty: faculty || null,
        major: major || null,
        year: year || null,
        newsletter: newsletter ? "true" : "false",
        // Don't overwrite role_access or order_date if they might exist?
        // For now, let's keep basic logic but ensure we link.
        // role_access: "basic",
      });

      return NextResponse.json({ data });
    }

    // 3. Insert new record
    try {
      const data = await adminInsertUserInfo({
        auth_user_id: authUserId,
        email: normalizedEmail,
        name: name,
        phone: phone || null,
        student_number: studentNumber ? parseInt(studentNumber) : null,
        faculty: faculty || null,
        major: major || null,
        year: year || null,
        newsletter: newsletter ? "true" : "false",
        role_access: "basic",
      });

      return NextResponse.json({ data });
    } catch (insertErr) {
      console.error("Insert error:", insertErr);
      const message =
        insertErr instanceof Error ? insertErr.message : "Insert failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (err) {
    console.error("Server error in link-auth-user:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
