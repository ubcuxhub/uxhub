import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardPanel } from "./DashboardPanel";

export function DashboardStatCard({ label, value, icon: Icon, loading = false }: {
  label: string; value?: number | null; icon: LucideIcon; loading?: boolean;
}) {
  return (
    <DashboardPanel className="gap-3">
      <h3 className="font-medium">{label}</h3>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="size-6" />
        {loading ? <Skeleton className="h-9 w-24" /> : <p className={value == null ? "text-small text-fg-secondary" : "text-h1 tabular-nums"}>{value == null ? "Unavailable" : value.toLocaleString("en-CA")}</p>}
      </div>
    </DashboardPanel>
  );
}
