import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DashboardPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn("gap-0 rounded-lg bg-secondary p-6 shadow-none", className)}>{children}</Card>;
}
