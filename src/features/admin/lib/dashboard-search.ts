export type SearchScope = "all" | "upcoming" | "pending";
export type SearchReference = { kind: "user" | "event" | "application" | "action"; id: string };
export type DashboardSearchResult = SearchReference & { label: string; description?: string };
export const SEARCH_LIMIT = 6;
export const RECENT_LIMIT = 5;
export const SEARCH_ACTIONS: readonly DashboardSearchResult[] = [
  { kind: "action", id: "upcoming", label: "Upcoming events" },
  { kind: "action", id: "pending", label: "Pending applications" },
  { kind: "action", id: "statistics", label: "Club statistics" },
  // ADR-005 implements this dispatch branch; it must remain unavailable until then.
  { kind: "action", id: "export", label: "Export user data", description: "Not available yet" },
];
export function searchKey(item: SearchReference) { return `${item.kind}:${item.id}`; }
export function searchDestination(item: SearchReference) {
  if (item.kind === "user") return `/admin/users/${item.id}`;
  if (item.kind === "event") return `/admin/events/${item.id}`;
  if (item.kind === "application") return `/admin/events/${item.id}/review-applications`;
  return null;
}
export function matchingActions(query: string) {
  return SEARCH_ACTIONS.filter((item) => item.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
}
export function parseRecentReferences(value: unknown): SearchReference[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SearchReference => Boolean(item && typeof item === "object" &&
    ["user", "event", "application", "action"].includes(item.kind) && typeof item.id === "string" &&
    (item.kind === "action" ? SEARCH_ACTIONS.some((action) => action.id === item.id && action.id !== "export") :
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)))).slice(0, RECENT_LIMIT).map(({ kind, id }) => ({ kind, id }));
}
export function addRecentReference(items: SearchReference[], item: SearchReference) {
  return [{ kind: item.kind, id: item.id }, ...items.filter((entry) => searchKey(entry) !== searchKey(item))].slice(0, RECENT_LIMIT);
}
