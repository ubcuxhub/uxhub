"use client";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
export function AppShellHeader() {
  const { isMobile } = useSidebar();
  if (!isMobile) return null;
  return <header className="sticky top-0 z-45 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-5"><SidebarTrigger aria-label="Open menu" /><span className="text-body-medium">UBC UX Hub</span></header>;
}
