"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clock, FileText, Search, User } from "lucide-react";
import { ActionSearch, type ActionSearchGroup } from "@/components/shared/ActionSearch";
import { useUser } from "@/lib/auth/user-context";
import { useUserExport } from "@/features/admin/lib/use-user-export";
import { dashboardSearchAction } from "@/features/admin/dashboard-search-actions";
import { addRecentReference, matchingActions, parseRecentReferences, searchDestination, searchKey, type DashboardSearchResult, type SearchReference, type SearchScope } from "@/features/admin/lib/dashboard-search";

function readRecents(key: string) {
  try { return parseRecentReferences(JSON.parse(sessionStorage.getItem(key) ?? "[]")); } catch { return []; }
}
function writeRecents(key: string, items: SearchReference[]) {
  try { sessionStorage.setItem(key, JSON.stringify(items)); } catch { /* Search still works without browser storage. */ }
}
export function DashboardSearch({ sessionKey, userId }: { sessionKey: string | null; userId: string }) {
  const { user } = useUser();
  // Remount state whenever the active account changes; never render old-account results.
  if (user?.id !== userId) return null;
  return <SearchSession key={`${userId}:${sessionKey}`} storageKey={sessionKey ? `uxhub:dashboard-search:${userId}:${sessionKey}` : null} />;
}
function SearchSession({ storageKey }: { storageKey: string | null }) {
  const router = useRouter();
  const userExport = useUserExport();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [lookup, setLookup] = useState<{ request: string; results: DashboardSearchResult[]; recents: DashboardSearchResult[]; error?: string } | null>(null);
  const version = useRef(Symbol());
  const references = useRef<SearchReference[]>([]);
  const request = JSON.stringify([query, scope, retry]);
  const current = lookup?.request === request ? lookup : null;
  const loading = open && !current;
  useEffect(() => {
    const generation = Symbol();
    version.current = generation;
    if (!open) return;
    references.current = storageKey ? readRecents(storageKey) : references.current;
    let disposed = false;
    const timer = setTimeout(() => {
      void dashboardSearchAction({ query, scope, recents: references.current }).then((response) => {
        if (disposed || version.current !== generation) return;
        if ("error" in response) setLookup({ request, results: [], recents: [], error: response.error });
        else {
          if (!query.trim() && scope === "all") {
            references.current = response.recents.map(({ kind, id }) => ({ kind, id }));
            if (storageKey) writeRecents(storageKey, references.current);
          }
          setLookup({ request, ...response });
        }
      }).catch(() => {
        if (!disposed && version.current === generation) setLookup({ request, results: [], recents: [], error: "Search is unavailable. Try again." });
      });
    }, query ? 200 : 0);
    return () => { disposed = true; version.current = Symbol(); clearTimeout(timer); };
  }, [query, scope, open, retry, request, storageKey]);
  function remember(item: DashboardSearchResult) {
    references.current = addRecentReference(references.current, item);
    if (storageKey) writeRecents(storageKey, references.current);
  }
  function select(item: DashboardSearchResult) {
    if (item.kind === "action" && item.id === "export") {
      remember(item); void userExport.download(); setOpen(false); return;
    }
    if (item.kind === "action" && (item.id === "upcoming" || item.id === "pending")) {
      version.current = Symbol(); remember(item); setScope(item.id); setQuery(""); return;
    }
    if (item.kind === "action" && item.id === "statistics") {
      remember(item); setOpen(false);
      const target = document.getElementById("statistics-heading");
      target?.scrollIntoView({ block: "start" }); target?.focus({ preventScroll: true });
    } else if (item.kind !== "action") {
      // Re-resolve on selection too: a deleted record must not stay actionable in an open menu.
      const generation = Symbol();
      version.current = generation;
      setLookup(null);
      void dashboardSearchAction({ query: "", scope: "all", recents: [item] }).then((response) => {
        if (generation !== version.current) return;
        if ("error" in response) { setLookup({ request, results: [], recents: [], error: response.error }); return; }
        const resolved = response.recents[0];
        if (!resolved) { setRetry((value) => value + 1); return; }
        remember(resolved); setOpen(false);
        const destination = searchDestination(resolved);
        if (destination) router.push(destination);
      }).catch(() => { if (generation === version.current) setLookup({ request, results: [], recents: [], error: "Couldn’t open this result. Try again." }); });
    }
  }
  const initial = !query.trim() && scope === "all";
  const groups: { label: string; results: readonly DashboardSearchResult[]; recent?: boolean }[] = initial ? [
    { label: "Recent", results: current?.recents ?? [], recent: true },
    { label: "Suggested", results: matchingActions("").filter((item) => item.id !== "statistics") },
  ] : [
    { label: "Users", results: current?.results.filter((item) => item.kind === "user") ?? [] },
    { label: scope === "pending" ? "Pending applications" : "Events", results: current?.results.filter((item) => item.kind !== "user") ?? [] },
    { label: "Suggested", results: scope === "all" ? matchingActions(query) : [] },
  ];
  const available = new Map<string, DashboardSearchResult>();
  const menu: ActionSearchGroup[] = groups.map((group) => ({ label: group.label, items: group.results.map((item) => {
    const id = `${group.label}:${searchKey(item)}`;
    available.set(id, item);
    const Icon = group.recent ? Clock : item.kind === "user" ? User : item.kind === "application" ? FileText :
      item.kind === "event" ? CalendarDays : Search;
    return { id, label: item.label, description: item.id === "export" && userExport.pending ? "Preparing user data…" : group.recent ? undefined : item.description, disabled: item.id === "export" && item.kind === "action" && userExport.pending, leading: <Icon aria-hidden /> };
  }) }));
  return <ActionSearch className="lg:w-[42%] lg:shrink-0" label="Search dashboard" placeholder="What are you searching for?"
    query={query} onQueryChange={(value) => { version.current = Symbol(); setQuery(value); }} open={open} onOpenChange={(next) => { if (next !== open) version.current = Symbol(); setOpen(next); if (next && !open) setRetry((value) => value + 1); }}
    groups={menu} loading={loading} error={current?.error} onRetry={() => setRetry((value) => value + 1)}
    contextAction={scope !== "all" ? { label: "Back to all results", onSelect: () => { version.current = Symbol(); setScope("all"); setQuery(""); } } : undefined}
    onSelect={(item) => { const result = available.get(item.id); if (result) select(result); }} />;
}
