import { UserProvider } from "@/context/UserContext";
import { requireAuth } from "@/lib/auth/guards";
import { AppSidebar } from "@/components/shared/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAuth();

  return (
    <UserProvider initialUser={user}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 border-b px-4 md:hidden">
            <SidebarTrigger />
            <span className="font-semibold">UBC UX Hub</span>
          </header>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </UserProvider>
  );
}
