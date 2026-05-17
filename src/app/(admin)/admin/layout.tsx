import { UserProvider } from "@/context/UserContext";
import { AdminSidebar } from "@/features/admin";
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAdmin();

  return (
    <UserProvider initialUser={user}>
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </UserProvider>
  );
}
