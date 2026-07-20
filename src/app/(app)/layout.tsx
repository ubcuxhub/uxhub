import { UserProvider } from "@/context/UserContext";
import { requireAuth } from "@/lib/auth/guards";
import { headers } from "next/headers";

// Shared authenticated boundary for portal and admin routes. The proxy records
// the requested path so login can return users to direct deep links.
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const user = await requireAuth(
    requestHeaders.get("x-uxhub-path") ?? undefined,
  );

  return <UserProvider initialUser={user}>{children}</UserProvider>;
}
