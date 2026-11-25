"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fetchDashboardSearch, resolveDashboardRecents } from "@/lib/supabase-helpers/dashboard-search";
import type { DashboardSearchResult, SearchScope } from "./lib/dashboard-search";
import { errorFields, log } from "@/lib/log";

export async function dashboardSearchAction(input: { query: string; scope: SearchScope; recents?: unknown }): Promise<{ results: DashboardSearchResult[]; recents: DashboardSearchResult[] } | { error: string }> {
  await requireAdmin();
  if (!input || typeof input.query !== "string" || input.query.length > 120 || !["all", "upcoming", "pending"].includes(input.scope)) return { error: "Invalid search. Try another query." };
  try {
    const db = await createClient();
    const [results, recents] = await Promise.all([
      fetchDashboardSearch(db, input.query, input.scope),
      !input.query.trim() && input.scope === "all" ? resolveDashboardRecents(db, input.recents) : Promise.resolve([]),
    ]);
    return { results, recents };
  } catch (error) {
    log.warn("admin.dashboard_search_failed", errorFields(error));
    return { error: "Couldn’t load search results. Try again." };
  }
}
