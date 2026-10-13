"use server";

// TEMPORARY: delete this folder before merging the Sentry PR.

import { log } from "@/lib/log";

function assertNotProduction() {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") {
    throw new Error("Not available");
  }
}

// The fake email checks that server scrubbing drops exception messages.
export async function throwServerError() {
  assertNotProduction();
  throw new Error("sentry-check server error for student@example.com");
}

export async function logServerError() {
  assertNotProduction();
  log.error("sentry_check.logged_error", { source: "sentry-check" });
}
