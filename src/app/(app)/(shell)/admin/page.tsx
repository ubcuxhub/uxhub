import { DashboardLayout } from "@/features/admin/components/dashboard/DashboardLayout";
import { DashboardSearch } from "@/features/admin/components/dashboard/DashboardSearch";
import { createClient } from "@/lib/supabase/server";
import { Suspense } from "react";
import { PageContainer } from "@/components/shared/PageContainer";
import { requireAdmin } from "@/lib/auth/guards";
import { DashboardQuickLinks } from "@/features/admin/components/dashboard/DashboardQuickLinks";
import { DashboardActivityPlaceholder } from "@/features/admin/components/dashboard/DashboardActivityPlaceholder";
import { DashboardEventSkeleton } from "@/features/admin/components/dashboard/DashboardUpcomingEvent";
import { DashboardEventData, DashboardStats } from "@/features/admin/components/dashboard/DashboardData";

export default async function AdminDashboard() {
  const user = await requireAdmin();
  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  const sessionId = claims?.claims.session_id;
  const sessionKey = typeof sessionId === "string" ? sessionId : null;
  const now = new Date().toISOString();
  return (
    <PageContainer className="admin-dashboard flex flex-col gap-10 max-w-none">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-h1">Dashboard</h1>
          <p className="text-muted-foreground">View events, users, and statistics at a glance.</p>
        </div>
        <DashboardSearch userId={user.id} sessionKey={sessionKey} />
      </header>
      <DashboardLayout
        event={<section aria-labelledby="upcoming-event-heading" className="space-y-5">
          <h2 id="upcoming-event-heading" className="text-h2">Upcoming Event</h2>
          <Suspense fallback={<DashboardEventSkeleton />}><DashboardEventData now={now} /></Suspense>
        </section>}
        quickLinks={<DashboardQuickLinks />}
        statistics={<section aria-labelledby="statistics-heading" className="space-y-5">
          <h2 id="statistics-heading" tabIndex={-1} className="text-h2">Statistics</h2>
          <DashboardStats now={now} />
        </section>}
        activity={<DashboardActivityPlaceholder />}
      />
    </PageContainer>
  );
}
