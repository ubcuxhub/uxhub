import { cookies } from "next/headers";

import { AppSidebar } from "@/components/shared/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SettingsDialog } from "@/features/settings/components/SettingsDialog";

// Sidebar shell for the browsing portions of the portal and admin. Auth and
// UserProvider come from the parent (app)/layout.tsx.
export default async function ShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // SidebarProvider writes `sidebar_state` when the sidebar is toggled; read it
  // back so the collapsed state survives a refresh.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-3 px-5 md:hidden">
          <SidebarTrigger aria-label="Open menu" />
          <span className="text-body-medium">UBC UX Hub</span>
        </header>
        <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
      </SidebarInset>
      {/* Mounted here, not in the sidebar: below 768px the sidebar is a sheet
          whose content unmounts when closed, and `#settings/...` links must
          open Settings regardless. */}
      <SettingsDialog />
    </SidebarProvider>
  );
}
