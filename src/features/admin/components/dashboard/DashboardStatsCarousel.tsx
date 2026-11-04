"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EventAnalytics, MembershipAnalytics } from "@/lib/supabase-helpers/admin-dashboard";
import { DashboardPanel } from "./DashboardPanel";
import { DashboardMembersChart } from "./DashboardMembersChart";
import { DashboardEventsChart } from "./DashboardEventsChart";

export function DashboardStatsCarousel({ members, events }: { members: MembershipAnalytics | null; events: EventAnalytics | null }) {
  const [slide, setSlide] = useState(0);
  return (
    <DashboardPanel className="gap-5">
      <div role="region" aria-roledescription="carousel" aria-label="Dashboard statistics" className="grid">
        <div aria-hidden={slide !== 0} inert={slide !== 0} className={cn("col-start-1 row-start-1", slide !== 0 && "pointer-events-none opacity-0")} role="group" aria-roledescription="slide" aria-label="1 of 2: Members"><DashboardMembersChart data={members} /></div>
        <div aria-hidden={slide !== 1} inert={slide !== 1} className={cn("col-start-1 row-start-1", slide !== 1 && "pointer-events-none opacity-0")} role="group" aria-roledescription="slide" aria-label="2 of 2: Events"><DashboardEventsChart key={events?.events.map((event) => event.id).join(":") ?? "unavailable"} data={events} /></div>
      </div>
      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="ghost" size="icon" aria-label="Previous statistics slide" onClick={() => setSlide((current) => 1 - current)}><ChevronLeft /></Button>
        <div className="flex gap-3" aria-label="Choose statistics slide">
          {["Members", "Events"].map((label, index) => <button key={label} type="button" aria-label={`Show ${label.toLowerCase()} statistics`} aria-pressed={slide === index}
            onClick={() => setSlide(index)} className="flex size-9 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className={`size-2 rounded-full ${slide === index ? "bg-primary" : "bg-border"}`} />
          </button>)}
        </div>
        <Button variant="ghost" size="icon" aria-label="Next statistics slide" onClick={() => setSlide((current) => 1 - current)}><ChevronRight /></Button>
      </div>
      <p aria-live="polite" className="sr-only">{slide === 0 ? "Members" : "Events"} statistics, slide {slide + 1} of 2</p>
    </DashboardPanel>
  );
}
