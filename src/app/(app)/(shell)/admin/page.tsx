import { Suspense } from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { requireAdmin } from "@/lib/auth/guards";
import { DashboardQuickLinks } from "@/features/admin/components/dashboard/DashboardQuickLinks";
import { DashboardActivityPlaceholder } from "@/features/admin/components/dashboard/DashboardActivityPlaceholder";
import { DashboardEventSkeleton } from "@/features/admin/components/dashboard/DashboardUpcomingEvent";
import { DashboardEventData, DashboardStats } from "@/features/admin/components/dashboard/DashboardData";

export default async function AdminDashboard() {
  await requireAdmin();
  const now = new Date().toISOString();
  return (
    <PageContainer className="admin-dashboard flex flex-col gap-10 max-w-none">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-h1">Dashboard</h1>
          <p className="text-muted-foreground">View events, users, and statistics at a glance.</p>
        </div>
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,10fr)_minmax(0,7fr)]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="upcoming-event-heading" className="space-y-5">
            <h2 id="upcoming-event-heading" className="text-h2">Upcoming Event</h2>
            <Suspense fallback={<DashboardEventSkeleton />}><DashboardEventData now={now} /></Suspense>
          </section>
          <DashboardActivityPlaceholder />
        </div>
        <div className="min-w-0 space-y-6">
          <DashboardQuickLinks />
          <section aria-labelledby="statistics-heading" className="space-y-5">
            <h2 id="statistics-heading" className="text-h2">Statistics</h2>
            <DashboardStats now={now} />
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
