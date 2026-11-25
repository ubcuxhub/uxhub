"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EventPreview, EventPreviewSkeleton } from "@/components/shared/EventPreview";
import { PageContainer } from "@/components/shared/PageContainer";
import { StatisticsCard } from "@/components/shared/StatisticsCard";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { DashboardLayout } from "@/features/admin/components/dashboard/DashboardLayout";
import { DashboardQuickLinks } from "@/features/admin/components/dashboard/DashboardQuickLinks";
import { DashboardAreaOfStudy } from "@/features/admin/components/dashboard/DashboardAreaOfStudy";
import { DashboardClubMembers } from "@/features/admin/components/dashboard/DashboardClubMembers";
import { DashboardActivityPlaceholder } from "@/features/admin/components/dashboard/DashboardActivityPlaceholder";

/** Signed-out fixture uses the production layout and real chart components. */
export function DashboardResponsiveDemo() {
  const [collapsed, setCollapsed] = useState(false);
  const [state, setState] = useState<"loaded" | "loading" | "empty" | "error">("loaded");
  const failed = state === "error";
  const message = state === "empty" || failed ? { title: failed ? "We couldn’t load this statistic" : "No accounts yet", description: failed ? "Refresh the page to try again." : "Statistics appear once accounts join." } : undefined;
  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={() => setCollapsed(!collapsed)}>{collapsed ? "Expand" : "Collapse"} preview sidebar</Button>
      {(["loaded", "loading", "empty", "error"] as const).map(value => <Button key={value} variant="secondary" aria-pressed={value === state} onClick={() => setState(value)}>{value}</Button>)}
    </div>
    <div data-dashboard-preview data-sidebar={collapsed ? "collapsed" : "expanded"} className={collapsed ? "min-w-0 md:pl-22" : "min-w-0 md:pl-64"}>
      <PageContainer className="max-w-none">
        <DashboardLayout
          event={<section aria-label="Upcoming Event" className="space-y-5"><h2 className="text-h2">Upcoming Event</h2>{state === "loading" ? <EventPreviewSkeleton /> : message ? <Card><EmptyState title={failed ? "We couldn’t load the upcoming event" : "No upcoming events"} description={message.description} actions={<Button variant="secondary">{failed ? "Try again" : "Create event"}</Button>} /></Card> : <EventPreview title="Design Sprint with fellow creatives" href="/dev/components/event-preview" description="A team-based design challenge with a real responsive dashboard layout." banner={{ colour: "#325DC4" }} status={null} facts={[]} actions={<><Button>Check-in</Button><Button variant="secondary">Edit event</Button></>} />}</section>}
          quickLinks={<DashboardQuickLinks />}
          statistics={<section aria-label="Statistics" className="space-y-5"><h2 className="text-h2">Statistics</h2>{state !== "loaded" ? <><StatisticsCard title="Area of Study" size="compact" loading={state === "loading"} message={message} /><StatisticsCard title="Club Members" loading={state === "loading"} message={message} /></> : <>
            <DashboardAreaOfStudy data={{ totalAccounts: 25, majors: [{ major: "Cognitive Systems", count: 12 }, { major: "Unknown", count: 8 }, { major: "A very long academic major that wraps across multiple lines", count: 5 }] }} />
            <DashboardClubMembers recentAdditions={{ count: 11, coverage: "complete" }} data={{ latestAcademicYear: 2026, completeFrom: "2025-09-01T07:00:00Z", years: [2025, 2026].map(year => ({ academicYear: year, label: `${year}–${year + 1}`, count: 25, coverage: "complete", months: Array.from({ length: 8 }, (_, index) => ({ month: new Date(Date.UTC(year, 8 + index, 1)).toISOString().slice(0, 10), count: index + 1, coverage: "complete" })) })) }} />
          </>}</section>}
          activity={<DashboardActivityPlaceholder />}
        />
      </PageContainer>
    </div>
  </div>;
}
