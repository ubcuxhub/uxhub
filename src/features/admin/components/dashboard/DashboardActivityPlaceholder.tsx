import { Activity } from "lucide-react";
import { DashboardPanel } from "./DashboardPanel";

export function DashboardActivityPlaceholder() {
  return (
    <section aria-labelledby="activity-heading" className="space-y-5">
      <h2 id="activity-heading" className="text-h2">User activity</h2>
      <DashboardPanel className="min-h-36 items-center justify-center gap-3 text-center text-fg-secondary">
        <Activity aria-hidden="true" className="size-6" />
        <p className="text-small">User activity will appear here.</p>
      </DashboardPanel>
    </section>
  );
}
