import type { ReactNode } from "react";

/** Single reading order, with independent event/activity and links/statistics columns. */
export function DashboardLayout({ event, quickLinks, statistics, activity }: {
  event: ReactNode; quickLinks: ReactNode; statistics: ReactNode; activity: ReactNode;
}) {
  return <div className="@container/dashboard min-w-0">
    <div className="grid items-start gap-x-8 gap-y-6 @min-[1024px]/dashboard:grid-cols-[minmax(0,10fr)_minmax(0,7fr)] @min-[1024px]/dashboard:grid-rows-[auto_1fr]">
      <div className="min-w-0">{event}</div>
      <div className="contents @min-[1024px]/dashboard:col-start-2 @min-[1024px]/dashboard:row-start-1 @min-[1024px]/dashboard:row-span-2 @min-[1024px]/dashboard:flex @min-[1024px]/dashboard:min-w-0 @min-[1024px]/dashboard:flex-col @min-[1024px]/dashboard:gap-6">
        <div className="min-w-0 w-full">{quickLinks}</div>
        <div className="min-w-0 w-full">{statistics}</div>
      </div>
      <div className="min-w-0 @min-[1024px]/dashboard:col-start-1 @min-[1024px]/dashboard:row-start-2">{activity}</div>
    </div>
  </div>;
}
