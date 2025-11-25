import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

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
      await supabase.auth.admin.getUserById(authUserId);

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
    const { data: existingUser } = await supabase
      .from("user_info")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (existingUser) {
      // Update existing record instead of inserting
      const { data, error } = await supabase
        .from("user_info")
        .update({
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
        })
        .eq("email", email.trim().toLowerCase())
        .select();

      if (error) throw error;
      return NextResponse.json({ data });
    }

    // 3. Insert new record
    const { data, error } = await supabase
      .from("user_info")
      .insert({
        auth_user_id: authUserId,
        email: email.trim().toLowerCase(),
        name: name,
        phone: phone || null,
        student_number: studentNumber ? parseInt(studentNumber) : null,
        faculty: faculty || null,
        major: major || null,
        year: year || null,
        newsletter: newsletter ? "true" : "false",
        role_access: "basic",
        order_date: new Date().toISOString(),
        membership_type: null,
      })
      .select();

    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Server error in link-auth-user:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
