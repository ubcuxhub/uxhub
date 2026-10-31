import { AppSidebar } from "@/components/shared/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

// Sidebar shell for the browsing portions of the portal and admin. Auth and
// UserProvider come from the parent (app)/layout.tsx.
export default function ShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-3 px-5 md:hidden">
          <SidebarTrigger aria-label="Open menu" />
          <span className="text-body-medium">UBC UX Hub</span>
        </header>
        <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
