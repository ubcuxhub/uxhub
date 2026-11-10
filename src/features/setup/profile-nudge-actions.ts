"use server";

import { cookies } from "next/headers";

import { PROFILE_NUDGE_COOKIE, PROFILE_NUDGE_COOKIE_MAX_AGE } from "./lib/profile-nudge";

/** Remembers, for a year, that this browser dismissed the profile card. */
export async function dismissProfileNudgeAction(): Promise<void> {
  const store = await cookies();
  store.set(PROFILE_NUDGE_COOKIE, "1", {
    maxAge: PROFILE_NUDGE_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
  });
}
