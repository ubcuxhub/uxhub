import { Suspense } from "react";
import { Search } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth/guards";
import { DashboardQuickLinks } from "@/features/admin/components/dashboard/DashboardQuickLinks";
import { DashboardActivityPlaceholder } from "@/features/admin/components/dashboard/DashboardActivityPlaceholder";
import { DashboardEventSkeleton } from "@/features/admin/components/dashboard/DashboardUpcomingEvent";
import { DashboardEventData, DashboardStats, DashboardStatsSkeleton } from "@/features/admin/components/dashboard/DashboardData";

export default async function AdminDashboard() {
  await requireAdmin();
  const now = new Date().toISOString();
  return (
    <PageContainer className="admin-dashboard flex flex-col gap-10 lg:py-16">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-h1">Dashboard</h1>
          <p className="text-fg-secondary">View events, users, and statistics at a glance.</p>
        </div>
        <div className="relative w-full lg:w-2/5">
          <Search aria-hidden="true" className="absolute top-3 left-3 size-4 text-fg-muted" />
          <Input disabled aria-label="Dashboard search (coming soon)" placeholder="What are you searching for?" title="Search coming soon" className="h-10 rounded-full pl-10 text-small" />
        </div>
      </header>
      <div className="grid items-start gap-[30px] lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="space-y-7">
          <section aria-labelledby="upcoming-event-heading" className="space-y-5">
            <h2 id="upcoming-event-heading" className="text-h2">Upcoming Event</h2>
            <Suspense fallback={<DashboardEventSkeleton />}><DashboardEventData now={now} /></Suspense>
          </section>
          <DashboardActivityPlaceholder />
        </div>
        <div className="space-y-7">
          <DashboardQuickLinks />
          <section aria-labelledby="statistics-heading" className="space-y-5">
            <h2 id="statistics-heading" className="text-h2">Statistics</h2>
            <Suspense fallback={<DashboardStatsSkeleton />}><DashboardStats now={now} /></Suspense>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
