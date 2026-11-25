"use client";

import type { SectionProps } from "@/app/dev/_shell/types";
import { useState } from "react";
import { Clock, Search, User } from "lucide-react";
import { ActionSearch, type ActionSearchGroup } from "@/components/shared/ActionSearch";
import { Specimen, SpecimenGroup } from "@/app/dev/_shell/Specimen";

const groups: ActionSearchGroup[] = [
  { label: "Recent", items: [{ id: "recent-user", label: "Alex Chen", leading: <Clock aria-hidden /> }] },
  { label: "Suggested", items: [
    { id: "upcoming", label: "Upcoming events", leading: <Search aria-hidden /> },
    { id: "pending", label: "Pending applications", leading: <Search aria-hidden /> },
    { id: "export", label: "Export user data", leading: <Search aria-hidden /> },
  ] },
];
function Example({ state = "normal", narrow = false, forceOpen = false, initialQuery = "" }: { initialQuery?: string; forceOpen?: boolean; state?: "normal" | "loading" | "empty" | "error"; narrow?: boolean }) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(forceOpen);
  const [selected, setSelected] = useState("");
  const [recovered, setRecovered] = useState(false);
  const results: ActionSearchGroup[] = query ? [{ label: "Users", items: [{ id: "user", label: "Alexandra with a very long family name", description: "alexandra@example.test", leading: <User aria-hidden /> }].filter((item) => item.label.toLowerCase().includes(query.toLowerCase())) }] : groups;
  return <div className={narrow ? "w-full max-w-64" : "w-full max-w-lg"}>
    <ActionSearch label="Search example" placeholder="What are you searching for?" query={query} onQueryChange={setQuery}
      open={open} onOpenChange={setOpen} groups={state === "empty" && !recovered ? [] : results}
      loading={state === "loading"} error={state === "error" && !recovered ? "The lookup failed. Please try again." : undefined}
      contextAction={query ? { label: "Back to all results", onSelect: () => setQuery("") } : undefined}
      onRetry={() => setRecovered(true)} onSelect={(item) => { setSelected(item.label); setOpen(false); }} />
    <p className="mt-2 text-small text-muted-foreground" role="status">{selected ? `Selected ${selected}` : "Focus, type, then use arrows and Enter. Escape dismisses; clear keeps focus."}</p>
  </div>;
}
export default function ActionSearchDemo({ open }: SectionProps) {
  if (open) return <Example key={open} forceOpen initialQuery={open === "typing" ? "Alexandra" : ""} state={open === "loading" || open === "empty" || open === "error" ? open : "normal"} narrow={open === "typing"} />;
  return <SpecimenGroup title="Action search" description="Caller-controlled navigation with grouped options, live lookup states and input focus retained. Gallery theme and density controls apply.">
    <Specimen label="Recent / Suggested and typed results"><Example /></Specimen>
    <Specimen label="Narrow layout and long results"><Example narrow /></Specimen>
    <Specimen label="Loading"><Example state="loading" /></Specimen>
    <Specimen label="No results"><Example state="empty" /></Specimen>
    <Specimen label="Lookup failure and working retry"><Example state="error" /></Specimen>
  </SpecimenGroup>;
}
