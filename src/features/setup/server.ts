import "server-only";

import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/guards";
import type { UserInfoRow } from "@/lib/supabase/models";
import { getSetupRedirect, toSetupState, type SetupState } from "./lib/state";

/** The signed-in member's setup state, for the setup page's server component. */
export async function loadSetupState(): Promise<SetupState> {
  return toSetupState(await requireAuth());
}

/**
 * The setup gate's hook. Call it from a gated page (only the portal home, see
 * `SETUP_GATED_PATHS`) with the user `requireAuth()` returned. A page, not a
 * layout, because layouts don't re-render on client-side navigation.
 */
export function redirectToSetupIfNeeded(user: Pick<UserInfoRow, "setup_step">, pathname: string) {
  const destination = getSetupRedirect(user, pathname);
  if (destination) redirect(destination);
}
