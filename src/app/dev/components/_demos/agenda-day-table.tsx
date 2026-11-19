"use client";

import { FileText, QrCode } from "lucide-react";
import { useState } from "react";
import { AgendaDayTable, type AgendaTableItem } from "@/components/shared/AgendaDayTable";
import { Composition } from "@/app/dev/_shell/Specimen";

const day = { id: "day", date: "2026-11-20", title: "Workshop day", items: [
  { id: "intro", title: "Welcome and a very long introduction to collaborative design", starts_at: "2026-11-20T18:00:00Z", ends_at: "2026-11-20T19:00:00Z", location: { type: "in_person" as const, restricted: false, building: "Innovation Center", room: "Studio A" } },
  { id: "workshop", title: "Workshop", starts_at: "2026-11-20T19:00:00Z", ends_at: "2026-11-20T20:00:00Z", location: { type: "online" as const, restricted: false } },
] };
export default function AgendaDayTableDemo() {
  const [selected, setSelected] = useState("");
  const actions = (item: AgendaTableItem) => [
    { label: "View Notes", icon: <FileText aria-hidden />, onSelect: () => setSelected(item.title) },
    ...(item.id === "intro" ? [{ label: "Check In", icon: <QrCode aria-hidden />, href: "#demo-check-in" }] : []),
  ];
  return <div className="space-y-8">
    <Composition title="Participant" description="Same day headings, columns, time wrapping and compact locations as the participant agenda."><div data-agenda-container className="@container/agenda"><AgendaDayTable day={day} /></div></Composition>
    <Composition title="Staff actions" description="Expanded staff columns: Time 24%, Item 24%, Building 20%, Room 12%, Actions 20%. Resize through 48rem container width; below it, click a row or focus its trigger and press Enter/Space. Escape and outside clicks dismiss. Switch themes and densities."><div data-agenda-container className="@container/agenda"><AgendaDayTable day={day} actions={actions} /></div></Composition>
    <Composition title="Narrow desktop container" description="Container width controls the collapsed layout even on desktop."><div data-agenda-container className="@container/agenda max-w-lg"><AgendaDayTable day={day} actions={actions} /></div></Composition>
    <p role="status">{selected ? `View Notes selected: ${selected}` : "Choose a demo action."}</p>
  </div>;
}
