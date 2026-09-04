/**
 * Launch feature flags.
 *
 * Defaults are derived from the deploy environment so unfinished work stays
 * visible where we build it and hidden where students see it: on locally and on
 * preview deployments, off in production. Either flag can be forced in either
 * direction with its `NEXT_PUBLIC_FEATURE_*` variable.
 *
 * These control visibility, not authorization — `NEXT_PUBLIC_*` values are
 * inlined into the client bundle at build time (which is also why flipping a
 * flag needs a redeploy). Access control stays in `src/lib/auth/guards.ts`.
 *
 * `grep -rn "FLAGS" src` lists every gate, so it doubles as the checklist for
 * launching one of these features.
 */

// Vercel sets NEXT_PUBLIC_VERCEL_ENV automatically: "production" on the
// production deployment, "preview" on PR deploys, undefined locally.
const isProduction = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

function flag(override: string | undefined, defaultOn: boolean) {
  if (override === "true") return true;
  if (override === "false") return false;
  return defaultOn;
}

export const FLAGS = {
  /**
   * Student-facing event browsing, registration, and checkout, plus the public
   * marketing event pages. Admin event management is unaffected.
   */
  studentEvents: flag(
    process.env.NEXT_PUBLIC_FEATURE_STUDENT_EVENTS,
    !isProduction,
  ),
  /** Dark theme. Off until the dark palette is designed. */
  darkMode: flag(process.env.NEXT_PUBLIC_FEATURE_DARK_MODE, !isProduction),
} as const;
