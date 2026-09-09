import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { fetchMembershipTermEndsAt } from "@/lib/supabase-helpers/app-settings";

/**
 * Request-scoped read of the club-wide membership term end.
 *
 * `(app)/layout.tsx` seeds it for every authenticated page, and pages that make
 * their own membership decisions need it too. Caching here means a layout and
 * the page it renders share one query instead of issuing two.
 *
 * This wrapper exists rather than caching the helper itself because
 * `fetchMembershipTermEndsAt` takes a `DbClient` and also runs in the browser
 * (see `UserContext`), where `cache()` means nothing.
 */
export const getMembershipTermEndsAt = cache(
  async (): Promise<string | null> =>
    fetchMembershipTermEndsAt(await createClient())
);
