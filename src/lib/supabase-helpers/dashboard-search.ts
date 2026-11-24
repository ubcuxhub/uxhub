import type { DbClient } from "./types";
import { TABLES } from "./tables";
import { SEARCH_LIMIT, parseRecentReferences, SEARCH_ACTIONS, type SearchScope, type DashboardSearchResult, type SearchReference } from "@/features/admin/lib/dashboard-search";

async function requireSearchAccess(db: DbClient) {
  const { data, error } = await db.rpc("is_admin");
  if (error) throw error;
  if (!data) throw Object.assign(new Error("Staff access required"), { code: "42501" });
}
// Quote PostgREST grammar, and escape LIKE metacharacters so input is literal.
function pattern(query: string) {
  return `"%${query.replace(/[\\%_*]/g, "\\$&").replace(/"/g, '\\"')}%"`;
}
async function users(db: DbClient, query: string, ids?: string[]): Promise<DashboardSearchResult[]> {
  let request = db.from(TABLES.userInfo).select("id, first_name, last_name, email").is("deleted_at", null);
  if (ids) request = request.in("id", ids);
  else for (const term of query.split(/\s+/).filter(Boolean)) {
    const value = pattern(term);
    request = request.or(`first_name.ilike.${value},last_name.ilike.${value},email.ilike.${value}`);
  }
  const { data, error } = await request.order("last_name").order("first_name").order("id").limit(SEARCH_LIMIT);
  if (error) throw error;
  return (data ?? []).map((row) => ({ kind: "user", id: row.id, label: `${row.first_name} ${row.last_name}`.trim(), description: row.email }));
}
async function events(db: DbClient, query: string, scope: SearchScope, ids?: string[]): Promise<DashboardSearchResult[]> {
  if (scope === "pending") {
    // The empty embed filters parent events before LIMIT. An inner COUNT embed
    // alone still produces a zero aggregate row for an empty queue.
    let request = db.from(TABLES.events).select("id, name, pending:event_applications!inner(), event_applications(count)")
      .eq("requires_application", true).eq("pending.status", "submitted")
      .eq("event_applications.status", "submitted");
    if (ids) request = request.in("id", ids);
    else request = request.ilike("name", `%${query.replace(/[\\%_]/g, "\\$&")}%`);
    const { data, error } = await request.order("name").order("id").limit(SEARCH_LIMIT);
    if (error) throw error;
    return (data ?? []).filter((row) => row.event_applications[0]?.count > 0).map((row) => {
      const count = row.event_applications[0].count;
      return { kind: "application", id: row.id, label: row.name, description: `${count} pending ${count === 1 ? "application" : "applications"}` };
    });
  }
  let request = db.from(TABLES.events).select("id, name");
  if (ids) request = request.in("id", ids);
  else request = request.ilike("name", `%${query.replace(/[\\%_]/g, "\\$&")}%`);
  if (scope === "upcoming") {
    const now = new Date().toISOString();
    request = request.eq("status", "active").is("canceled_at", null).gt("starts_at", now).order("starts_at");
  }
  const { data, error } = await request.order("name").order("id").limit(SEARCH_LIMIT);
  if (error) throw error;
  return (data ?? []).map((row) => ({ kind: "event", id: row.id, label: row.name }));
}
/** Bounded minimal projections, always using the viewer client and its RLS. */
export async function fetchDashboardSearch(db: DbClient, query: string, scope: SearchScope): Promise<DashboardSearchResult[]> {
  await requireSearchAccess(db);
  const text = query.trim().slice(0, 120);
  if (scope !== "all") return events(db, text, scope);
  if (!text) return [];
  const [people, records] = await Promise.all([users(db, text), events(db, text, "all")]);
  return [...people, ...records];
}
/** Stored browser data is references only; labels and availability are resolved anew. */
export async function resolveDashboardRecents(db: DbClient, input: unknown): Promise<DashboardSearchResult[]> {
  await requireSearchAccess(db);
  const references = parseRecentReferences(input);
  const resolve = async (ref: SearchReference) => {
    if (ref.kind === "action") return SEARCH_ACTIONS.find((item) => item.id === ref.id);
    const matches = ref.kind === "user" ? await users(db, "", [ref.id]) :
      await events(db, "", ref.kind === "application" ? "pending" : "all", [ref.id]);
    return matches[0];
  };
  return (await Promise.all(references.map(resolve))).filter((item): item is DashboardSearchResult => Boolean(item));
}
